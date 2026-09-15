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
  if(form) form.querySelectorAll("input,textarea,button,select").forEach(el=>el.disabled=locked);
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
  await user.reload();
  user=auth.currentUser||user;
  if(user.email && user.emailVerified!==true){
    try{await sendInfinityVerificationEmail(user);}catch(e){}
    $("#wlStatus").textContent="Verify your email before applying. A verification link has been sent.";
    await auth.signOut();
    currentUser=null;
    refreshWhitelistLock();
    return;
  }
  currentUser=user;
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

const backstoryEl=document.querySelector('[name="backstory"]');
if(backstoryEl){
  backstoryEl.addEventListener("input",()=>{
    const count=countWords(backstoryEl.value);
    const out=$("#backstoryWords");
    if(out) out.textContent=count;
  });
}

function countWords(v){
  return String(v||"").trim().split(/\s+/).filter(Boolean).length;
}

function normalizeServerName(v){
  return String(v||"").trim().replace(/\s+/g,"_");
}

$("#whitelistForm").onsubmit=async e=>{
  e.preventDefault();
  if(!whitelistOpen){ $("#wlStatus").textContent="Whitelist applications are currently closed."; return; }
  if(!currentUser){ location.href="login.html"; return; }

  const f=new FormData(e.target);


  const backstory=String(f.get("backstory")||"").trim();
  const backstoryWords=countWords(backstory);
  if(backstory && backstoryWords<20){
    $("#wlStatus").textContent=`If you add a backstory, it must be at least 20 words. Current: ${backstoryWords} words. You can also leave it blank.`;
    backstoryEl?.focus();
    return;
  }
  if(f.get("rpBefore")==="Yes"&&!String(f.get("previousServers")||"").trim()){
    $("#wlStatus").textContent="Please enter the RP servers you played on and how long.";
    return;
  }
  if(f.get("bannedBefore")==="Yes"&&!String(f.get("banReason")||"").trim()){
    $("#wlStatus").textContent="Please explain why you were banned.";
    return;
  }

  const applicationId=db.ref("whitelist").push().key;
  const btn=$("#submitWhitelistBtn");
  const oldText=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent="Submitting...";}
  $("#wlStatus").textContent="Submitting your whitelist application...";

  try{
    const data={
      uid:currentUser.uid,
      email:currentUser.email||"",
      displayName:currentProfile?.displayName||currentUser.displayName||"User",
      infinityId:currentProfile?.infinityId||makeInfinityId(currentUser.uid),
      discord:String(f.get("discord")||"").trim(),
      inGameName:String(f.get("inGameName")||"").trim(),
      oocAge:Number(f.get("oocAge")),
      countryTimezone:String(f.get("countryTimezone")||"").trim(),
      workingMic:String(f.get("workingMic")||""),
      hoursPerWeek:Number(f.get("hoursPerWeek")),
      rpBefore:String(f.get("rpBefore")||""),
      previousServers:String(f.get("previousServers")||"").trim(),
      bannedBefore:String(f.get("bannedBefore")||""),
      banReason:String(f.get("banReason")||"").trim(),
      characterFullName:String(f.get("characterFullName")||"").trim(),
      characterAge:Number(f.get("characterAge")),
      characterDob:String(f.get("characterDob")||""),
      skinId:Number(f.get("skinId")),
      backstory,
      firstJob:String(f.get("firstJob")||""),
      rulesAccepted:true,
      accountCreated:false,
      status:"pending",
      createdAt:firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref("whitelist/"+applicationId).set(data);
    await db.ref("userApplications/"+currentUser.uid+"/"+applicationId).set(true);
    $("#wlStatus").textContent="Whitelist application submitted successfully. An admin will review it.";
    e.target.reset();
    if($("#backstoryWords")) $("#backstoryWords").textContent="0";
    loadMyApplication();
  }catch(err){
    console.error(err);
    const messages={LOGIN_REQUIRED:"Please login again and retry.",INVALID_LOGIN:"Your login session expired. Please login again."};
    $("#wlStatus").textContent=messages[err.message]||err.message||"Submission failed.";
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||"Submit Whitelist Application";}
  }
};

async function loadMyApplication(){
  if(!currentUser)return;
  const linkSnap=await db.ref("userApplications/"+currentUser.uid).once("value");
  const ids=Object.keys(linkSnap.val()||{});
  if(!ids.length){$("#myApplication").textContent="No application submitted yet.";return}
  const apps=await Promise.all(ids.map(id=>db.ref("whitelist/"+id).once("value").then(s=>({id,...s.val()}))));
  apps.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const a=apps[0];
  $("#myApplication").innerHTML=`<p><b>${esc(a.serverUsername||a.inGameName||"Application")}</b></p><span class="status-badge status-${a.status}">${String(a.status).toUpperCase()}</span>${a.accountCreated?`<p>Server Account: <b>${esc(a.serverUsername||"")}</b> &nbsp; UID: <b>${esc(a.serverUid||"")}</b></p>`:""}${a.adminNote?`<p>Admin note: ${esc(a.adminNote)}</p>`:""}`;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
