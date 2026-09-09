const $=s=>document.querySelector(s);
let adminUser=null;
let allApps={};
let allUsers={};
let allPublicUsers={};
let dashboardStarted=false;
let allServerAdmins={};
let allAdminApplications={};

// The Admin Panel still shows only Username + Password.
// Internally, the username is mapped to a Firebase Authentication email.
function adminUsernameToEmail(username){
  return `${String(username||"").trim().toLowerCase()}@infinityrp.com`;
}

async function openAdminDashboard(user){
  adminUser=user;
  $("#adminLoginCard").classList.add("hidden");
  $("#adminDashboard").classList.remove("hidden");
  startDashboard();
}

$("#adminLoginForm").onsubmit=async e=>{
  e.preventDefault();

  const f=new FormData(e.target);
  const username=String(f.get("username")||"").trim();
  const password=String(f.get("password")||"");

  if(!username || !password){
    $("#adminLoginStatus").textContent="Enter username and password.";
    return;
  }

  $("#adminLoginStatus").textContent="Logging in...";

  try{
    const email=adminUsernameToEmail(username);
    const cred=await auth.signInWithEmailAndPassword(email,password);

    const adminSnap=await db.ref("admins/"+cred.user.uid).once("value");
    if(adminSnap.val()!==true){
      await auth.signOut();
      throw new Error("This account is not authorized as an admin.");
    }

    $("#adminLoginStatus").textContent="";
    await openAdminDashboard(cred.user);
  }catch(err){
    console.error("Admin login failed:",err);
    let msg="Invalid admin username/password or admin access is not enabled.";
    if(err.code==="auth/user-not-found" || err.code==="auth/invalid-credential" || err.code==="auth/wrong-password"){
      msg="Invalid admin username or password.";
    }else if(err.code==="auth/operation-not-allowed"){
      msg="Firebase Email/Password sign-in is not enabled.";
    }else if(err.message && err.message.includes("not authorized")){
      msg=err.message;
    }
    $("#adminLoginStatus").textContent=msg;
    if(typeof showNotice==="function") showNotice(msg,"Admin Login","danger");
  }
};

auth.onAuthStateChanged(async user=>{
  if(!user){
    adminUser=null;
    $("#adminLoginCard").classList.remove("hidden");
    $("#adminDashboard").classList.add("hidden");
    return;
  }

  try{
    const adminSnap=await db.ref("admins/"+user.uid).once("value");
    if(adminSnap.val()!==true){
      await auth.signOut();
      return;
    }
    await openAdminDashboard(user);
  }catch(err){
    console.error("Admin auth-state check failed:",err);
  }
});

