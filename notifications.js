
(function(){
  function ensureUI(){
    if(document.getElementById("siteNoticeModal")) return;
    const wrap=document.createElement("div");
    wrap.id="siteNoticeModal";
    wrap.className="site-notice-backdrop hidden";
    wrap.innerHTML=`
      <div class="site-notice-card">
        <div class="site-notice-icon" id="siteNoticeIcon">!</div>
        <div class="site-notice-content">
          <div class="site-notice-kicker">INFINITY ROLE PLAY</div>
          <h3 id="siteNoticeTitle">Notice</h3>
          <p id="siteNoticeMessage"></p>
        </div>
        <button id="siteNoticeOk" class="btn primary site-notice-ok">OK</button>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById("siteNoticeOk").onclick=()=>wrap.classList.add("hidden");
    wrap.addEventListener("click",e=>{if(e.target===wrap)wrap.classList.add("hidden")});
  }

  window.showNotice=function(message,title="Notice",type="info"){
    ensureUI();
    const wrap=document.getElementById("siteNoticeModal");
    const icon=document.getElementById("siteNoticeIcon");
    document.getElementById("siteNoticeTitle").textContent=title;
    document.getElementById("siteNoticeMessage").textContent=String(message||"");
    icon.textContent=type==="success"?"✓":type==="danger"?"!":"i";
    icon.className="site-notice-icon "+type;
    wrap.classList.remove("hidden");
  };

  document.addEventListener("DOMContentLoaded",ensureUI);
})();
