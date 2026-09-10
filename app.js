
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

    if(currentProfile?.chatMuted===true){ showNotice("You are muted from Live Chat.","Live Chat","danger"); return; }
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
 return `<div class="msg${mine}"><div class="msg-row"><img class="chat-avatar ${m.verified===true ? "verified-chat-avatar" : ""}" src="${escAttr(avatar)}" alt=""><div class="msg-body"><div class="msg-head">${esc(m.name||"User")}${(m.isAdmin||m.verified)?'<span class="verified" title="'+(m.isAdmin?"Verified Admin":"Verified User")+'">✓</span>':""}<small>${fmt(m.createdAt)}</small></div><p>${esc(m.text||"")}</p></div></div></div>`
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


// Server IP display
(function(){
  const ipEl=document.getElementById("serverIpText");
  const copyBtn=document.getElementById("serverIpCopyBtn");
  if(!ipEl)return;

  const DEFAULT_IP="51.68.107.75:11999";
  ipEl.textContent=DEFAULT_IP;

  if(typeof db!=="undefined"){
    db.ref("settings/serverIp").on("value",snap=>{
      const value=String(snap.val()||"").trim();
      ipEl.textContent=value||DEFAULT_IP;
    },err=>{
      console.warn("Could not load server IP from Firebase:",err);
      ipEl.textContent=DEFAULT_IP;
    });
  }

  if(copyBtn){
    copyBtn.onclick=async()=>{
      const ip=ipEl.textContent.trim();
      try{
        await navigator.clipboard.writeText(ip);
        if(typeof showNotice==="function"){
          showNotice(ip+" copied to clipboard.","Server IP Copied","success");
        }else{
          copyBtn.textContent="Copied!";
          setTimeout(()=>copyBtn.textContent="Copy IP",1200);
        }
      }catch(err){
        const ta=document.createElement("textarea");
        ta.value=ip; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
        copyBtn.textContent="Copied!";
        setTimeout(()=>copyBtn.textContent="Copy IP",1200);
      }
    };
  }
})();


const heroCopyBtn=document.getElementById("copyIpBtn");
if(heroCopyBtn){
  heroCopyBtn.onclick=async()=>{
    const ip=(document.getElementById("serverIpText")?.textContent||"51.68.107.75:11999").trim();
    try{
      await navigator.clipboard.writeText(ip);
      if(typeof showNotice==="function") showNotice(ip+" copied to clipboard.","Server IP Copied","success");
    }catch(e){}
  };
}


let releaseCountdownTimer=null;
function startReleaseCountdown(cfg){
  const section=document.getElementById("releaseCountdownSection");
  if(!section)return;
  if(releaseCountdownTimer){clearInterval(releaseCountdownTimer);releaseCountdownTimer=null;}
  if(!cfg || cfg.enabled===false || !cfg.timestamp){
    section.classList.add("hidden");
    return;
  }
  const target=Number(cfg.timestamp);
  if(!Number.isFinite(target)){section.classList.add("hidden");return;}
  section.classList.remove("hidden");

  const dateEl=document.getElementById("releaseCountdownDate");
  if(dateEl) dateEl.textContent="Release: "+new Date(target).toLocaleString();

  const tick=()=>{
    let diff=target-Date.now();
    if(diff<=0){
      document.getElementById("cdDays").textContent="00";
      document.getElementById("cdHours").textContent="00";
      document.getElementById("cdMinutes").textContent="00";
      document.getElementById("cdSeconds").textContent="00";
      if(dateEl) dateEl.textContent="SERVER RELEASED!";
      return;
    }
    const d=Math.floor(diff/86400000); diff%=86400000;
    const h=Math.floor(diff/3600000); diff%=3600000;
    const m=Math.floor(diff/60000); diff%=60000;
    const s=Math.floor(diff/1000);
    const pad=n=>String(n).padStart(2,"0");
    document.getElementById("cdDays").textContent=pad(d);
    document.getElementById("cdHours").textContent=pad(h);
    document.getElementById("cdMinutes").textContent=pad(m);
    document.getElementById("cdSeconds").textContent=pad(s);
  };
  tick();
  releaseCountdownTimer=setInterval(tick,1000);
}

db.ref("siteSettings/releaseCountdown").on("value",snap=>{
  startReleaseCountdown(snap.val()||null);
});



