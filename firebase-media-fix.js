(()=>{
"use strict";
const DB="https://infinityroleplay-default-rtdb.asia-southeast1.firebasedatabase.app";
const clean=v=>typeof v==="string"&&/^https?:\/\//i.test(v.trim())?v.trim():"";
const preload=u=>new Promise(res=>{if(!u)return res(false);const i=new Image();i.decoding="async";i.onload=()=>res(true);i.onerror=()=>res(false);i.src=u;});

function paintHero(s){
  const hb=s?.heroBanners||{};
  const urls=[clean(hb.image1||s?.heroBannerUrl),clean(hb.image2),clean(hb.image3)].filter(Boolean);
  const slider=document.getElementById("heroBannerSlider");
  if(!slider||!urls.length)return;
  const slides=[...slider.querySelectorAll(".hero-banner-slide")];
  Promise.all(urls.map(preload)).finally(()=>{
    slider.style.display="block";
    slides.forEach((el,i)=>{
      const u=urls[i]||urls[0];
      el.style.backgroundImage=`url("${u.replace(/"/g,'\\"')}")`;
      el.classList.toggle("active",i===0);
    });
  });
}
function paintLogo(s){
  const u=clean(s?.serverLogoUrl); if(!u)return;
  document.querySelectorAll(".logo-mark").forEach(el=>{
    let im=el.querySelector("img.dynamic-server-logo");
    if(!im){im=document.createElement("img");im.className="dynamic-server-logo";im.alt="Infinity Role Play";el.textContent="";el.appendChild(im);}
    im.decoding="async"; im.src=u;
  });
}
function paintGallery(site){
  const g=site?.serverGallery||{};
  const urls=[g.image1,g.image2,g.image3,g.image4,g.image5].map(clean).filter(Boolean);
  const track=document.getElementById("serverGalleryTrack"), dots=document.getElementById("serverGalleryDots");
  if(!track||!urls.length)return;
  track.innerHTML=urls.map((u,i)=>`<div class="server-gallery-slide ${i===0?"active":""}"><img decoding="async" src="${u.replace(/"/g,"&quot;")}" alt="Gallery ${i+1}"></div>`).join("");
  if(dots)dots.innerHTML=urls.map((_,i)=>`<button class="${i===0?"active":""}" type="button"></button>`).join("");
}
async function rest(path){
  try{const r=await fetch(`${DB}/${path}.json?x=${Date.now()}`,{cache:"no-store"});return r.ok?await r.json():null}catch(e){return null}
}
async function fallback(){
  const [s,site]=await Promise.all([rest("settings"),rest("siteSettings")]);
  if(s){paintHero(s);paintLogo(s);}
  if(site)paintGallery(site);
}
function sdk(){
  try{
    if(typeof db==="undefined")return;
    db.ref("settings").on("value",x=>{const s=x.val()||{};paintHero(s);paintLogo(s);},()=>fallback());
    db.ref("siteSettings").on("value",x=>paintGallery(x.val()||{}),()=>fallback());
  }catch(e){fallback();}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{sdk();fallback();},{once:true});
else {sdk();fallback();}
setTimeout(fallback,1800);
})();