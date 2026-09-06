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