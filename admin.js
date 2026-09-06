const $=s=>document.querySelector(s);
let adminUser=null, allApps={};

$("#adminLoginForm").onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  $("#adminLoginStatus").textContent="Logging in...";
  try{
    const cred=await auth.signInWithEmailAndPassword(f.get("email"),f.get("password"));
    const adminSnap=await db.ref("admins/"+cred.user.uid).once("value");
    if(adminSnap.val()!==true){
      await auth.signOut();
      throw new Error("This Firebase account is not authorized as an admin.");
    }
    $("#adminLoginStatus").textContent="";
  }catch(err){
    $("#adminLoginStatus").textContent=err.message;
  }
};

auth.onAuthStateChanged(async user=>{
  if(!user){
    adminUser=null;
    $("#adminLoginCard").classList.remove("hidden");
    $("#adminDashboard").classList.add("hidden");
    return;
  }

  const adminSnap=await db.ref("admins/"+user.uid).once("value");
  if(adminSnap.val()!==true){
    $("#adminLoginStatus").textContent="This account is not authorized as an admin.";
    await auth.signOut();
    return;
  }

  adminUser=user;
  $("#adminLoginCard").classList.add("hidden");
  $("#adminDashboard").classList.remove("hidden");
  startDashboard();
});

$("#adminLogout").onclick=()=>auth.signOut();

function startDashboard(){
 db.ref("settings").on("value",s=>{
   const v=s.val()||{};
   $("#adminServerIp").value=v.serverIp||"51.68.107.75:11999";
   $("#sampUrl").value=v.sampUrl||"";
   $("#dataUrl").value=v.dataUrl||"";
 });
 $("#serverSettingsForm").onsubmit=async e=>{
   e.preventDefault();
   const serverIp=$("#adminServerIp").value.trim();
   const sampUrl=$("#sampUrl").value.trim();
   const dataUrl=$("#dataUrl").value.trim();
   try{
     await db.ref("settings").update({serverIp,sampUrl,dataUrl});
     $("#settingsStatus").textContent="Saved successfully.";
     setTimeout(()=>$("#settingsStatus").textContent="",2000);
   }catch(err){
     $("#settingsStatus").textContent=err.message;
   }
 };
 db.ref("rules").on("value",renderRules);
 db.ref("whitelist").on("value",s=>{allApps=s.val()||{};renderApps();updateStats()});
 db.ref("users").on("value",s=>$("#userCount").textContent=s.numChildren());
 db.ref("chat").limitToLast(100).on("value",renderAdminChat);
}catch(err){$(statusSel).textContent=err.message}
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
 const userSnap=await db.ref("users/"+adminUser.uid).once("value");
 const userData=userSnap.val()||{};
 const name=userData.displayName||adminUser.displayName||"Infinity Admin";
 const photoURL=userData.photoURL||adminUser.photoURL||"";
 await db.ref("chat").push().set({
   uid:adminUser.uid,
   name,
   photoURL,
   text,
   isAdmin:true,
   createdAt:firebase.database.ServerValue.TIMESTAMP
 });$("#adminChatInput").value="";
}
function messageHtml(m){
 const avatar=m.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name||"User")}&background=111827&color=ffffff`;
 return `<div class="msg${m.uid===adminUser?.uid?" mine":""}"><div class="msg-row"><img class="chat-avatar" src="${escAttr(avatar)}" alt=""><div class="msg-body"><div class="msg-head">${esc(m.name||"User")}${m.isAdmin?'<span class="verified">✓</span>':""}<small>${fmt(m.createdAt)}</small></div><p>${esc(m.text||"")}</p></div></div></div>`
}
function fmt(t){return t?new Date(t).toLocaleString():"now"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escAttr(v){return esc(v)}
