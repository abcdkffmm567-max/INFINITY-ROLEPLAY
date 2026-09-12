let redeemUser=null;
const $r=id=>document.getElementById(id);
const input=$r("redeemCodeInput"), btn=$r("redeemCodeBtn"), msg=$r("redeemCodeMessage"), historyEl=$r("redeemHistory"), stateEl=$r("redeemAccountState"), balanceEl=$r("redeemEcoinBalance");

function redeemErrorMessage(code){
  const map={LOGIN_REQUIRED:"Please login first.",INVALID_LOGIN:"Your login session expired. Please login again.",SERVER_ACCOUNT_NOT_LINKED:"Link your SA-MP account from Profile first.",SERVER_ACCOUNT_NOT_FOUND:"Linked SA-MP account was not found.",INVALID_REDEEM_CODE:"Enter a valid redeem code.",REDEEM_CODE_NOT_FOUND:"Redeem code not found.",REDEEM_CODE_DISABLED:"This redeem code is disabled.",REDEEM_CODE_EXPIRED:"This redeem code has expired.",REDEEM_CODE_USED_UP:"This redeem code has reached its usage limit.",REDEEM_CODE_ALREADY_USED:"You already used this redeem code."};
  return map[code]||code||"Redeem service error.";
}
async function api(path,action,extra={}){
  if(!redeemUser) throw new Error("LOGIN_REQUIRED");
  const token=await redeemUser.getIdToken();
  const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({action,...extra})});
  let data={}; try{data=await res.json();}catch{}
  if(!res.ok||!data.ok) throw new Error(data.error||"API_ERROR");
  return data;
}
async function loadAccount(){
  try{
    const data=await api("/api/daily-reward","status");
    if(data.linked){
      stateEl.innerHTML=`Linked: <b>${String(data.account?.username||data.serverUsername||"Server Account")}</b>`;
      stateEl.classList.add("linked");
      balanceEl.textContent=Number(data.account?.ecoin||0).toLocaleString();
      btn.disabled=false;
    }else{
      stateEl.innerHTML='Server account not linked. <a href="profile.html#dailyRewardCard">Link it in Profile →</a>';
      stateEl.classList.remove("linked");
      balanceEl.textContent="0";
      btn.disabled=true;
    }
  }catch(e){stateEl.textContent="Could not load server account."; balanceEl.textContent="—";}
}
async function loadHistory(){
  if(!redeemUser)return;
  try{
    const data=await api("/api/redeem-code","history");
    const rows=data.claims||[];
    historyEl.innerHTML=rows.length?rows.map(r=>`<div class="redeem-history-item"><b>${String(r.code||"")}</b><span>+${Number(r.ecoin_reward||0).toLocaleString()} eCoin</span></div>`).join(""):'<div class="redeem-empty">No redeem codes claimed yet.</div>';
  }catch(e){historyEl.innerHTML='<div class="redeem-empty">Could not load redeem history.</div>';}
}
async function redeem(){
  const code=String(input.value||"").trim().toUpperCase();
  if(!code){showNotice("Enter a redeem code.","Redeem Code","danger");return;}
  btn.disabled=true; btn.textContent="REDEEMING...";
  try{
    const data=await api("/api/redeem-code","redeem",{code});
    msg.textContent=`Success: +${Number(data.reward?.ecoin||0).toLocaleString()} eCoin added to your balance.`;
    input.value="";
    balanceEl.textContent=Number(data.account?.ecoin||0).toLocaleString();
    showNotice(`${Number(data.reward?.ecoin||0).toLocaleString()} eCoin added to your balance!`,"Code Redeemed","success");
    window.dispatchEvent(new Event("ecoin-balance-changed"));
    await loadHistory();
  }catch(e){const m=redeemErrorMessage(e.message);msg.textContent=m;showNotice(m,"Redeem Failed","danger");}
  finally{btn.disabled=false;btn.textContent="REDEEM";}
}
btn.addEventListener("click",redeem);
input.addEventListener("keydown",e=>{if(e.key==="Enter")redeem();});
$r("refreshRedeemHistory").addEventListener("click",loadHistory);
auth.onAuthStateChanged(async user=>{if(!user){location.href="login.html";return;}await user.reload();user=auth.currentUser||user;if(user.email&&user.emailVerified!==true){try{await sendInfinityVerificationEmail(user)}catch(e){}await auth.signOut();location.href="login.html";return;}redeemUser=user;await Promise.all([loadAccount(),loadHistory()]);});
