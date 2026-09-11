const mysql = require("mysql2/promise");

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyDWxZPjXFtLPP4GfueoLdohMhGjvrD_z2c";
const FIREBASE_DB_URL = (process.env.FIREBASE_DATABASE_URL || "https://infinityroleplay-default-rtdb.asia-southeast1.firebasedatabase.app").replace(/\/$/, "");
const CASH_PER_ECOIN = 10;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},
    body: JSON.stringify(body)
  };
}

async function verifyFirebaseUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw Object.assign(new Error("LOGIN_REQUIRED"), { statusCode: 401 });

  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({idToken:token})
  });
  const data = await r.json();
  if (!r.ok || !data.users || !data.users[0]?.localId) {
    throw Object.assign(new Error("INVALID_LOGIN"), { statusCode: 401 });
  }
  return { uid:data.users[0].localId, email:data.users[0].email||"", token };
}

async function requireAdmin(authUser) {
  const r = await fetch(`${FIREBASE_DB_URL}/admins/${encodeURIComponent(authUser.uid)}.json?auth=${encodeURIComponent(authUser.token)}`, {cache:"no-store"});
  if (!r.ok) throw Object.assign(new Error("ADMIN_CHECK_FAILED"), { statusCode: 403 });
  const value = await r.json();
  if (value !== true) throw Object.assign(new Error("ADMIN_REQUIRED"), { statusCode: 403 });
}

function dbConfig() {
  for (const key of ["DB_HOST","DB_USER","DB_PASSWORD","DB_NAME"]) {
    if (!process.env[key]) throw Object.assign(new Error(`SERVER_MISSING_${key}`), {statusCode:500});
  }
  return {
    host:process.env.DB_HOST,
    port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    connectTimeout:10000,
    charset:"utf8mb4",
    timezone:"+00:00"
  };
}

