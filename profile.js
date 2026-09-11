
function applyVerifiedVipStyle(profile){
  const v=profile?.verified===true;
  document.body.classList.toggle("verified-vip-profile",v);
  const b=document.getElementById("vipBadge");
  if(b) b.classList.toggle("hidden",!v);
  const a=document.getElementById("profilePhoto")||
          document.getElementById("profileAvatar")||
          document.querySelector(".profile-avatar img")||
          document.querySelector(".profile-photo img");
  if(a){
    a.classList.toggle("verified-vip-avatar",v);
  }
}
const $=s=>document.querySelector(s);
let currentUser=null,currentProfile=null,googlePhoto="";

auth.onAuthStateChanged(async user=>{
  if(!user){ location.href="login.html"; return; }

  currentUser=user;

  // Show Google/Firebase profile immediately while database profile loads.
  const quickName=user.displayName||"Player";
  $("#profileName").textContent=quickName;
  $("#profileEmail").textContent=user.email||"";
  setAvatar(user.photoURL||"",quickName);

  const ban=await getBanState(user);
  if(ban.banned){
    showNotice("Your Infinity Role Play account is banned."+ (ban.banReason ? " Reason: "+ban.banReason : ""),"Account Banned","danger");
    await auth.signOut();
    location.href="login.html";
    return;
  }

  currentProfile=await ensureInfinityUser(user);
  applyVerifiedVipStyle(currentProfile);
  googlePhoto=user.providerData?.find(p=>p.providerId==="google.com")?.photoURL || "";

  const displayName=currentProfile.displayName||user.displayName||"Player";
  const photoURL=currentProfile.photoURL||user.photoURL||"";

  $("#profileName").textContent=displayName;
  if(currentProfile.verified===true) $("#profileVerifiedBadge").classList.remove("hidden"); else $("#profileVerifiedBadge").classList.add("hidden");
  $("#profileEmail").textContent=user.email||"";
  $("#profileInfinityId").textContent=currentProfile.infinityId||makeInfinityId(user.uid);
  $("#displayNameInput").value=displayName;
  setAvatar(photoURL,displayName);
});

$("#profileForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser)return;

  const displayName=$("#displayNameInput").value.trim()||"Player";
  try{
    await currentUser.updateProfile({displayName});
    await db.ref("users/"+currentUser.uid).update({
      displayName,
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    });
    currentProfile.displayName=displayName;
    $("#profileName").textContent=displayName;
    showNotice("Profile name updated successfully.","Profile Updated","success");
  }catch(err){ showNotice(err.message,"Error","danger"); }
};

$("#profilePhotoInput").addEventListener("change",async e=>{
  const file=e.target.files && e.target.files[0];
  if(!file||!currentUser)return;

  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
    $("#profileUploadStatus").textContent="Please choose JPG, PNG or WEBP.";
    e.target.value="";
    return;
  }
  if(file.size>5*1024*1024){
    $("#profileUploadStatus").textContent="Image is too large. Maximum size is 5 MB.";
    e.target.value="";
    return;
  }

  const ban=await getBanState(currentUser);
  if(ban.banned){
    $("#profileUploadStatus").textContent="Your account is banned.";
    return;
  }

  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const ref=storage.ref(`profilePhotos/${currentUser.uid}/avatar.${ext}`);
  const task=ref.put(file,{contentType:file.type});

  $("#profileUploadStatus").textContent="Uploading...";
  task.on("state_changed",
    snap=>{
      const p=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
      $("#profileUploadBar").style.width=p+"%";
      $("#profileUploadStatus").textContent=`Uploading ${p}%`;
    },
    err=>{
      $("#profileUploadStatus").textContent=err.message;
      $("#profileUploadBar").style.width="0%";
    },
    async()=>{
      try{
        const photoURL=await task.snapshot.ref.getDownloadURL();
        await currentUser.updateProfile({photoURL});
        await db.ref("users/"+currentUser.uid).update({
          photoURL,
          updatedAt:firebase.database.ServerValue.TIMESTAMP
        });
        currentProfile.photoURL=photoURL;
        setAvatar(photoURL,currentProfile.displayName);
        $("#profileUploadStatus").textContent="Profile photo updated successfully.";
        $("#profileUploadBar").style.width="100%";
      }catch(err){
        $("#profileUploadStatus").textContent=err.message;
      }
    }
  );
});

