const {mysql,dbConfig,deliverDue}=require('./vehicle-delivery-lib');
exports.handler=async()=>{
  let conn;
  try{
    conn=await mysql.createConnection(dbConfig());
    const delivered=await deliverDue(conn,100);
    return {statusCode:200,body:JSON.stringify({ok:true,delivered:delivered.length})};
  }catch(e){
    console.error('vehicle-delivery',e);
    return {statusCode:500,body:JSON.stringify({ok:false,error:e.message||'SERVER_ERROR'})};
  }finally{if(conn)try{await conn.end()}catch{}}
};
