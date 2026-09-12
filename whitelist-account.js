const mysql=require("mysql2/promise");
const crypto=require("crypto");

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

function hashPassword(password){
  // Existing Infinity RP password values are 128-character hashes. This creates uppercase SHA-512 hex.
  // If the gamemode uses a different password plugin/hash, change PASSWORD_HASH_ALGO in Netlify.
  const algo=String(process.env.PASSWORD_HASH_ALGO||"sha512").toLowerCase();
  if(algo==="plain") return password;
  if(algo!=="sha512") throw Object.assign(new Error("UNSUPPORTED_PASSWORD_HASH_ALGO"),{statusCode:500});
  return crypto.createHash("sha512").update(password,"utf8").digest("hex").toUpperCase();
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

    const passwordHash=hashPassword(password);
    const [insert]=await conn.execute(
      `INSERT INTO users (username,password,regdate,lastlogin,setup,age,skin,cash,ecoin)
       VALUES (?, ?, NOW(), NULL, 1, ?, ?, 5000, 0)`,
      [username,passwordHash,age,skin]
    );
    const serverUid=Number(insert.insertId);

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
