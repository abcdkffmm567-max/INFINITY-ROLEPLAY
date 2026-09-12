const mysql=require("mysql2/promise");
const {whirlpool}=require("hash-wasm");

const FIREBASE_WEB_API_KEY=process.env.FIREBASE_WEB_API_KEY||"AIzaSyDWxZPjXFtLPP4GfueoLdohMhGjvrD_z2c";

function response(statusCode,body){
  return {statusCode,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},body:JSON.stringify(body)};
}

async function verifyFirebaseUser(event){
  const authHeader=event.headers.authorization||event.headers.Authorization||"";
  const token=authHeader.startsWith("Bearer ")?authHeader.slice(7).trim():"";
  if(!token) throw Object.assign(new Error("LOGIN_REQUIRED"),{statusCode:401});
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token})
  });
  const data=await r.json();
  if(!r.ok||!data.users||!data.users[0]?.localId) throw Object.assign(new Error("INVALID_LOGIN"),{statusCode:401});
  return {uid:data.users[0].localId,email:data.users[0].email||""};
}

function dbConfig(){
  const required=["DB_HOST","DB_USER","DB_PASSWORD","DB_NAME"];
  for(const key of required) if(!process.env[key]) throw Object.assign(new Error(`SERVER_MISSING_${key}`),{statusCode:500});
  return {host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectTimeout:10000,charset:"utf8mb4",timezone:"+00:00"};
}

function normalizeServerName(value){
  const name=String(value||"").trim().replace(/\s+/g,"_");
  if(!/^[A-Za-z]{2,12}_[A-Za-z]{2,12}$/.test(name)||name.length>24) return null;
  return name;
}

async function hashPassword(password){
  // DL.pwn verifies SA-MP passwords with WP_Hash.
  // WP_Hash is Whirlpool and stores a 128-character hexadecimal digest.
  // Force Whirlpool here so website-created accounts use the same format as the game server.
  return (await whirlpool(password)).toUpperCase();
}

exports.handler=async event=>{
  if(event.httpMethod!=="POST") return response(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
  let body={};
  try{body=event.body?JSON.parse(event.body):{};}catch{return response(400,{ok:false,error:"INVALID_JSON"});}

  let authUser;
  try{authUser=await verifyFirebaseUser(event);}catch(e){return response(e.statusCode||401,{ok:false,error:e.message});}
  if(String(body.action||"create")!=="create") return response(400,{ok:false,error:"INVALID_ACTION"});

  const username=normalizeServerName(body.inGameName);
  const password=String(body.password||"");
  const age=Number(body.characterAge);
  const skin=Number(body.skinId);
  const applicationId=String(body.applicationId||"").slice(0,80);

  if(!username) return response(400,{ok:false,error:"INVALID_SERVER_NAME"});
  if(password.length<6||password.length>64) return response(400,{ok:false,error:"INVALID_PASSWORD"});
  if(!Number.isInteger(age)||age<18||age>100) return response(400,{ok:false,error:"INVALID_CHARACTER_AGE"});
  if(!Number.isInteger(skin)||skin<0||skin>311) return response(400,{ok:false,error:"INVALID_SKIN_ID"});

  let conn;
  try{
    conn=await mysql.createConnection(dbConfig());
    await conn.beginTransaction();

    // A website account can only own one linked SA-MP account.
    const [existingLinks]=await conn.execute(
      `SELECT l.server_uid,l.server_username,u.ecoin,u.cash
       FROM website_account_links l LEFT JOIN users u ON u.uid=l.server_uid
       WHERE l.firebase_uid=? LIMIT 1 FOR UPDATE`,[authUser.uid]
    );
    if(existingLinks.length){
      const link=existingLinks[0];
      const linkedName=String(link.server_username||"");
      if(linkedName.toLowerCase()!==username.toLowerCase()){
        await conn.rollback();
        return response(409,{ok:false,error:"WEBSITE_ACCOUNT_ALREADY_LINKED",account:{uid:link.server_uid,username:linkedName}});
      }
      await conn.commit();
      return response(200,{ok:true,alreadyLinked:true,account:{uid:link.server_uid,username:linkedName,ecoin:link.ecoin||0,cash:link.cash||0}});
    }

    const [sameName]=await conn.execute("SELECT uid FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1 FOR UPDATE",[username]);
    if(sameName.length){
      await conn.rollback();
      return response(409,{ok:false,error:"SERVER_USERNAME_EXISTS"});
    }

    const passwordHash=await hashPassword(password);

    // Some VibeGames database imports do not preserve AUTO_INCREMENT on users.uid.
    // Support both schemas: use MySQL AUTO_INCREMENT when available, otherwise
    // safely allocate the next UID under a named MySQL lock.
    const [uidColumns]=await conn.execute("SHOW COLUMNS FROM users LIKE 'uid'");
    const uidIsAutoIncrement=uidColumns.length && /auto_increment/i.test(String(uidColumns[0].Extra||""));

    let serverUid;
    if(uidIsAutoIncrement){
      const [insert]=await conn.execute(
        `INSERT INTO users (username,password,regdate,lastlogin,setup,age,skin,cash,ecoin)
         VALUES (?, ?, NOW(), NULL, 1, ?, ?, 5000, 0)`,
        [username,passwordHash,age,skin]
      );
      serverUid=Number(insert.insertId);
    }else{
      const lockName="infinity_users_uid_allocator";
      const [lockRows]=await conn.execute("SELECT GET_LOCK(?, 10) AS locked",[lockName]);
      if(Number(lockRows?.[0]?.locked)!==1){
        throw new Error("UID_ALLOCATOR_BUSY");
      }
      try{
        const [uidRows]=await conn.execute("SELECT COALESCE(MAX(uid),0)+1 AS next_uid FROM users");
        serverUid=Number(uidRows?.[0]?.next_uid||1);
        await conn.execute(
          `INSERT INTO users (uid,username,password,regdate,lastlogin,setup,age,skin,cash,ecoin)
           VALUES (?, ?, ?, NOW(), NULL, 1, ?, ?, 5000, 0)`,
          [serverUid,username,passwordHash,age,skin]
        );
      }finally{
        try{await conn.execute("SELECT RELEASE_LOCK(?)",[lockName]);}catch{}
      }
    }

    await conn.execute(
      `INSERT INTO website_account_links (firebase_uid,server_uid,server_username)
       VALUES (?,?,?)`,[authUser.uid,serverUid,username]
    );

    await conn.commit();
    return response(200,{ok:true,created:true,applicationId,account:{uid:serverUid,username,ecoin:0,cash:5000}});
  }catch(e){
    if(conn){try{await conn.rollback();}catch{}}
    console.error("whitelist-account error",e);
    if(e&&e.code==="ER_NO_SUCH_TABLE") return response(500,{ok:false,error:"REQUIRED_REWARD_TABLES_MISSING"});
    if(e&&e.code==="ER_DUP_ENTRY") return response(409,{ok:false,error:"SERVER_USERNAME_EXISTS"});
    return response(e.statusCode||500,{ok:false,error:e.message||"SERVER_ERROR",code:e.code||null});
  }finally{
    if(conn){try{await conn.end();}catch{}}
  }
};
