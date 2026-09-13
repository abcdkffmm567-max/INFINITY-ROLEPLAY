const mysql=require('mysql2/promise');

function dbConfig(){
  for(const k of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME']) if(!process.env[k]) throw new Error('SERVER_MISSING_'+k);
  return {
    host:process.env.DB_HOST,
    port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    connectTimeout:10000,
    charset:'utf8mb4',
    timezone:'Z'
  };
}

const spawnPoints=[
  {x:-1561.625732,y:48.908214,z:17.328125,a:38.00},
  {x:-1576.976806,y:64.749420,z:17.328125,a:232.54},
  {x:-1585.123168,y:41.487560,z:17.328125,a:314.16}
];

function randomSpawn(){return spawnPoints[Math.floor(Math.random()*spawnPoints.length)]}

async function getDeliveryMinutes(conn){
  try{
    const [rows]=await conn.execute('SELECT delivery_minutes FROM website_vehicle_settings WHERE id=1 LIMIT 1');
    const n=Number(rows?.[0]?.delivery_minutes);
    if(Number.isInteger(n)&&n>=0&&n<=10080) return n;
  }catch{}
  return 180;
}

async function deliverDue(conn,limit=50){
  const delivered=[];
  await conn.beginTransaction();
  try{
    const [rows]=await conn.execute(
      `SELECT id,server_uid,server_username,vehicle_name,modelid
       FROM website_vehicle_purchases
       WHERE delivery_status='pending' AND deliver_at IS NOT NULL AND deliver_at<=UTC_TIMESTAMP()
       ORDER BY deliver_at ASC,id ASC
       LIMIT ${Math.max(1,Math.min(100,Number(limit)||50))}
       FOR UPDATE`
    );
    for(const p of rows){
      const [acct]=await conn.execute('SELECT uid,username FROM users WHERE uid=? LIMIT 1',[Number(p.server_uid)]);
      if(!acct.length){
        await conn.execute("UPDATE website_vehicle_purchases SET delivery_status='failed' WHERE id=?",[p.id]);
        continue;
      }
      const [mx]=await conn.execute('SELECT COALESCE(MAX(id),0)+1 AS next_id FROM vehicles FOR UPDATE');
      const vid=Number(mx[0].next_id);
      const spawn=randomSpawn();
      await conn.execute(
        `INSERT INTO vehicles (id,ownerid,owner,modelid,price,pos_x,pos_y,pos_z,pos_a,color1,color2)
         VALUES (?,?,?,?,0,?,?,?,?,0,0)`,
        [vid,Number(p.server_uid),String(p.server_username||acct[0].username||'').slice(0,24),Number(p.modelid),spawn.x,spawn.y,spawn.z,spawn.a]
      );
      await conn.execute(
        `UPDATE website_vehicle_purchases
         SET vehicle_id=?,delivery_status='delivered',delivered_at=UTC_TIMESTAMP()
         WHERE id=?`,
        [vid,p.id]
      );
      delivered.push({purchaseId:Number(p.id),vehicleId:vid,vehicleName:p.vehicle_name});
    }
    await conn.commit();
    return delivered;
  }catch(e){
    try{await conn.rollback()}catch{}
    throw e;
  }
}

module.exports={mysql,dbConfig,getDeliveryMinutes,deliverDue};