$("#resetGooglePhotoBtn").onclick=async()=>{
  if(!googlePhoto){
    showNotice("No Google profile photo found for this account.","Photo Not Found","info");
    return;
  }
  try{
    await currentUser.updateProfile({photoURL:googlePhoto});
    await db.ref("users/"+currentUser.uid).update({
      photoURL:googlePhoto,
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    });
    currentProfile.photoURL=googlePhoto;
    setAvatar(googlePhoto,currentProfile.displayName);
    showNotice("Google profile photo restored.","Profile Updated","success");
  }catch(err){ showNotice(err.message,"Error","danger"); }
};

function setAvatar(url,name){
  $("#profileAvatar").src=url||`https://ui-avatars.com/api/?name=${encodeURIComponent(name||"User")}&background=111827&color=ffffff`;
}

// ===== Daily SA-MP Reward: 100 eCoin =====
const rewardEls = {
  linkArea: document.getElementById("serverLinkArea"),
  linkedArea: document.getElementById("linkedRewardArea"),
  linkStatus: document.getElementById("rewardLinkStatus"),
  usernameInput: document.getElementById("serverUsernameInput"),
  linkBtn: document.getElementById("linkServerAccountBtn"),
  claimBtn: document.getElementById("claimDailyRewardBtn"),
  name: document.getElementById("linkedServerName"),
  uid: document.getElementById("linkedServerUid"),
  ecoin: document.getElementById("serverEcoinBalance"),
  cash: document.getElementById("serverCashBalance"),
  message: document.getElementById("dailyRewardMessage")
};

function rewardErrorMessage(code){
  const map={
    LOGIN_REQUIRED:"Please login again.",
    INVALID_LOGIN:"Your login session expired. Please login again.",
    INVALID_SERVER_ACCOUNT:"Enter a valid SA-MP username.",
    SERVER_ACCOUNT_NOT_FOUND:"Server account not found. Check your SA-MP username.",
    SERVER_ACCOUNT_ALREADY_LINKED:"This SA-MP account is already linked to another website account.",
    WEBSITE_ACCOUNT_ALREADY_LINKED:"Your website account is already linked to a different SA-MP account.",
    SERVER_ACCOUNT_NOT_LINKED:"Link your SA-MP account first.",
    ALREADY_CLAIMED_TODAY:"You already claimed today's reward.",
    INVALID_CONVERT_AMOUNT:"Enter a valid eCoin amount.",
    NOT_ENOUGH_ECOIN:"You do not have enough eCoin.",
    SERVER_MISSING_DB_HOST:"Database connection is not configured on Netlify.",
    SERVER_MISSING_DB_USER:"Database connection is not configured on Netlify.",
    SERVER_MISSING_DB_PASSWORD:"Database connection is not configured on Netlify.",
    SERVER_MISSING_DB_NAME:"Database connection is not configured on Netlify."
  };
  return map[code]||code||"Reward service error.";
}

async function rewardApi(action, extra={}){
  if(!currentUser) throw new Error("LOGIN_REQUIRED");
  const token=await currentUser.getIdToken();
  const res=await fetch("/api/daily-reward",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify({action,...extra})
  });
  let data={};
  try{data=await res.json();}catch{}
  if(!res.ok||!data.ok){
    const err=new Error(data.error||"REWARD_API_ERROR");
    err.data=data;
    throw err;
  }
  return data;
}

function renderRewardStatus(data){
  if(!rewardEls.linkArea)return;
  if(!data.linked){
    rewardEls.linkArea.classList.remove("hidden");
    rewardEls.linkedArea.classList.add("hidden");
    rewardEls.linkStatus.textContent="Server account not linked";
    return;
  }
  rewardEls.linkArea.classList.add("hidden");
  rewardEls.linkedArea.classList.remove("hidden");
  rewardEls.name.textContent=data.account?.username||"Player";
  rewardEls.uid.textContent="UID: "+(data.account?.uid??"-");
  rewardEls.ecoin.textContent=Number(data.account?.ecoin||0).toLocaleString();
  rewardEls.cash.textContent="$"+Number(data.account?.cash||0).toLocaleString();
  if(typeof syncConvertBalance==="function") syncConvertBalance(data.account?.ecoin||0);
  window.dispatchEvent(new Event("ecoin-balance-changed"));
  rewardEls.claimBtn.disabled=!!data.claimedToday;
  if(data.claimedToday){
    rewardEls.claimBtn.textContent="CLAIMED TODAY ✓";
    rewardEls.message.textContent="Reward claimed. Come back tomorrow after 12:00 AM Sri Lanka time.";
  }else{
    rewardEls.claimBtn.textContent="CLAIM DAILY REWARD";
    rewardEls.message.textContent="Ready to claim: +100 eCoin. Convert it to server cash whenever you want.";
  }
}

