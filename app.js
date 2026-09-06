
// Fallback helpers for Live Chat/Profile initialization.
// These are only used if user-utils.js failed to load for any reason.
if(typeof window.makeInfinityId!=="function"){
  window.makeInfinityId=function(uid){
    const clean=String(uid||"USER").replace(/[^a-zA-Z0-9]/g,"").toUpperCase();
    return "INF"+clean.slice(0,8).padEnd(8,"0");
  };
}

if(typeof window.ensureInfinityUser!=="function"){
  window.ensureInfinityUser=async function(user,extra={}){
    if(!user) return null;

    const ref=db.ref("users/"+user.uid);
    const snap=await ref.once("value");
    const old=snap.val()||{};

    const updates={
      displayName:extra.displayName||user.displayName||old.displayName||"Player",
      email:extra.email||user.email||old.email||"",
      photoURL:extra.photoURL||user.photoURL||old.photoURL||"",
      infinityId:old.infinityId||window.makeInfinityId(user.uid),
      banned:old.banned===true,
      verified:old.verified===true,
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    };

    if(!old.createdAt) updates.createdAt=firebase.database.ServerValue.TIMESTAMP;
    if(extra.provider && !old.provider) updates.provider=extra.provider;

    await ref.update(updates);
    const latest=await ref.once("value");
    return latest.val()||updates;
  };
}

const $ = (s)=>document.querySelector(s);
const serverIpEl = $("#serverIp"), rulesGrid=$("#rulesGrid"), sampDownload=$("#sampDownload"), dataDownload=$("#dataDownload");
let currentUser=null, currentProfile=null;

$("#year").textContent = new Date().getFullYear();
$("#navToggle").onclick=()=>$("#navMenu").classList.toggle("open");
$("#chatToggleBtn").onclick=()=>$("#floatingChat").classList.remove("hidden");
$("#chatCloseBtn").onclick=()=>$("#floatingChat").classList.add("hidden");
$("#copyIpBtn").onclick=async()=>{await navigator.clipboard.writeText(serverIpEl.textContent.trim()); $("#copyIpBtn").textContent="Copied!"; setTimeout(()=>$("#copyIpBtn").textContent="Copy Server IP",1200)};

db.ref("settings").on("value", snap=>{
  const s=snap.val()||{};
  serverIpEl.textContent=s.serverIp||"51.68.107.75:11999";
  setDownload(sampDownload,s.sampUrl); setDownload(dataDownload,s.dataUrl);
});
function setDownload(el,url){
  if(url){
    el.href=url;
    el.target="_blank";
    el.rel="noopener noreferrer";
    el.classList.remove("disabled");
  }else{
    el.href="#";
    el.classList.add("disabled");
  }
}

db.ref("rules").on("value", snap=>{
  const rules=snap.val();
  if(!rules){ rulesGrid.innerHTML = defaultRules().map(ruleHtml).join(""); return; }
  const list=Object.entries(rules).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0));
  rulesGrid.innerHTML=list.map(ruleHtml).join("");
});
function defaultRules(){return[
  {title:"Respect Everyone",text:"No harassment, racism, hate speech, threats or toxic behavior."},
  {title:"No RDM / VDM",text:"Do not kill or attack players without a valid roleplay reason. Vehicles are not weapons without RP context."},
  {title:"No Metagaming",text:"Do not use information your character could not reasonably know in-game."},
  {title:"No Powergaming",text:"Do not force unrealistic actions on other players or perform impossible actions."},
  {title:"Stay In Character",text:"Keep roleplay situations in character and avoid unnecessary OOC disruption."},
  {title:"Follow Staff Decisions",text:"Respect staff instructions. Use the proper appeal/report system for disputes."}
]}
function ruleHtml(r,i){return `<article class="card rule-card"><span class="num">RULE ${String((r.order||i||0)+1).padStart(2,"0")}</span><h3>${esc(r.title||"Rule")}</h3><p>${esc(r.text||"")}</p></article>`}

auth.onAuthStateChanged(async user=>{
  currentUser=user;

  const loginBtn=$("#loginNavBtn");
  const registerBtn=$("#registerNavBtn");
  const profileBtn=$("#profileNavBtn");
  const logoutBtn=$("#logoutNavBtn");

  if(user){
    try{
      const profile=await ensureInfinityUser(user);
      currentProfile=profile||{};

      if(currentProfile.banned===true){
        const reason=currentProfile.banReason||"";
        if(typeof showNotice==="function"){
          showNotice("Your Infinity Role Play account is banned."+(reason ? " Reason: "+reason : ""),"Account Banned","danger");
        }
        await auth.signOut();
        return;
      }

      if(loginBtn) loginBtn.classList.add("hidden");
      if(registerBtn) registerBtn.classList.add("hidden");

      if(profileBtn){
        profileBtn.classList.remove("hidden");
        const displayName=currentProfile.displayName||user.displayName||"Profile";
        profileBtn.textContent="👤 "+displayName;
        profileBtn.href="profile.html";
      }

      if(logoutBtn){
        logoutBtn.classList.remove("hidden");
        logoutBtn.textContent="Logout";
        logoutBtn.onclick=()=>auth.signOut();
      }

      if($("#chatInput")) $("#chatInput").placeholder="Type a message...";
    }catch(err){
      console.error("Auth/profile load error:",err);

      // Even if profile DB load fails, still show Profile for a valid logged-in Firebase user.
      if(loginBtn) loginBtn.classList.add("hidden");
      if(registerBtn) registerBtn.classList.add("hidden");
      if(profileBtn){
        profileBtn.classList.remove("hidden");
        profileBtn.textContent="👤 "+(user.displayName||"Profile");
        profileBtn.href="profile.html";
      }
      if(logoutBtn){
        logoutBtn.classList.remove("hidden");
        logoutBtn.onclick=()=>auth.signOut();
      }
    }
  }else{
    currentProfile=null;

    if(loginBtn) loginBtn.classList.remove("hidden");
    if(registerBtn) registerBtn.classList.remove("hidden");
    if(profileBtn){
      profileBtn.classList.add("hidden");
      profileBtn.textContent="Profile";
    }
    if(logoutBtn) logoutBtn.classList.add("hidden");
    if($("#chatInput")) $("#chatInput").placeholder="Login to send a message...";
  }
});


