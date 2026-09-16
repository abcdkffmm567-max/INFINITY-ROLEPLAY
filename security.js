(() => {
  "use strict";
  const editable = el => !!el?.closest?.('input,textarea,select,[contenteditable="true"]');
  const block = e => { if (!editable(e.target)) { e.preventDefault(); e.stopPropagation(); return false; } };

  window.addEventListener("contextmenu", block, true);
  document.addEventListener("contextmenu", block, true);
  document.oncontextmenu = e => editable(e.target);
  window.oncontextmenu = e => editable(e.target);

  ["selectstart","copy","cut","dragstart"].forEach(type => {
    window.addEventListener(type, block, true);
    document.addEventListener(type, block, true);
  });

  window.addEventListener("keydown", e => {
    const k=(e.key||"").toLowerCase();
    if (editable(e.target)) return;
    if (
      e.key==="F12" ||
      (e.ctrlKey && e.shiftKey && ["i","j","c","k"].includes(k)) ||
      (e.ctrlKey && ["u","s","a","c","x"].includes(k)) ||
      (e.metaKey && ["a","c","x","s"].includes(k))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const style=document.createElement("style");
  style.textContent=`
    html,body,body *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
    input,textarea,select,[contenteditable="true"],input *,textarea *,select *{
      -webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important
    }`;
  (document.head||document.documentElement).appendChild(style);
})();