$("#adminLogout").onclick=async()=>{
  await auth.signOut();
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
 db.ref("users").on("value",s=>{
   allUsers=s.val()||{};
   $("#userCount").textContent=s.numChildren();
   renderUsersManagement();
   renderChatMuteUsers();
 },err=>{
   console.error("User Management read failed:",err);
   const box=$("#usersManagementList");
   if(box) box.innerHTML="<p>Could not load users: "+esc(err.message||"Permission denied")+"</p>";
 });
 db.ref("serverAdmins").on("value",s=>{
   allServerAdmins=s.val()||{};
   renderServerAdminsAdmin();
 },err=>{
   console.error("Server admins read failed:",err);
   const box=$("#serverAdminsAdminList");
   if(box) box.innerHTML="<p>Could not load server admins: "+esc(err.message||"Permission denied")+"</p>";
 });
 db.ref("adminApplications").on("value",x=>{allAdminApplications=x.val()||{};renderAdminApplications();},err=>{const b=$("#adminApplicationsList");if(b)b.innerHTML="<p>"+esc(err.message)+"</p>";});
 db.ref("siteSettings/adminApplyBackgroundURL").on("value",s=>{const i=$("#adminApplyBackgroundURL");if(i)i.value=s.val()||"";});
 db.ref("siteSettings/whitelistApplicationsOpen").on("value",s=>{
   const open=s.val()!==false;
   const cb=$("#whitelistApplicationsOpen");
   const badge=$("#whitelistAccessBadge");
   if(cb) cb.checked=open;
   if(badge){
     badge.textContent=open?"OPEN":"LOCKED";
     badge.className="status-pill "+(open?"accepted":"rejected");
   }
 });
 db.ref("siteSettings/releaseCountdown").on("value",s=>{
   const v=s.val()||{};
   const input=$("#releaseDateTime");
   const enabled=$("#releaseCountdownEnabled");
   if(input && v.timestamp){
     const d=new Date(Number(v.timestamp));
     const pad=n=>String(n).padStart(2,"0");
     input.value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
   }
   if(enabled) enabled.checked=v.enabled!==false;
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


function renderUsersManagementOriginal(){
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
       <button class="btn danger small delete-user-btn" onclick="deleteWebsiteUser('${u.uid}')">Delete</button>
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


function resetServerAdminForm(){
  if(!$("#serverAdminForm")) return;
  $("#serverAdminForm").reset();
  $("#serverAdminEditId").value="";
  $("#serverAdminOrder").value="0";
  $("#saveServerAdminBtn").textContent="Add Server Admin";
  $("#cancelServerAdminEdit").classList.add("hidden");
  $("#serverAdminStatus").textContent="";
}

function renderServerAdminsAdmin(){
  const box=$("#serverAdminsAdminList");
  if(!box)return;
  const items=Object.entries(allServerAdmins)
    .map(([id,v])=>({id,...v}))
    .sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999));

  if(!items.length){
    box.innerHTML="<p>No server admins added yet.</p>";
    return;
  }

  box.innerHTML=items.map(a=>{
    const avatar=a.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(a.realName||a.serverName||"Admin")}&background=111827&color=ffffff`;
    return `<article class="admin-user-card server-admin-manage-card">
      <img class="admin-user-avatar" src="${escAttr(avatar)}" alt="">
      <div class="admin-user-info">
        <div class="admin-user-name">${esc(a.serverName||"Unknown")}</div>
        <small>${esc(a.realName||"")}</small>
        <small>${esc(a.rank||"Server Admin")}</small>
        <small>${esc(a.phone||"")}</small>
      </div>
      <div class="admin-user-actions">
        <button class="btn ghost small" onclick="editServerAdmin('${a.id}')">Edit</button>
        <button class="btn danger small" onclick="deleteServerAdmin('${a.id}')">Delete</button>
      </div>
    </article>`;
  }).join("");
}

if($("#serverAdminForm")) $("#serverAdminForm").onsubmit=async e=>{
  e.preventDefault();
  if(!adminUser)return;

  const id=$("#serverAdminEditId").value.trim();
  const serverName=$("#serverAdminServerName").value.trim();
  const realName=$("#serverAdminRealName").value.trim();
  const phone=$("#serverAdminPhone").value.trim();
  const rank=$("#serverAdminRank").value.trim()||"Server Admin";
  const order=Number($("#serverAdminOrder").value||0);
  const photoURLInput=$("#serverAdminPhotoURL").value.trim();
  const file=$("#serverAdminPhoto").files[0];

  if(!serverName||!realName){
    $("#serverAdminStatus").textContent="Server Username and Real Name are required.";
    return;
  }
  if(file && file.size>5*1024*1024){
    $("#serverAdminStatus").textContent="Photo must be smaller than 5 MB.";
    return;
  }

  const targetId=id||db.ref("serverAdmins").push().key;
  $("#serverAdminStatus").textContent=file?"Uploading photo...":"Saving...";

  try{
    let photoURL=photoURLInput || (allServerAdmins[targetId]||{}).photoURL || "";
    if(file){
      const safeName=String(file.name||"admin.jpg").replace(/[^a-zA-Z0-9._-]/g,"_");
      const ref=storage.ref(`serverAdminPhotos/${targetId}/${Date.now()}_${safeName}`);
      await ref.put(file);
      photoURL=await ref.getDownloadURL();
    }
    await db.ref("serverAdmins/"+targetId).set({
      serverName,realName,phone,rank,order,photoURL,
      updatedAt:firebase.database.ServerValue.TIMESTAMP,
      updatedBy:adminUser.uid
    });
    $("#serverAdminStatus").textContent=id?"Admin updated successfully.":"Server admin added successfully.";
    setTimeout(resetServerAdminForm,900);
  }catch(err){
    console.error("Server admin save failed:",err);
    $("#serverAdminStatus").textContent="Save failed: "+(err.message||err);
  }
};

window.editServerAdmin=id=>{
  const a=allServerAdmins[id];
  if(!a)return;
  $("#serverAdminEditId").value=id;
  $("#serverAdminServerName").value=a.serverName||"";
  $("#serverAdminRealName").value=a.realName||"";
  $("#serverAdminPhone").value=a.phone||"";
  $("#serverAdminRank").value=a.rank||"Server Admin";
  $("#serverAdminPhotoURL").value=a.photoURL||"";
  $("#serverAdminOrder").value=Number(a.order||0);
  $("#saveServerAdminBtn").textContent="Save Changes";
  $("#cancelServerAdminEdit").classList.remove("hidden");
  $("#serverAdminStatus").textContent="Editing "+(a.serverName||"server admin");
  $("#serverAdminServerName").scrollIntoView({behavior:"smooth",block:"center"});
};

window.deleteServerAdmin=async id=>{
  const a=allServerAdmins[id]||{};
  if(!confirm(`Delete ${a.serverName||"this server admin"} from the Server Admins page?`))return;
  try{
    await db.ref("serverAdmins/"+id).remove();
    if($("#serverAdminEditId").value===id) resetServerAdminForm();
  }catch(err){
    showNotice("Delete failed: "+err.message,"Error","danger");
  }
};

if($("#cancelServerAdminEdit")) $("#cancelServerAdminEdit").onclick=resetServerAdminForm;



function renderAdminApplications(){
 const b=$("#adminApplicationsList"); if(!b)return;
 const f=$("#filterAdminApps")?.value||"All";
 const a=Object.entries(allAdminApplications).map(([uid,v])=>({uid,...v})).filter(x=>f==="All"||(x.status||"Pending")===f).sort((x,y)=>(y.submittedAt||0)-(x.submittedAt||0));
 if(!a.length){b.innerHTML="<p>No admin applications found.</p>";return}
 b.innerHTML=a.map(x=>`<article class="admin-application-card"><div class="admin-application-head"><div><h3>${esc(x.serverName||"Unknown")}</h3><small>${esc(x.realName||"")} • Age ${esc(x.age||"-")}</small></div><span class="status-pill ${esc((x.status||"Pending").toLowerCase())}">${esc(x.status||"Pending")}</span></div>
 <div class="admin-application-grid"><div><span>Phone</span><strong>${esc(x.phone||"-")}</strong></div><div><span>Discord</span><strong>${esc(x.discord||"-")}</strong></div><div><span>Play Time</span><strong>${esc(x.playTime||"-")}</strong></div><div><span>Availability</span><strong>${esc(x.availability||"-")}</strong></div><div class="full"><span>Experience</span><p>${esc(x.experience||"-")}</p></div><div class="full"><span>Why Admin?</span><p>${esc(x.reason||"-")}</p></div></div>
 <label class="full">Admin Note<textarea id="adminNote_${x.uid}" rows="2">${esc(x.adminNote||"")}</textarea></label>
 <div class="admin-user-actions"><button class="btn primary small" onclick="setAdminApplicationStatus('${x.uid}','Accepted')">Accept</button><button class="btn ghost small" onclick="setAdminApplicationStatus('${x.uid}','Rejected')">Reject</button><button class="btn ghost small" onclick="setAdminApplicationStatus('${x.uid}','Pending')">Pending</button><button class="btn danger small" onclick="deleteAdminApplication('${x.uid}')">Delete</button></div></article>`).join("")
}
window.setAdminApplicationStatus=async(uid,status)=>{const note=$("#adminNote_"+uid)?.value.trim()||"";try{await db.ref("adminApplications/"+uid).update({status,adminNote:note,reviewedAt:firebase.database.ServerValue.TIMESTAMP,reviewedBy:adminUser.uid});showNotice("Application marked "+status+".","Admin Application")}catch(e){showNotice("Update failed: "+e.message,"Error","danger")}};
window.deleteAdminApplication=async uid=>{if(!confirm("Delete this admin application?"))return;try{await db.ref("adminApplications/"+uid).remove()}catch(e){showNotice("Delete failed: "+e.message,"Error","danger")}};
if($("#filterAdminApps"))$("#filterAdminApps").onchange=renderAdminApplications;


if($("#releaseCountdownForm")) $("#releaseCountdownForm").onsubmit=async e=>{
  e.preventDefault();
  if(!adminUser)return;
  const raw=$("#releaseDateTime").value;
  const enabled=$("#releaseCountdownEnabled").checked;
  const st=$("#releaseCountdownStatus");
  if(!raw){st.textContent="Select a release date and time.";return;}
  const timestamp=new Date(raw).getTime();
  if(!Number.isFinite(timestamp)){st.textContent="Invalid date/time.";return;}
  try{
    st.textContent="Saving...";
    await db.ref("siteSettings/releaseCountdown").set({
      timestamp,
      enabled,
      updatedAt:firebase.database.ServerValue.TIMESTAMP,
      updatedBy:adminUser.uid
    });
    st.textContent="Countdown saved.";
  }catch(err){
    console.error(err);
    st.textContent="Save failed: "+(err.message||err);
  }
};

if($("#clearAllChatBtn")) $("#clearAllChatBtn").onclick=async()=>{
  if(!adminUser)return;
  if(!confirm("Clear ALL live chat messages? This cannot be undone."))return;
  try{
    $("#clearAllChatBtn").disabled=true;
    $("#clearAllChatBtn").textContent="Clearing...";
    await db.ref("chat").remove();
    showNotice("Live Chat cleared successfully.","Live Chat");
  }catch(err){
    showNotice("Could not clear chat: "+err.message,"Error","danger");
  }finally{
    $("#clearAllChatBtn").disabled=false;
    $("#clearAllChatBtn").textContent="Clear Live Chat";
  }
};



if($("#saveWhitelistAccessBtn")) $("#saveWhitelistAccessBtn").onclick=async()=>{
  if(!adminUser)return;
  const open=$("#whitelistApplicationsOpen").checked;
  const st=$("#whitelistAccessStatus");
  try{
    st.textContent="Saving...";
    await db.ref("siteSettings/whitelistApplicationsOpen").set(open);
    st.textContent=open?"Whitelist form unlocked.":"Whitelist form locked.";
  }catch(err){
    st.textContent="Save failed: "+(err.message||err);
  }
};



function renderChatMuteUsers(){const b=$("#chatMuteUsersList");if(!b)return;const a=Object.entries(allUsers||{}).map(([uid,v])=>({uid,...v}));if(!a.length){b.innerHTML="<p>No registered users found.</p>";return}b.innerHTML=a.map(u=>{const m=u.chatMuted===true,n=u.displayName||u.name||u.email||"User",av=u.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=111827&color=ffffff`;return `<article class="admin-user-card"><img class="admin-user-avatar" src="${escAttr(av)}"><div class="admin-user-info"><div class="admin-user-name">${esc(n)}</div><small>${m?"Muted from Live Chat":"Can use Live Chat"}</small></div><div class="admin-user-actions"><button class="btn ${m?"ghost":"danger"} small" onclick="setChatMute('${u.uid}',${m?'false':'true'})">${m?"Unmute":"Mute"}</button></div></article>`}).join("")}
window.setChatMute=async(uid,muted)=>{try{await db.ref("users/"+uid+"/chatMuted").set(muted===true);showNotice(muted?"User muted from Live Chat.":"User unmuted.","Live Chat")}catch(e){showNotice("Mute update failed: "+e.message,"Error","danger")}};
if($("#saveAdminApplyBackgroundBtn"))$("#saveAdminApplyBackgroundBtn").onclick=async()=>{const u=$("#adminApplyBackgroundURL").value.trim(),st=$("#adminApplyBackgroundStatus");try{st.textContent="Saving...";await db.ref("siteSettings/adminApplyBackgroundURL").set(u);st.textContent=u?"Background saved.":"Background removed."}catch(e){st.textContent="Save failed: "+e.message}};

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

db.ref("siteSettings").on("value",s=>{
  const v=s.val()||{};
  const a=$("#sampDownloadUrl");
  const d=$("#dataDownloadUrl");
  if(a && !a.matches(":focus")) a.value=v.sampDownloadUrl||v.sampApkUrl||v.sampUrl||"";
  if(d && !d.matches(":focus")) d.value=v.dataDownloadUrl||v.dataFileUrl||v.dataUrl||"";
});

if($("#saveDownloadLinksBtn")) $("#saveDownloadLinksBtn").onclick=async()=>{
  if(!adminUser)return;
  const samp=$("#sampDownloadUrl").value.trim();
  const data=$("#dataDownloadUrl").value.trim();
  const st=$("#downloadLinksStatus");
  try{
    st.textContent="Saving...";
    await db.ref("siteSettings").update({
      sampDownloadUrl:samp,
      dataDownloadUrl:data
    });
    st.textContent="Download links saved.";
  }catch(err){
    console.error(err);
    st.textContent="Save failed: "+(err.message||err);
  }
};


function renderUsersManagement(){
  const originalUsers=allUsers||{};
  const unique={};

  // One visible account per Firebase Authentication UID.
  Object.entries(originalUsers).forEach(([uid,user])=>{
    if(!uid || !user || typeof user!=="object") return;
    unique[uid]={...(unique[uid]||{}),...user};
  });

  // publicUsers is only a public mirror. Merge it into the matching UID,
  // never render it as another account.
  if(typeof allPublicUsers!=="undefined"){
    Object.entries(allPublicUsers||{}).forEach(([uid,pub])=>{
      if(unique[uid]) unique[uid]={...pub,...unique[uid]};
    });
  }

  const saved=allUsers;
  allUsers=unique;
  try{return renderUsersManagementOriginal();}
  finally{allUsers=saved;}
}


window.deleteWebsiteUser=async uid=>{
  const user=allUsers[uid]||{};
  const name=user.displayName||user.infinityId||"this user";
  if(!confirm(`Delete ${name} from User Management?

This will remove the user's website profile and application records.
This action cannot be undone.`)) return;

  try{
    const updates={};
    updates["users/"+uid]=null;
    updates["publicUsers/"+uid]=null;
    updates["userApplications/"+uid]=null;
    updates["adminApplications/"+uid]=null;
    await db.ref().update(updates);
    showNotice("User deleted from website User Management.","Deleted","success");
  }catch(err){
    showNotice("Delete failed: "+err.message,"Error","danger");
  }
};

db.ref("siteSettings/serverGallery").on("value",x=>{const v=x.val()||{};for(let i=1;i<=5;i++){const e=$("#galleryImage"+i);if(e)e.value=v["image"+i]||""}});
db.ref("siteSettings/trailerPhotoUrl").on("value",x=>{const e=$("#trailerPhotoUrl");if(e)e.value=x.val()||""});
if($("#saveGalleryTrailerBtn"))$("#saveGalleryTrailerBtn").onclick=async()=>{const g={};for(let i=1;i<=5;i++)g["image"+i]=($("#galleryImage"+i)?.value||"").trim();const t=($("#trailerPhotoUrl")?.value||"").trim(),st=$("#galleryTrailerStatus");try{st.textContent="Saving...";await db.ref("siteSettings/serverGallery").set(g);await db.ref("siteSettings/trailerPhotoUrl").set(t);st.textContent="Saved."}catch(e){st.textContent="Save failed: "+e.message}};


db.ref("siteSettings/livePlayerCountEnabled").on("value",snap=>{
  const enabled = snap.val() !== false;
  const cb = $("#livePlayerCountEnabled");
  const badge = $("#liveCountToggleBadge");
  if(cb) cb.checked = enabled;
  if(badge){
    badge.textContent = enabled ? "ON" : "OFF";
    badge.className = "status-pill " + (enabled ? "accepted" : "rejected");
  }
});


if($("#saveLivePlayerCountToggle")) $("#saveLivePlayerCountToggle").onclick=async()=>{
  if(!adminUser)return;
  const enabled = $("#livePlayerCountEnabled").checked;
  const st = $("#livePlayerCountToggleStatus");
  try{
    st.textContent = "Saving...";
    await db.ref("siteSettings/livePlayerCountEnabled").set(enabled);
    st.textContent = enabled ? "Live Player Count turned ON." : "Live Player Count turned OFF.";
  }catch(err){
    console.error(err);
    st.textContent = "Save failed: " + (err.message || err);
  }
};