db.ref("chat").limitToLast(100).on("value",snap=>{
  const box=$("#chatMessages");
  if(!box)return;
  box.innerHTML="";
  Object.entries(snap.val()||{}).forEach(([id,m])=>box.insertAdjacentHTML("beforeend",messageHtml(m)));
  box.scrollTop=box.scrollHeight;
},err=>{
  console.error("Live chat read failed:",err);
});
$("#chatForm").onsubmit=async e=>{
  e.preventDefault();

  if(!auth.currentUser){
    if(typeof showNotice==="function"){
      showNotice("Please login before sending a message.","Login Required","info");
    }
    location.href="login.html";
    return;
  }

  currentUser=auth.currentUser;
  const input=$("#chatInput");
  const text=(input?.value||"").trim();
  if(!text)return;

  input.disabled=true;
  try{
    // Make sure the user's profile exists before chat permission is checked.
    currentProfile=await window.ensureInfinityUser(currentUser);

    if(currentProfile?.banned===true){
      const reason=currentProfile.banReason||"";
      if(typeof showNotice==="function"){
        showNotice("Your account is banned and cannot use Live Chat."+(reason ? " Reason: "+reason : ""),"Chat Disabled","danger");
      }
      return;
    }

    // Admin lookup is optional for normal users. A permission error here
    // must never block a normal user's chat message.
    let isAdmin=false;
    try{
      const a=await db.ref("admins/"+currentUser.uid).once("value");
      isAdmin=a.val()===true;
    }catch(err){
      console.warn("Admin status lookup skipped:",err);
    }

    const message={
      uid:currentUser.uid,
      name:currentProfile?.displayName||currentUser.displayName||"User",
      photoURL:currentProfile?.photoURL||currentUser.photoURL||"",
      infinityId:currentProfile?.infinityId||window.makeInfinityId(currentUser.uid),
      verified:currentProfile?.verified===true,
      isAdmin,
      text,
      createdAt:firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref("chat").push().set(message);
    input.value="";
  }catch(err){
    console.error("Live chat send failed:",err);
    let msg=err.message||"Message could not be sent.";
    if(String(err.code||"").includes("PERMISSION_DENIED") || /permission/i.test(msg)){
      msg="Firebase is blocking Live Chat. Publish the included database.rules.json in Firebase Realtime Database > Rules.";
    }
    if(typeof showNotice==="function"){
      showNotice(msg,"Live Chat Error","danger");
    }
  }finally{
    input.disabled=false;
    input.focus();
  }
};
function messageHtml(m){
 const mine=currentUser&&m.uid===currentUser.uid?" mine":"";
 const avatar=m.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name||"User")}&background=111827&color=ffffff`;
 return `<div class="msg${mine}"><div class="msg-row"><img class="chat-avatar" src="${escAttr(avatar)}" alt=""><div class="msg-body"><div class="msg-head">${esc(m.name||"User")}<span class="chat-user-id">${esc(m.infinityId||"")}</span>${(m.isAdmin||m.verified)?'<span class="verified" title="'+(m.isAdmin?"Verified Admin":"Verified User")+'">✓</span>':""}<small>${fmt(m.createdAt)}</small></div><p>${esc(m.text||"")}</p></div></div></div>`
}
function fmt(t){return t?new Date(t).toLocaleString():"now"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function escAttr(v){return esc(v)}


// Logged-in profile icon in mobile/desktop navigation
auth.onAuthStateChanged(async user=>{
  const iconBtn=document.getElementById("profileIconBtn");
  const iconImg=document.getElementById("profileIconImg");
  const fallback=document.getElementById("profileIconFallback");
  const loginBtn=document.getElementById("loginNavBtn");
  const registerBtn=document.getElementById("registerNavBtn");
  const logoutBtn=document.getElementById("logoutNavBtn");

  if(user){
    if(loginBtn) loginBtn.classList.add("hidden");
    if(registerBtn) registerBtn.classList.add("hidden");
    if(iconBtn) iconBtn.classList.remove("hidden");
    if(logoutBtn){
      logoutBtn.classList.remove("hidden");
      logoutBtn.onclick=()=>auth.signOut();
    }

    let photo=user.photoURL||"";
    try{
      const snap=await db.ref("users/"+user.uid).once("value");
      const data=snap.val()||{};
      if(data.photoURL) photo=data.photoURL;
    }catch(err){
      console.warn("Could not load profile image from DB:",err);
    }

    if(iconImg){
      if(photo){
        iconImg.src=photo;
        iconImg.classList.remove("hidden");
        if(fallback) fallback.classList.add("hidden");
      }else{
        iconImg.removeAttribute("src");
        iconImg.classList.add("hidden");
        if(fallback) fallback.classList.remove("hidden");
      }
    }
  }else{
    if(iconBtn) iconBtn.classList.add("hidden");
    if(loginBtn) loginBtn.classList.remove("hidden");
    if(registerBtn) registerBtn.classList.remove("hidden");
    if(logoutBtn) logoutBtn.classList.add("hidden");
  }
});
