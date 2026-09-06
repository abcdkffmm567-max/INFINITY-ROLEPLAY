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
  if(user){
    const [prof,admin]=await Promise.all([db.ref("users/"+user.uid).once("value"),db.ref("admins/"+user.uid).once("value")]);
    currentProfile=prof.val()||{displayName:user.displayName||"User",email:user.email,photoURL:user.photoURL||""}; if(!currentProfile.photoURL && user.photoURL) currentProfile.photoURL=user.photoURL;
    currentProfile.isAdmin=admin.val()===true;
    const loginBtn=$("#loginNavBtn"), registerBtn=$("#registerNavBtn"), profileBtn=$("#profileNavBtn"), logoutBtn=$("#logoutNavBtn");
    if(loginBtn) loginBtn.classList.add("hidden");
    if(registerBtn) registerBtn.classList.add("hidden");
    if(profileBtn) profileBtn.classList.remove("hidden");
    if(logoutBtn){ logoutBtn.classList.remove("hidden"); logoutBtn.textContent="Logout"; logoutBtn.onclick=()=>auth.signOut(); }
    $("#chatInput").placeholder="Type a message...";

  }else{
    currentProfile=null;
    const loginBtn=$("#loginNavBtn"), registerBtn=$("#registerNavBtn"), profileBtn=$("#profileNavBtn"), logoutBtn=$("#logoutNavBtn");
    if(loginBtn) loginBtn.classList.remove("hidden");
    if(registerBtn) registerBtn.classList.remove("hidden");
    if(profileBtn) profileBtn.classList.add("hidden");
    if(logoutBtn) logoutBtn.classList.add("hidden");
    $("#chatInput").placeholder="Login to send a message...";
  }
});


db.ref("chat").limitToLast(100).on("value",snap=>{
  const box=$("#chatMessages");box.innerHTML="";
  Object.entries(snap.val()||{}).forEach(([id,m])=>box.insertAdjacentHTML("beforeend",messageHtml(m)));
  box.scrollTop=box.scrollHeight;
});
$("#chatForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser){location.href="login.html";return}
  const text=$("#chatInput").value.trim();if(!text)return;
  const isAdmin=(await db.ref("admins/"+currentUser.uid).once("value")).val()===true;
  await db.ref("chat").push().set({uid:currentUser.uid,name:currentProfile?.displayName||currentUser.displayName||"User",photoURL:currentProfile?.photoURL||currentUser.photoURL||"",text,isAdmin,createdAt:firebase.database.ServerValue.TIMESTAMP});
  $("#chatInput").value="";
};
function messageHtml(m){
 const mine=currentUser&&m.uid===currentUser.uid?" mine":"";
 const avatar=m.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name||"User")}&background=111827&color=ffffff`;
 return `<div class="msg${mine}"><div class="msg-row"><img class="chat-avatar" src="${escAttr(avatar)}" alt=""><div class="msg-body"><div class="msg-head">${esc(m.name||"User")}${m.isAdmin?'<span class="verified" title="Verified Admin">✓</span>':""}<small>${fmt(m.createdAt)}</small></div><p>${esc(m.text||"")}</p></div></div></div>`
}
function fmt(t){return t?new Date(t).toLocaleString():"now"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function escAttr(v){return esc(v)}
