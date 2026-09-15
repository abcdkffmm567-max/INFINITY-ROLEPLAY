(()=>{
  const show=()=>{
    if(document.getElementById('irp-maintenance-overlay')) return;
    const style=document.createElement('style');
    style.id='irp-maintenance-style';
    style.textContent=`
      html.irp-maintenance-on,html.irp-maintenance-on body{overflow:hidden!important}
      html.irp-maintenance-on body>:not(#irp-maintenance-overlay):not(script):not(style){filter:blur(9px)!important;pointer-events:none!important;user-select:none!important}
      #irp-maintenance-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(2,9,18,.56);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-family:Arial,Helvetica,sans-serif}
      #irp-maintenance-overlay *{box-sizing:border-box}
      #irp-maintenance-overlay .m-card{width:min(590px,94vw);padding:40px 24px;text-align:center;color:#fff;border-radius:26px;border:1px solid rgba(59,174,255,.42);background:linear-gradient(145deg,rgba(4,20,37,.94),rgba(8,43,75,.9));box-shadow:0 25px 90px rgba(0,0,0,.65),0 0 55px rgba(25,153,255,.12)}
      #irp-maintenance-overlay .m-brand{font-size:12px;font-weight:900;letter-spacing:2.4px;color:#62c9ff}
      #irp-maintenance-overlay h1{margin:15px 0 14px;font-size:clamp(37px,9vw,62px);line-height:.98;font-weight:1000;letter-spacing:-2px}
      #irp-maintenance-overlay h1 span{color:#36bfff}
      #irp-maintenance-overlay p{max-width:470px;margin:0 auto 25px;color:#c2cfdd;font-size:16px;line-height:1.65}
      #irp-maintenance-overlay .wa{display:inline-flex;align-items:center;gap:9px;padding:14px 20px;border-radius:14px;background:#168c4c;color:#fff!important;text-decoration:none!important;font-weight:900;box-shadow:0 10px 30px rgba(22,140,76,.25)}
      #irp-maintenance-overlay .dot{width:9px;height:9px;border-radius:50%;background:#63ffab;box-shadow:0 0 14px #63ffab}
      #irp-maintenance-overlay .note{margin-top:18px;color:#8298ae;font-size:12px}
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('irp-maintenance-on');
    const overlay=document.createElement('div');
    overlay.id='irp-maintenance-overlay';
    overlay.innerHTML=`<div class="m-card"><div class="m-brand">INFINITY ROLE PLAY</div><h1>UNDER<br><span>MAINTENANCE</span></h1><p>Our website is currently under maintenance. We are working on improvements and will be back online soon. For assistance, contact us on WhatsApp.</p><a class="wa" href="https://wa.me/94740682507"><span class="dot"></span> WhatsApp • 074 068 2507</a><div class="note">Thank you for your patience.</div></div>`;
    document.body.appendChild(overlay);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',show,{once:true}); else show();
})();