async function loadDailyRewardStatus(){
  if(!currentUser||!rewardEls.linkArea)return;
  try{
    rewardEls.message && (rewardEls.message.textContent="Checking reward status...");
    const data=await rewardApi("status");
    renderRewardStatus(data);
  }catch(err){
    const msg=rewardErrorMessage(err.message);
    if(rewardEls.message)rewardEls.message.textContent=msg;
    if(rewardEls.linkStatus)rewardEls.linkStatus.textContent=msg;
  }
}

if(rewardEls.linkBtn){
  rewardEls.linkBtn.addEventListener("click",async()=>{
    const username=rewardEls.usernameInput.value.trim();
    rewardEls.linkBtn.disabled=true;
    rewardEls.linkBtn.textContent="LINKING...";
    try{
      const data=await rewardApi("link",{username});
      showNotice("SA-MP account linked successfully.","Account Linked","success");
      await loadDailyRewardStatus();
    }catch(err){
      showNotice(rewardErrorMessage(err.message),"Link Failed","danger");
    }finally{
      rewardEls.linkBtn.disabled=false;
      rewardEls.linkBtn.textContent="Link Server Account";
    }
  });
}

if(rewardEls.claimBtn){
  rewardEls.claimBtn.addEventListener("click",async()=>{
    rewardEls.claimBtn.disabled=true;
    rewardEls.claimBtn.textContent="CLAIMING...";
    try{
      const data=await rewardApi("claim");
      showNotice("100 eCoin added to your SA-MP account!","Daily Reward Claimed","success");
      renderRewardStatus({...data,linked:true,claimedToday:true});
    }catch(err){
      showNotice(rewardErrorMessage(err.message),"Claim Failed","danger");
      await loadDailyRewardStatus();
    }
  });
}

// Current Firebase user is set by the main auth listener above.
auth.onAuthStateChanged(user=>{
  if(user) setTimeout(loadDailyRewardStatus,150);
});


// ===== eCoin -> Server Cash conversion =====
const convertEls={
  available:document.getElementById("convertAvailableEcoin"),
  input:document.getElementById("convertEcoinInput"),
  allBtn:document.getElementById("convertAllEcoinBtn"),
  btn:document.getElementById("convertEcoinBtn"),
  preview:document.getElementById("convertCashPreview"),
  message:document.getElementById("convertEcoinMessage")
};
let currentServerEcoin=0;

function syncConvertBalance(value){
  currentServerEcoin=Math.max(0,Number(value||0));
  if(convertEls.available) convertEls.available.textContent=currentServerEcoin.toLocaleString();
  updateConvertPreview();
}

function updateConvertPreview(){
  if(!convertEls.preview)return;
  const amount=Math.max(0,Math.floor(Number(convertEls.input?.value||0)));
  convertEls.preview.textContent="$"+(amount*10).toLocaleString();
}
if(convertEls.input) convertEls.input.addEventListener("input",updateConvertPreview);
if(convertEls.allBtn) convertEls.allBtn.addEventListener("click",()=>{
  if(convertEls.input){convertEls.input.value=String(currentServerEcoin||"");updateConvertPreview();}
});
if(convertEls.btn) convertEls.btn.addEventListener("click",async()=>{
  const amount=Math.floor(Number(convertEls.input?.value||0));
  if(!amount||amount<1){showNotice("Enter the eCoin amount you want to convert.","eCoin Exchange","danger");return;}
  convertEls.btn.disabled=true;convertEls.btn.textContent="CONVERTING...";
  try{
    const data=await rewardApi("convert",{amount});
    const cash=Number(data.conversion?.cash||0);
    showNotice(`${amount.toLocaleString()} eCoin converted to $${cash.toLocaleString()} server cash.`,"eCoin Converted","success");
    if(convertEls.message) convertEls.message.textContent=`Success: ${amount.toLocaleString()} eCoin → $${cash.toLocaleString()} server cash.`;
    if(convertEls.input) convertEls.input.value="";
    if(rewardEls.ecoin) rewardEls.ecoin.textContent=Number(data.account?.ecoin||0).toLocaleString();
    if(rewardEls.cash) rewardEls.cash.textContent="$"+Number(data.account?.cash||0).toLocaleString();
    syncConvertBalance(data.account?.ecoin||0);
    window.dispatchEvent(new Event("ecoin-balance-changed"));
  }catch(err){
    const msg=rewardErrorMessage(err.message);
    if(convertEls.message) convertEls.message.textContent=msg;
    showNotice(msg,"eCoin Exchange Failed","danger");
    await loadDailyRewardStatus();
  }finally{convertEls.btn.disabled=false;convertEls.btn.textContent="CONVERT";updateConvertPreview();}
});

