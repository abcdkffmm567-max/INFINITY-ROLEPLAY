const mysql = require("mysql2/promise");

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyDWxZPjXFtLPP4GfueoLdohMhGjvrD_z2c";

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

async function verifyFirebaseUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw Object.assign(new Error("LOGIN_REQUIRED"), { statusCode: 401 });

  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token })
  });
  const data = await r.json();
  if (!r.ok || !data.users || !data.users[0]?.localId) {
    throw Object.assign(new Error("INVALID_LOGIN"), { statusCode: 401 });
  }
  return {
    uid: data.users[0].localId,
    email: data.users[0].email || ""
  };
}

function dbConfig() {
  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  for (const key of required) {
    if (!process.env[key]) throw Object.assign(new Error(`SERVER_MISSING_${key}`), { statusCode: 500 });
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    charset: "utf8mb4",
    timezone: "+00:00"
  };
}

function sriLankaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function nextSriLankaMidnightISO() {
  const now = new Date();
  const dateKey = sriLankaDateKey();
  const [y,m,d] = dateKey.split("-").map(Number);
  // Sri Lanka is UTC+05:30 year-round. Next local midnight = 18:30 UTC previous date.
  return new Date(Date.UTC(y, m-1, d+1, -5, -30, 0)).toISOString();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return response(405, { ok:false, error:"METHOD_NOT_ALLOWED" });

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; }
  catch { return response(400, { ok:false, error:"INVALID_JSON" }); }

  let authUser;
  try { authUser = await verifyFirebaseUser(event); }
  catch (e) { return response(e.statusCode || 401, { ok:false, error:e.message }); }

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig());
    const action = String(body.action || "status");

    if (action === "link") {
      const serverUid = Number(body.serverUid);
      const username = String(body.username || "").trim();
      if (!Number.isInteger(serverUid) || serverUid <= 0 || !/^[A-Za-z0-9_\.\[\]-]{2,24}$/.test(username)) {
        return response(400, { ok:false, error:"INVALID_SERVER_ACCOUNT" });
      }

      const [players] = await conn.execute(
        "SELECT uid, username, ecoin, cash FROM users WHERE uid = ? AND BINARY username = BINARY ? LIMIT 1",
        [serverUid, username]
      );
      if (!players.length) return response(404, { ok:false, error:"SERVER_ACCOUNT_NOT_FOUND" });

      const [existingByServer] = await conn.execute(
        "SELECT firebase_uid FROM website_account_links WHERE server_uid = ? LIMIT 1",
        [serverUid]
      );
      if (existingByServer.length && existingByServer[0].firebase_uid !== authUser.uid) {
        return response(409, { ok:false, error:"SERVER_ACCOUNT_ALREADY_LINKED" });
      }

      const [existingByFirebase] = await conn.execute(
        "SELECT server_uid FROM website_account_links WHERE firebase_uid = ? LIMIT 1",
        [authUser.uid]
      );
      if (existingByFirebase.length && Number(existingByFirebase[0].server_uid) !== serverUid) {
        return response(409, { ok:false, error:"WEBSITE_ACCOUNT_ALREADY_LINKED" });
      }

      await conn.execute(
        `INSERT INTO website_account_links (firebase_uid, server_uid, server_username)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE server_username = VALUES(server_username)`,
        [authUser.uid, serverUid, players[0].username]
      );

      return response(200, {
        ok:true,
        linked:true,
        account:{ uid:players[0].uid, username:players[0].username, ecoin:players[0].ecoin, cash:players[0].cash }
      });
    }

    if (action === "status") {
      const [links] = await conn.execute(
        `SELECT l.server_uid, l.server_username, u.ecoin, u.cash
         FROM website_account_links l
         INNER JOIN users u ON u.uid = l.server_uid
         WHERE l.firebase_uid = ? LIMIT 1`,
        [authUser.uid]
      );
      if (!links.length) return response(200, { ok:true, linked:false });

      const dateKey = sriLankaDateKey();
      const [claims] = await conn.execute(
        "SELECT id, claimed_at FROM website_daily_rewards WHERE firebase_uid = ? AND claim_date = ? LIMIT 1",
        [authUser.uid, dateKey]
      );

      return response(200, {
        ok:true,
        linked:true,
        claimedToday:claims.length > 0,
        nextClaimAt:nextSriLankaMidnightISO(),
        account:{
          uid:links[0].server_uid,
          username:links[0].server_username,
          ecoin:links[0].ecoin,
          cash:links[0].cash
        }
      });
    }

    if (action === "claim") {
      const dateKey = sriLankaDateKey();
      await conn.beginTransaction();
      try {
        const [links] = await conn.execute(
          "SELECT server_uid, server_username FROM website_account_links WHERE firebase_uid = ? LIMIT 1 FOR UPDATE",
          [authUser.uid]
        );
        if (!links.length) {
          await conn.rollback();
          return response(400, { ok:false, error:"SERVER_ACCOUNT_NOT_LINKED" });
        }

        const serverUid = Number(links[0].server_uid);
        const [players] = await conn.execute(
          "SELECT uid, username, ecoin, cash FROM users WHERE uid = ? LIMIT 1 FOR UPDATE",
          [serverUid]
        );
        if (!players.length) {
          await conn.rollback();
          return response(404, { ok:false, error:"SERVER_ACCOUNT_NOT_FOUND" });
        }

        try {
          await conn.execute(
            `INSERT INTO website_daily_rewards
             (firebase_uid, server_uid, claim_date, ecoin_reward, cash_reward)
             VALUES (?, ?, ?, 100, 1000)`,
            [authUser.uid, serverUid, dateKey]
          );
        } catch (e) {
          if (e && e.code === "ER_DUP_ENTRY") {
            await conn.rollback();
            return response(409, { ok:false, error:"ALREADY_CLAIMED_TODAY", nextClaimAt:nextSriLankaMidnightISO() });
          }
          throw e;
        }

        await conn.execute(
          "UPDATE users SET ecoin = COALESCE(ecoin,0) + 100, cash = COALESCE(cash,0) + 1000 WHERE uid = ?",
          [serverUid]
        );

        const [updated] = await conn.execute(
          "SELECT uid, username, ecoin, cash FROM users WHERE uid = ? LIMIT 1",
          [serverUid]
        );

        await conn.commit();
        return response(200, {
          ok:true,
          claimed:true,
          reward:{ ecoin:100, cash:1000 },
          nextClaimAt:nextSriLankaMidnightISO(),
          account:updated[0]
        });
      } catch (e) {
        try { await conn.rollback(); } catch {}
        throw e;
      }
    }

    return response(400, { ok:false, error:"UNKNOWN_ACTION" });
  } catch (e) {
    console.error("daily-reward error", e);
    return response(e.statusCode || 500, { ok:false, error:e.message || "SERVER_ERROR" });
  } finally {
    if (conn) try { await conn.end(); } catch {}
  }
};
