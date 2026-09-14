(()=>{
  'use strict';
  // UI deterrent only. Real security is enforced by Firebase rules, backend auth and headers.
  const block=(e)=>{ e.preventDefault(); e.stopPropagation(); return false; };
  document.addEventListener('contextmenu', block, {capture:true});
  document.addEventListener('dragstart', e=>{
    if(e.target && e.target.tagName==='IMG') block(e);
  }, {capture:true});
  document.addEventListener('keydown', e=>{
    const k=String(e.key||'').toLowerCase();
    const devtools = k==='f12' ||
      (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(k)) ||
      (e.ctrlKey && ['u','s'].includes(k));
    if(devtools) block(e);
  }, {capture:true});
  // Avoid leaking page details through window.opener on links opened in new tabs.
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('a[target="_blank"]').forEach(a=>{
      const rel=new Set(String(a.rel||'').split(/\s+/).filter(Boolean));
      rel.add('noopener'); rel.add('noreferrer');
      a.rel=[...rel].join(' ');
    });
  });
})();