function cleanCode(value) {
  return String(value||"").trim().toUpperCase().replace(/\s+/g, "");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return response(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
  let body={};
  try { body=event.body?JSON.parse(event.body):{}; }
  catch { return response(400,{ok:false,error:"INVALID_JSON"}); }

  let authUser;
  try { authUser=await verifyFirebaseUser(event); }
  catch(e){ return response(e.statusCode||401,{ok:false,error:e.message}); }

  let conn;
  try {
    conn=await mysql.createConnection(dbConfig());
    const action=String(body.action||"status");

    if(action==="redeem"){
      const code=cleanCode(body.code);
      if(!/^[A-Z0-9_-]{4,32}$/.test(code)) return response(400,{ok:false,error:"INVALID_REDEEM_CODE"});

      await conn.beginTransaction();
      try{
        const [links]=await conn.execute(
          "SELECT server_uid, server_username FROM website_account_links WHERE firebase_uid = ? LIMIT 1 FOR UPDATE",
          [authUser.uid]
        );
        if(!links.length){ await conn.rollback(); return response(400,{ok:false,error:"SERVER_ACCOUNT_NOT_LINKED"}); }
        const serverUid=Number(links[0].server_uid);

        const [codes]=await conn.execute(
          `SELECT id, code, ecoin_reward, cash_reward, max_uses, used_count, active, expires_at
           FROM website_redeem_codes WHERE BINARY code = BINARY ? LIMIT 1 FOR UPDATE`, [code]
        );
        if(!codes.length){ await conn.rollback(); return response(404,{ok:false,error:"REDEEM_CODE_NOT_FOUND"}); }
        const c=codes[0];
        if(!Number(c.active)){ await conn.rollback(); return response(409,{ok:false,error:"REDEEM_CODE_DISABLED"}); }
        if(c.expires_at && new Date(c.expires_at).getTime() < Date.now()){
          await conn.rollback(); return response(409,{ok:false,error:"REDEEM_CODE_EXPIRED"});
        }
        if(Number(c.max_uses)>0 && Number(c.used_count)>=Number(c.max_uses)){
          await conn.rollback(); return response(409,{ok:false,error:"REDEEM_CODE_USED_UP"});
        }

        const [already]=await conn.execute(
          "SELECT id FROM website_redeem_claims WHERE code_id = ? AND firebase_uid = ? LIMIT 1",
          [c.id, authUser.uid]
        );
        if(already.length){ await conn.rollback(); return response(409,{ok:false,error:"REDEEM_CODE_ALREADY_USED"}); }

        const [players]=await conn.execute(
          "SELECT uid, username, ecoin, cash FROM users WHERE uid = ? LIMIT 1 FOR UPDATE", [serverUid]
        );
        if(!players.length){ await conn.rollback(); return response(404,{ok:false,error:"SERVER_ACCOUNT_NOT_FOUND"}); }

        await conn.execute(
          `INSERT INTO website_redeem_claims
           (code_id, code, firebase_uid, server_uid, ecoin_reward, cash_reward)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [c.id,c.code,authUser.uid,serverUid,c.ecoin_reward,0]
        );
        await conn.execute("UPDATE website_redeem_codes SET used_count = used_count + 1 WHERE id = ?",[c.id]);
        await conn.execute(
          "UPDATE users SET ecoin=COALESCE(ecoin,0)+? WHERE uid=?",
          [c.ecoin_reward,serverUid]
        );
        const [updated]=await conn.execute("SELECT uid,username,ecoin,cash FROM users WHERE uid=? LIMIT 1",[serverUid]);
        await conn.commit();
        return response(200,{ok:true,redeemed:true,reward:{ecoin:Number(c.ecoin_reward),cash:0},account:updated[0]});
      }catch(e){ try{await conn.rollback();}catch{} throw e; }
    }

    if(action==="history"){
      const [rows]=await conn.execute(
        `SELECT code, ecoin_reward, cash_reward, claimed_at
         FROM website_redeem_claims WHERE firebase_uid=? ORDER BY claimed_at DESC LIMIT 10`, [authUser.uid]
      );
      return response(200,{ok:true,claims:rows});
    }

    if(action==="admin_create"){
      await requireAdmin(authUser);
      const requested=cleanCode(body.code);
      const code=requested || `INFINITY-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      const ecoin=Math.max(1,Math.min(1000000,Number(body.ecoin)||0));
      const cash=ecoin*CASH_PER_ECOIN;
      const maxUses=Math.max(1,Math.min(100000,Number(body.maxUses)||1));
      const expiresAt=body.expiresAt?new Date(body.expiresAt):null;
      if(!/^[A-Z0-9_-]{4,32}$/.test(code)) return response(400,{ok:false,error:"INVALID_REDEEM_CODE"});
      if(!ecoin) return response(400,{ok:false,error:"INVALID_ECOIN_AMOUNT"});
      if(expiresAt && Number.isNaN(expiresAt.getTime())) return response(400,{ok:false,error:"INVALID_EXPIRY"});
      try{
        await conn.execute(
          `INSERT INTO website_redeem_codes
           (code, ecoin_reward, cash_reward, max_uses, active, expires_at, created_by)
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [code,ecoin,0,maxUses,expiresAt?expiresAt.toISOString().slice(0,19).replace('T',' '):null,authUser.uid]
        );
      }catch(e){
        if(e.code==="ER_DUP_ENTRY") return response(409,{ok:false,error:"REDEEM_CODE_EXISTS"});
        throw e;
      }
      return response(200,{ok:true,code:{code,ecoin_reward:ecoin,cash_reward:0,convert_cash_value:cash,max_uses:maxUses}});
    }

    if(action==="admin_list"){
      await requireAdmin(authUser);
      const [rows]=await conn.execute(
        `SELECT id,code,ecoin_reward,cash_reward,max_uses,used_count,active,expires_at,created_at
         FROM website_redeem_codes ORDER BY id DESC LIMIT 100`
      );
      return response(200,{ok:true,codes:rows});
    }

    if(action==="admin_claims"){
      await requireAdmin(authUser);
      const [rows]=await conn.execute(
        `SELECT rc.id, rc.code, rc.firebase_uid, rc.server_uid,
                COALESCE(u.username, wal.server_username, 'Unknown') AS server_username,
                rc.ecoin_reward, rc.cash_reward, rc.claimed_at
         FROM website_redeem_claims rc
         LEFT JOIN users u ON u.uid = rc.server_uid
         LEFT JOIN website_account_links wal ON wal.firebase_uid = rc.firebase_uid
         ORDER BY rc.claimed_at DESC, rc.id DESC
         LIMIT 200`
      );
      return response(200,{ok:true,claims:rows});
    }

    if(action==="admin_toggle"){
      await requireAdmin(authUser);
      const id=Number(body.id);
      const active=body.active?1:0;
      if(!Number.isInteger(id)||id<1) return response(400,{ok:false,error:"INVALID_CODE_ID"});
      await conn.execute("UPDATE website_redeem_codes SET active=? WHERE id=?",[active,id]);
      return response(200,{ok:true});
    }

    return response(400,{ok:false,error:"UNKNOWN_ACTION"});
  }catch(e){
    console.error("redeem-code error",e);
    return response(e.statusCode||500,{ok:false,error:e.message||"SERVER_ERROR"});
  }finally{ if(conn) try{await conn.end();}catch{} }
};
