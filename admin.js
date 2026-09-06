const $=s=>document.querySelector(s);
let adminUser={uid:"local-admin",displayName:"Infinity Admin",photoURL:""};
let allApps={};
let allUsers={};
let dashboardStarted=false;

const ADMIN_USERNAME="infinityadmin";
const ADMIN_PASSWORD="Infinity@11999";

function openAdminDashboard(){
  $("#adminLoginCard").classList.add("hidden");
  $("#adminDashboard").classList.remove("hidden");
  try{ startDashboard(); }
  catch(err){
    console.error("Dashboard data error:",err);
    if($("#settingsStatus")) $("#settingsStatus").textContent="Dashboard opened. Firebase data could not be loaded: "+err.message;
  }
}

$("#adminLoginForm").onsubmit=e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const username=String(f.get("username")||"").trim();
  const password=String(f.get("password")||"");

  if(username===ADMIN_USERNAME && password===ADMIN_PASSWORD){
    sessionStorage.setItem("infinityAdminLoggedIn","1");
    $("#adminLoginStatus").textContent="";
    openAdminDashboard();
  }else{
    $("#adminLoginStatus").textContent="Invalid username or password.";
  }
};

if(sessionStorage.getItem("infinityAdminLoggedIn")==="1"){
  openAdminDashboard();
}

$("#adminLogout").onclick=()=>{
  sessionStorage.removeItem("infinityAdminLoggedIn");
  location.reload();
};

function startDashboard(){
 if(dashboardStarted)return;
 dashboardStarted=true;
 db.ref("settings").on("value",s=>{
   const v=s.val()||{};
   $("#adminServerIp").value=v.serverIp||"51.68.107.75:11999";
   $("#sampUrl").value=v.sampUrl||"";
   $("#dataUrl").value=v.dataUrl||"";
   if($("#serverLogoUrl")) $("#serverLogoUrl").value=v.serverLogoUrl||"";
   if($("#heroBannerUrl")) $("#heroBannerUrl").value=v.heroBannerUrl||"";
   if($("#communityBannerUrl")) $("#communityBannerUrl").value=v.communityBannerUrl||"";
   if($("#communityBannerClickUrl")) $("#communityBannerClickUrl").value=v.communityBannerClickUrl||"";
 });
 $("#serverSettingsForm").onsubmit=async e=>{
   e.preventDefault();
   const serverIp=$("#adminServerIp").value.trim();
   const sampUrl=$("#sampUrl").value.trim();
   const dataUrl=$("#dataUrl").value.trim();
   const serverLogoUrl=$("#serverLogoUrl") ? $("#serverLogoUrl").value.trim() : "";
   const heroBannerUrl=$("#heroBannerUrl") ? $("#heroBannerUrl").value.trim() : "";
   const communityBannerUrl=$("#communityBannerUrl") ? $("#communityBannerUrl").value.trim() : "";
   const communityBannerClickUrl=$("#communityBannerClickUrl") ? $("#communityBannerClickUrl").value.trim() : "";
   try{
     await db.ref("settings").update({serverIp,sampUrl,dataUrl,serverLogoUrl,heroBannerUrl,communityBannerUrl,communityBannerClickUrl});
     $("#settingsStatus").textContent="Saved successfully.";
     setTimeout(()=>$("#settingsStatus").textContent="",2000);
   }catch(err){
     $("#settingsStatus").textContent=err.message;
   }
 };
 db.ref("rules").on("value",renderRules);
 db.ref("whitelist").on("value",s=>{allApps=s.val()||{};renderApps();updateStats()});
 db.ref("publicUsers").on("value",s=>{
   allUsers=s.val()||{};
   $("#userCount").textContent=s.numChildren();
   renderUsersManagement();
 });
 db.ref("chat").limitToLast(100).on("value",renderAdminChat);
}
function renderRules(snap){
 const box=$("#rulesAdmin"), rules=snap.val()||{};box.innerHTML="";
 const entries=Object.entries(rules).sort((a,b)=>(a[1].order||0)-(b[1].order||0));
 if(!entries.length){seedRules();return}
 entries.forEach(([id,r])=>box.insertAdjacentHTML("beforeend",`<div class="rule-editor"><input data-k="${id}" data-f="title" value="${escAttr(r.title||"")}"><textarea data-k="${id}" data-f="text">${esc(r.text||"")}</textarea><button class="btn danger small" onclick="deleteRule('${id}')">Delete</button></div>`));
 box.querySelectorAll("input,textarea").forEach(el=>el.onchange=()=>db.ref(`rules/${el.dataset.k}/${el.dataset.f}`).set(el.value));
}
$("#addRuleBtn").onclick=async()=>{const s=await db.ref("rules").once("value");const count=s.numChildren();await db.ref("rules").push({title:"New Rule",text:"Write rule description here.",order:count})};
async function seedRules(){const defs=[
 {title:"Respect Everyone",text:"No harassment, racism, hate speech, threats or toxic behavior.",order:0},
 {title:"No RDM / VDM",text:"Do not kill or attack players without a valid roleplay reason.",order:1},
 {title:"No Metagaming",text:"Do not use out-of-character information in character.",order:2},
 {title:"No Powergaming",text:"Do not force unrealistic actions or impossible outcomes.",order:3},
 {title:"Stay In Character",text:"Keep roleplay situations in character whenever possible.",order:4},
 {title:"Follow Staff Decisions",text:"Respect staff instructions and use proper appeals for disputes.",order:5}
 ];const obj={};defs.forEach(x=>obj[db.ref("rules").push().key]=x);await db.ref("rules").set(obj)}
