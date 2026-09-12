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

async function createServerAccount(payload){
  const token=await currentUser.getIdToken(true);
  const r=await fetch("/api/whitelist-account",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify(payload)
  });
  let data={};
  try{data=await r.json();}catch{}
  if(!r.ok||!data.ok){
    const err=new Error(data.error||"SERVER_ACCOUNT_CREATE_FAILED");
    err.details=data;
    throw err;
  }
  return data;
}

$("#whitelistForm").onsubmit=async e=>{
  e.preventDefault();
  if(!whitelistOpen){ $("#wlStatus").textContent="Whitelist applications are currently closed."; return; }
  if(!currentUser){ location.href="login.html"; return; }

  const f=new FormData(e.target);
  const accountPassword=String(f.get("accountPassword")||"");
  const confirmAccountPassword=String(f.get("confirmAccountPassword")||"");
  if(accountPassword!==confirmAccountPassword){
    $("#wlStatus").textContent="RP Account Passwords do not match. Please type the same password twice.";
    e.target.querySelector('[name="confirmAccountPassword"]')?.focus();
    return;
  }

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
  if(btn){btn.disabled=true;btn.textContent="Creating Server Account...";}
  $("#wlStatus").textContent="Creating your SA-MP account securely...";

  try{
    const account=await createServerAccount({
      action:"create",
      applicationId,
      inGameName:String(f.get("inGameName")||"").trim(),
      password:accountPassword,
      characterAge:Number(f.get("characterAge")),
      skinId:Number(f.get("skinId"))
    });

    const data={
      uid:currentUser.uid,
      email:currentUser.email||"",
      displayName:currentProfile?.displayName||currentUser.displayName||"User",
      infinityId:currentProfile?.infinityId||makeInfinityId(currentUser.uid),
      discord:String(f.get("discord")||"").trim(),
      inGameName:String(f.get("inGameName")||"").trim(),
      serverUsername:account.account?.username||normalizeServerName(f.get("inGameName")),
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
      accountCreated:true,
      accountAlreadyLinked:account.alreadyLinked===true,
      serverUid:Number(account.account?.uid||0),
      status:"pending",
      createdAt:firebase.database.ServerValue.TIMESTAMP
    };

    // Never store the RP account password in Firebase.
    await db.ref("whitelist/"+applicationId).set(data);
    await db.ref("userApplications/"+currentUser.uid+"/"+applicationId).set(true);
    $("#wlStatus").textContent=`Submitted successfully. Server account ${data.serverUsername} (UID ${data.serverUid}) is ready.`;
    e.target.reset();
    if($("#backstoryWords")) $("#backstoryWords").textContent="0";
    loadMyApplication();
  }catch(err){
    console.error(err);
    const messages={
      INVALID_SERVER_NAME:"In-Game Name is invalid. Use a realistic name such as John Carter or John_Carter.",
      SERVER_USERNAME_EXISTS:"That In-Game Name already exists on the SA-MP server. Choose another name.",
      WEBSITE_ACCOUNT_ALREADY_LINKED:"Your website account is already linked to a different SA-MP account.",
      INVALID_PASSWORD:"RP account password must be 6-64 characters.",
      INVALID_SKIN_ID:"Character Skin ID must be between 0 and 311.",
      INVALID_CHARACTER_AGE:"Character age must be between 18 and 100.",
      SERVER_ACCOUNT_CREATE_FAILED:"Could not create the SA-MP account. Please contact an admin.",
      LOGIN_REQUIRED:"Please login again and retry.",
      INVALID_LOGIN:"Your login session expired. Please login again."
    };
    $("#wlStatus").textContent=messages[err.message]||err.message||"Submission failed.";
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||"Submit Whitelist & Create Account";}
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
