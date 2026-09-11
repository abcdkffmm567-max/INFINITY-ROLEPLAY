(function(){
  if(typeof db==="undefined") return;
  db.ref("settings/serverLogoUrl").on("value",snap=>{
    const url=String(snap.val()||"").trim();
    document.querySelectorAll(".logo-mark").forEach(el=>{
      let img=el.querySelector("img.dynamic-server-logo");
      if(url){
        if(!img){
          img=document.createElement("img");
          img.className="dynamic-server-logo";
          img.alt="Infinity Role Play Logo";
          el.textContent="";
          el.appendChild(img);
        }
        img.src=url;
      }else{
        el.innerHTML="∞";
      }
    });
  });
})();

// ===== Global eCoin balance badge =====
(function(){
  if(typeof auth === "undefined") return;

  function ensureBadge(){
    const header=document.querySelector("header.nav");
    if(!header) return null;
    let badge=document.getElementById("topEcoinBalance");
    if(badge) return badge;

    badge=document.createElement("a");
    badge.id="topEcoinBalance";
    badge.className="top-ecoin-balance hidden";
    badge.href="profile.html#dailyRewardCard";
    badge.setAttribute("aria-label","My eCoin balance");
    badge.innerHTML='<span class="top-ecoin-icon">◈</span><span class="top-ecoin-text"><small>eCoin</small><strong id="topEcoinAmount">0</strong></span>';

    const brand=header.querySelector(".brand");
    if(brand && brand.nextSibling) header.insertBefore(badge, brand.nextSibling);
    else header.appendChild(badge);
    return badge;
  }

  async function refreshTopCoinBalance(){
    const badge=ensureBadge();
    if(!badge) return;
    const user=auth.currentUser;
    if(!user){ badge.classList.add("hidden"); return; }

    badge.classList.remove("hidden");
    const amount=badge.querySelector("#topEcoinAmount");
    if(amount) amount.textContent="…";

    try{
      const token=await user.getIdToken();
      const res=await fetch("/api/daily-reward",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify({action:"status"})
      });
      const data=await res.json().catch(()=>({}));
      if(res.ok && data.ok && data.linked){
        if(amount) amount.textContent=Number(data.account?.ecoin||0).toLocaleString();
        badge.classList.add("linked");
        badge.title="Server eCoin balance";
      }else{
        if(amount) amount.textContent="0";
        badge.classList.remove("linked");
        badge.title="Link your SA-MP account to show eCoin balance";
      }
    }catch(err){
      if(amount) amount.textContent="—";
      badge.classList.remove("linked");
      badge.title="eCoin balance unavailable";
    }
  }

  window.refreshTopCoinBalance=refreshTopCoinBalance;
  auth.onAuthStateChanged(()=>refreshTopCoinBalance());
  window.addEventListener("ecoin-balance-changed",()=>refreshTopCoinBalance());
})();