function normalizeExternalDownloadUrl(raw){
  let url=String(raw||"").trim();
  if(!url)return "";
  if(!/^https?:\/\//i.test(url)) url="https://"+url;
  return url;
}

function configureDownloadButton(id,url,label){
  const btn=document.getElementById(id);
  if(!btn)return;
  const normalized=normalizeExternalDownloadUrl(url);
  if(!normalized){
    btn.href="#";
    btn.classList.add("disabled");
    btn.setAttribute("aria-disabled","true");
    btn.onclick=(e)=>{e.preventDefault();showNotice(label+" download link is not configured yet.","Downloads","danger");};
    return;
  }
  btn.classList.remove("disabled");
  btn.removeAttribute("aria-disabled");
  btn.href=normalized;
  btn.target="_blank";
  btn.rel="noopener noreferrer";
  btn.onclick=(e)=>{
    e.preventDefault();
    // Use direct navigation so Android browsers/download hosts can handle APK/ZIP links.
    window.location.href=normalized;
  };
}

db.ref("siteSettings").on("value",snap=>{
  const v=snap.val()||{};
  const samp=v.sampDownloadUrl || v.sampApkUrl || v.sampUrl || "";
  const data=v.dataDownloadUrl || v.dataFileUrl || v.dataUrl || "";
  configureDownloadButton("sampDownloadBtn",samp,"SAMP App");
  configureDownloadButton("dataDownloadBtn",data,"Data File");
});

let serverGalleryImages=[],serverGalleryIndex=0,serverGalleryTimer=null;
function renderServerGallery(){const t=document.getElementById("serverGalleryTrack"),d=document.getElementById("serverGalleryDots");if(!t||!d)return;const a=serverGalleryImages.filter(Boolean).slice(0,5);if(!a.length){t.innerHTML='<div class="server-gallery-placeholder">Gallery images will appear here.</div>';d.innerHTML="";return}t.innerHTML=a.map((u,i)=>`<div class="server-gallery-slide ${i===serverGalleryIndex?"active":""}"><img src="${escAttr(u)}" alt="Gallery ${i+1}"></div>`).join("");d.innerHTML=a.map((_,i)=>`<button class="${i===serverGalleryIndex?"active":""}" onclick="goServerGallery(${i})"></button>`).join("")}
window.goServerGallery=i=>{const c=serverGalleryImages.length;if(!c)return;serverGalleryIndex=(i+c)%c;renderServerGallery()};
document.addEventListener("click",e=>{if(e.target?.id==="galleryPrevBtn")goServerGallery(serverGalleryIndex-1);if(e.target?.id==="galleryNextBtn")goServerGallery(serverGalleryIndex+1)});
db.ref("siteSettings/serverGallery").on("value",x=>{const v=x.val()||{};serverGalleryImages=[v.image1,v.image2,v.image3,v.image4,v.image5].filter(Boolean);serverGalleryIndex=0;renderServerGallery();if(serverGalleryTimer)clearInterval(serverGalleryTimer);serverGalleryTimer=setInterval(()=>{if(serverGalleryImages.length>1)goServerGallery(serverGalleryIndex+1)},4000)});
db.ref("siteSettings/trailerPhotoUrl").on("value",x=>{const u=String(x.val()||"").trim(),c=document.getElementById("trailerPhotoCard"),i=document.getElementById("trailerPhoto");if(!c||!i)return;if(u){i.src=u;c.classList.remove("hidden")}else c.classList.add("hidden")});

async function refreshLiveServerStatus(){
  if(typeof livePlayerCountEnabled!=="undefined" && !livePlayerCountEnabled)return;
  const b=document.getElementById("serverOnlineBadge"),p=document.getElementById("livePlayerCount"),m=document.getElementById("liveMaxPlayers"),g=document.getElementById("liveGameMode"),t=document.getElementById("liveServerStatusText");
  if(!b)return;
  try{
    const r=await fetch("/api/samp-status?x="+Date.now(),{cache:"no-store"}),d=await r.json();
    if(d.online){b.textContent="ONLINE";b.className="server-status-badge online";p.textContent=d.players;m.textContent=d.maxPlayers;g.textContent=d.gamemode||"Infinity Role Play";t.textContent=`${d.players} players online`;}
    else{b.textContent="OFFLINE";b.className="server-status-badge offline";p.textContent="0";m.textContent=d.maxPlayers||"--";g.textContent="Unavailable";t.textContent="Server offline or query unavailable";}
  }catch(e){b.textContent="UNAVAILABLE";b.className="server-status-badge offline";t.textContent="Could not load live player count";}
}
setInterval(refreshLiveServerStatus,15000);


/* ===== Live Player Count ON/OFF ===== */
let livePlayerCountEnabled = false;

function applyLivePlayerCountVisibility(){
  const section = document.getElementById("liveServerStatus");
  if(!section) return;
  section.classList.toggle("hidden", !livePlayerCountEnabled);
}

db.ref("siteSettings/livePlayerCountEnabled").on("value", snap=>{
  livePlayerCountEnabled = snap.val() === true;
  applyLivePlayerCountVisibility();
  if(livePlayerCountEnabled && typeof refreshLiveServerStatus === "function"){
    refreshLiveServerStatus();
  }
});




/* ===== HERO BANNER SLIDER FINAL FIX ===== */
let _heroImages = [];
let _heroIndex = 0;
let _heroTimer = null;

function _validHeroUrl(v){
  const u = String(v || "").trim();
  return /^https?:\/\//i.test(u) ? u : "";
}

function _renderHero(){
  const slider = document.getElementById("heroBannerSlider");
  if(!slider) return;

  const slides = [...slider.querySelectorAll(".hero-banner-slide")];
  if(!_heroImages.length){
    slider.style.display = "none";
    return;
  }

  slider.style.display = "block";
  slides.forEach((slide, i)=>{
    const url = _heroImages[i] || _heroImages[0];
    slide.style.backgroundImage = `url("${url.replace(/"/g,'\\"')}")`;
    slide.classList.toggle("active", i === _heroIndex);
  });
}

function _nextHero(){
  if(_heroImages.length < 2) return;
  _heroIndex = (_heroIndex + 1) % _heroImages.length;
  document.querySelectorAll("#heroBannerSlider .hero-banner-slide").forEach((slide,i)=>{
    slide.classList.toggle("active", i === _heroIndex);
  });
}

db.ref("siteSettings").on("value", snap=>{
  const v = snap.val() || {};
  const hb = v.heroBanners || {};

  _heroImages = [
    _validHeroUrl(hb.image1 || v.serverLogoUrl || v.heroBannerUrl || v.heroImageUrl),
    _validHeroUrl(hb.image2 || v.heroBanner2),
    _validHeroUrl(hb.image3 || v.heroBanner3)
  ].filter(Boolean);

  _heroIndex = 0;
  _renderHero();

  if(_heroTimer) clearInterval(_heroTimer);
  if(_heroImages.length > 1){
    _heroTimer = setInterval(_nextHero, 5000);
  }
});
