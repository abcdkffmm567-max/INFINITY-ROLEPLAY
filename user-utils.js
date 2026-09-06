function makeInfinityId(uid){
  const clean=String(uid||"USER").replace(/[^a-zA-Z0-9]/g,"").toUpperCase();
  return "INF"+clean.slice(0,8).padEnd(8,"0");
}

async function ensureInfinityUser(user, extra={}){
  if(!user) return null;
  const ref=db.ref("users/"+user.uid);
  const snap=await ref.once("value");
  const old=snap.val()||{};

  const updates={
    displayName: extra.displayName || user.displayName || old.displayName || "Player",
    email: old.email || extra.email || user.email || "",
    photoURL: extra.photoURL || user.photoURL || old.photoURL || "",
    infinityId: old.infinityId || makeInfinityId(user.uid),
    banned: old.banned === true,
    verified: old.verified === true,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };

  if(!old.createdAt) updates.createdAt=firebase.database.ServerValue.TIMESTAMP;
  if(extra.provider && !old.provider) updates.provider=extra.provider;

  await ref.update(updates);

  // Public directory used by the static Admin Panel for User Management.
  // Only non-sensitive fields are mirrored here.
  await db.ref("publicUsers/"+user.uid).update({
    displayName:updates.displayName,
    photoURL:updates.photoURL,
    infinityId:updates.infinityId,
    updatedAt:firebase.database.ServerValue.TIMESTAMP
  });
  const latest=await ref.once("value");
  return latest.val()||updates;
}

async function getBanState(user){
  if(!user) return {banned:false};
  const snap=await db.ref("users/"+user.uid).once("value");
  const data=snap.val()||{};
  return {
    banned:data.banned===true,
    banReason:data.banReason||"",
    infinityId:data.infinityId||makeInfinityId(user.uid),
    data
  };
}
