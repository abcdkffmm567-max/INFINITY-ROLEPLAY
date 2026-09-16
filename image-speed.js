(()=>{"use strict";
const tune=(img,i=0)=>{
 if(!img||img.dataset.speedReady)return;
 img.dataset.speedReady="1";
 img.decoding="async";
 img.fetchPriority=i<2?"high":"auto";
 if(i>1)img.loading="lazy";
};
const scan=()=>document.querySelectorAll("img").forEach((x,i)=>tune(x,i));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scan,{once:true});else scan();
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
 if(n.nodeType!==1)return;
 if(n.tagName==="IMG")tune(n,document.images.length);
 n.querySelectorAll?.("img").forEach((x,i)=>tune(x,i+2));
}))).observe(document.documentElement,{childList:true,subtree:true});
})();