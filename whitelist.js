const $=s=>document.querySelector(s);
let currentUser=null,currentProfile=null;
let whitelistOpen=true;

function setWhitelistLock(locked,title,text,showAuthActions=false){
  const overlay=$("#whitelistLock");
  const form=$("#whitelistForm");
  if(overlay) overlay.classList.toggle("hidden",!locked);
  if($("#whitelistLockTitle")) $("#whitelistLockTitle").textContent=title||"Whitelist Application Locked";
  if($("#whitelistLockText")) $("#whitelistLockText").textContent=text||"";
  if($("#whitelistLockActions")) $("#whitelistLockActions").classList.toggle("hidden",!showAuthActions);
  if(form) form.querySelectorAll("input,textarea,button").forEach(el=>el.disabled=locked);
}

function refreshWhitelistLock(){
  if(!whitelistOpen){
    setWhitelistLock(true,"Whitelist Applications Closed","Whitelist applications are currently closed by the server administration.",false);
    return;
  }
  if(!currentUser){
    setWhitelistLock(true,"Whitelist Application Locked","Register or Login to unlock the whitelist application form.",true);
    return;
  }
  if(currentProfile?.banned===true){
    setWhitelistLock(true,"Application Locked","Your account is banned. Whitelist applications are disabled.",false);
    return;
  }
  setWhitelistLock(false);
}

db.ref("siteSettings/whitelistApplicationsOpen").on("value",snap=>{
  whitelistOpen = snap.val() !== false;
  refreshWhitelistLock();
});

auth.onAuthStateChanged(async user=>{
  currentUser=user||null;
  currentProfile=null;
  if(!user){
    $("#wlStatus").innerHTML='Please <a href="login.html">login</a> first.';
    $("#myApplication").textContent="Login to view your latest application.";
    refreshWhitelistLock();
    return;
  }
  try{
    currentProfile=await ensureInfinityUser(user);
  }catch(err){
    console.error("Profile sync failed:",err);
    $("#wlStatus").textContent=err.message||"Could not load account.";
    refreshWhitelistLock();
    return;
  }
  refreshWhitelistLock();
  if(currentProfile.banned===true) return;
  loadMyApplication();
});

$("#whitelistForm").onsubmit=async e=>{
  e.preventDefault();
  if(!whitelistOpen){ $("#wlStatus").textContent="Whitelist applications are currently closed."; return; }
  if(!currentUser){ location.href="login.html"; return; }
  const f=new FormData(e.target);
  const data={
    uid:currentUser.uid,email:currentUser.email,
    displayName:currentProfile?.displayName||currentUser.displayName||"User",infinityId:currentProfile?.infinityId||makeInfinityId(currentUser.uid),
    realName:f.get("realName"),age:Number(f.get("age")),discord:f.get("discord"),rpName:f.get("rpName"),
    reason:f.get("reason"),rpExplain:f.get("rpExplain"),scenario:f.get("scenario"),
    status:"pending",createdAt:firebase.database.ServerValue.TIMESTAMP
  };
  try{
    const key=db.ref("whitelist").push().key;
    await db.ref("whitelist/"+key).set(data);
    await db.ref("userApplications/"+currentUser.uid+"/"+key).set(true);
    $("#wlStatus").textContent="Submitted successfully.";
    e.target.reset();loadMyApplication();
  }catch(err){$("#wlStatus").textContent=err.message}
};

async function loadMyApplication(){
  if(!currentUser)return;
  const linkSnap=await db.ref("userApplications/"+currentUser.uid).once("value");
  const ids=Object.keys(linkSnap.val()||{});
  if(!ids.length){$("#myApplication").textContent="No application submitted yet.";return}
  const apps=await Promise.all(ids.map(id=>db.ref("whitelist/"+id).once("value").then(s=>({id,...s.val()}))));
  apps.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const a=apps[0];
  $("#myApplication").innerHTML=`<p><b>${esc(a.rpName||"Application")}</b></p><span class="status-badge status-${a.status}">${String(a.status).toUpperCase()}</span>${a.adminNote?`<p>Admin note: ${esc(a.adminNote)}</p>`:""}`;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