window.deleteRule=id=>{if(confirm("Delete this rule?"))db.ref("rules/"+id).remove()};


function renderUsersManagement(){
 const box=$("#usersManagementList");
 if(!box)return;
 const q=($("#userSearch")?.value||"").trim().toLowerCase();
 const users=Object.entries(allUsers).map(([uid,u])=>({uid,...u}))
   .filter(u=>!q||[u.displayName,u.email,u.infinityId].some(v=>String(v||"").toLowerCase().includes(q)))
   .sort((a,b)=>String(a.displayName||"").localeCompare(String(b.displayName||"")));

 if(!users.length){box.innerHTML="<p>No users found.</p>";return}

 box.innerHTML=users.map(u=>{
   const avatar=u.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName||"User")}&background=111827&color=ffffff`;
   const id=u.infinityId||("INF"+String(u.uid).replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(0,8));
   const banned=u.banned===true;
   return `<article class="admin-user-card">
     <img class="admin-user-avatar" src="${escAttr(avatar)}" alt="">
     <div class="admin-user-info">
       <div class="admin-user-name">${esc(u.displayName||"User")}${u.verified===true?'<span class="verified" title="Verified User">✓</span>':""}</div>
       <div class="infinity-id-badge small">${esc(id)}</div>
       <small>${esc(u.infinityId||"Registered User")}</small>
       ${banned?`<div class="ban-reason">BANNED${u.banReason?": "+esc(u.banReason):""}</div>`:'<div class="active-user-status">ACTIVE</div>'}
     </div>
     <div class="admin-user-actions">
       ${u.verified===true
         ? `<button class="btn ghost small" onclick="removeVerified('${u.uid}')">Remove Verified</button>`
         : `<button class="btn primary small" onclick="giveVerified('${u.uid}')">Give Verified</button>`}
       ${banned
         ? `<button class="btn success small" onclick="unbanUser('${u.uid}')">Unban</button>`
         : `<button class="btn danger small" onclick="banUser('${u.uid}')">Ban</button>`}
     </div>
   </article>`;
 }).join("");
}

if($("#userSearch")) $("#userSearch").oninput=renderUsersManagement;


window.giveVerified=async uid=>{
 const user=allUsers[uid]||{};
 if(!confirm(`Give verified blue badge to ${user.displayName||user.infinityId||"this user"}?`))return;
 try{
   await db.ref("users/"+uid).update({
     verified:true,
     verifiedAt:firebase.database.ServerValue.TIMESTAMP,
     verifiedBy:"Infinity Admin"
   });
   showNotice("Verified blue badge added successfully.","Verified","success");
 }catch(err){showNotice("Could not add verified badge: "+err.message,"Error","danger")}
};

window.removeVerified=async uid=>{
 const user=allUsers[uid]||{};
 if(!confirm(`Remove verified badge from ${user.displayName||user.infinityId||"this user"}?`))return;
 try{
   await db.ref("users/"+uid).update({
     verified:false,
     verifiedAt:null,
     verifiedBy:null
   });
   showNotice("Verified blue badge removed.","Updated","success");
 }catch(err){showNotice("Could not remove verified badge: "+err.message,"Error","danger")}
};

window.banUser=async uid=>{
 const user=allUsers[uid]||{};
 const reason=prompt(`Ban ${user.displayName||"this user"} - reason:`,`Rule violation`);
 if(reason===null)return;
 if(!confirm(`Ban ${user.displayName||user.infinityId||"this user"}?`))return;
 try{
   await db.ref("users/"+uid).update({
     banned:true,
     banReason:reason.trim(),
     bannedAt:firebase.database.ServerValue.TIMESTAMP,
     bannedBy:"Infinity Admin"
   });
 }catch(err){alert("Ban failed: "+err.message)}
};

window.unbanUser=async uid=>{
 const user=allUsers[uid]||{};
 if(!confirm(`Unban ${user.displayName||user.infinityId||"this user"}?`))return;
 try{
   await db.ref("users/"+uid).update({
     banned:false,
     banReason:null,
     bannedAt:null,
     bannedBy:null,
     unbannedAt:firebase.database.ServerValue.TIMESTAMP
   });
 }catch(err){alert("Unban failed: "+err.message)}
};

$("#filterApps").onchange=renderApps;
function renderApps(){
 const filter=$("#filterApps").value,box=$("#applicationsList");box.innerHTML="";
 const entries=Object.entries(allApps).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).filter(a=>filter==="all"||a.status===filter);
 if(!entries.length){box.innerHTML="<p>No applications found.</p>";return}
 entries.forEach(a=>box.insertAdjacentHTML("beforeend",appHtml(a)));
}
function appHtml(a){return `<article class="application-card">
 <div class="section-row"><div><h3>${esc(a.rpName||"Unknown")}</h3><div class="application-meta"><span>${esc(a.realName||"")}</span><span>Age: ${esc(a.age||"")}</span><span>${esc(a.discord||"")}</span><span>${fmt(a.createdAt)}</span></div></div><span class="status-badge status-${a.status}">${String(a.status||"pending").toUpperCase()}</span></div>
 <div class="answers"><div class="answer"><b>Why join?</b>${esc(a.reason||"")}</div><div class="answer"><b>What is Roleplay?</b>${esc(a.rpExplain||"")}</div><div class="answer"><b>RDM / VDM / MG example</b>${esc(a.scenario||"")}</div></div>
 <div class="app-actions"><button class="btn success small" onclick="setAppStatus('${a.id}','accepted')">Accept</button><button class="btn danger small" onclick="setAppStatus('${a.id}','rejected')">Reject</button><button class="btn ghost small" onclick="addNote('${a.id}')">Admin Note</button></div>
 </article>`}
window.setAppStatus=async(id,status)=>{await db.ref("whitelist/"+id).update({status,reviewedAt:firebase.database.ServerValue.TIMESTAMP,reviewedBy:adminUser.uid})}
window.addNote=async id=>{const n=prompt("Admin note:");if(n!==null)await db.ref("whitelist/"+id+"/adminNote").set(n)}
function updateStats(){
 const a=Object.values(allApps);$("#pendingCount").textContent=a.filter(x=>x.status==="pending").length;$("#acceptedCount").textContent=a.filter(x=>x.status==="accepted").length;$("#rejectedCount").textContent=a.filter(x=>x.status==="rejected").length;
}
function renderAdminChat(snap){
 const box=$("#adminChatMessages");box.innerHTML="";Object.values(snap.val()||{}).forEach(m=>box.insertAdjacentHTML("beforeend",messageHtml(m)));box.scrollTop=box.scrollHeight;
}
$("#adminChatForm").onsubmit=async e=>{
 e.preventDefault();if(!adminUser)return;const text=$("#adminChatInput").value.trim();if(!text)return;
 const name="Infinity Admin";
 const photoURL="";
 await db.ref("chat").push().set({
   uid:adminUser.uid,
   name,
   photoURL,
   text,
   isAdmin:true,
   verified:true,
   createdAt:firebase.database.ServerValue.TIMESTAMP
 });$("#adminChatInput").value="";
}
function messageHtml(m){
 const avatar=m.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name||"User")}&background=111827&color=ffffff`;
 return `<div class="msg${m.uid===adminUser?.uid?" mine":""}"><div class="msg-row"><img class="chat-avatar" src="${escAttr(avatar)}" alt=""><div class="msg-body"><div class="msg-head">${esc(m.name||"User")}${(m.isAdmin||m.verified)?'<span class="verified" title="'+(m.isAdmin?"Verified Admin":"Verified User")+'">✓</span>':""}<small>${fmt(m.createdAt)}</small></div><p>${esc(m.text||"")}</p></div></div></div>`
}
function fmt(t){return t?new Date(t).toLocaleString():"now"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escAttr(v){return esc(v)}
