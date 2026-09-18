(()=>{
"use strict";
const DB="https://infinityroleplay-default-rtdb.asia-southeast1.firebasedatabase.app";

async function resolveMedia(value){
  let u=String(value||"").trim();
  if(!u)return "";
  if(/^data:image\//i.test(u)||/^blob:/i.test(u)||/^https?:\/\//i.test(u)){
    // Convert common Google Drive share links to direct image URLs.
    let m=u.match(/drive\.google\.com\/file\/d\/([^/]+)/i)||u.match(/[?&]id=([^&]+)/i);
    if(m) return "https://drive.google.com/uc?export=view&id="+encodeURIComponent(m[1]);
    return u;
  }
  if(/^gs:\/\//i.test(u) && typeof storage!=="undefined"){
    try{return await storage.refFromURL(u).getDownloadURL()}catch(e){return ""}
  }
  // Also support a Firebase Storage object path saved by older admin builds.
  if(typeof storage!=="undefined" && !u.includes("://")){
    try{return await storage.ref(u.replace(/^\/+/,"")).getDownloadURL()}catch(e){}
  }
  return "";
}
function testImage(u){
  return new Promise(res=>{
    if(!u)return res("");
    const i=new Image(); i.decoding="async";
    i.onload=()=>res(u); i.onerror=()=>res(""); i.src=u;
  });
}
async function usable(v){return testImage(await resolveMedia(v))}

async function applyLogo(s){
  const url=await usable(s?.serverLogoUrl);
  document.querySelectorAll(".logo-mark").forEach(el=>{
    if(!url){el.innerHTML="∞";return}
    el.innerHTML="";
    const im=document.createElement("img");
    im.className="dynamic-server-logo"; im.alt="Infinity Role Play Logo";
    im.decoding="async"; im.src=url;
    im.onerror=()=>{el.innerHTML="∞"};
    el.appendChild(im);
  });
}
async function applyHero(s){
  const hb=s?.heroBanners||{};
  const raw=[hb.image1||s?.heroBannerUrl,hb.image2,hb.image3].filter(Boolean);
  const resolved=(await Promise.all(raw.map(usable))).filter(Boolean);
  const slider=document.getElementById("heroBannerSlider");
  if(!slider)return;
  if(!resolved.length){slider.style.display="none";return}
  const slides=[...slider.querySelectorAll(".hero-banner-slide")];
  slider.style.display="block";
  slides.forEach((el,i)=>{
    const u=resolved[i]||resolved[0];
    el.style.backgroundImage=`url("${u.replace(/"/g,'\\"')}")`;
    el.classList.toggle("active",i===0);
  });
}
async function applyGallery(site){
  const g=site?.serverGallery||{};
  const raw=[g.image1,g.image2,g.image3,g.image4,g.image5].filter(Boolean);
  const urls=(await Promise.all(raw.map(usable))).filter(Boolean);
  const track=document.getElementById("serverGalleryTrack"),dots=document.getElementById("serverGalleryDots");
  if(!track||!urls.length)return;
  track.innerHTML=urls.map((u,i)=>`<div class="server-gallery-slide ${i===0?"active":""}"><img decoding="async" src="${u.replace(/"/g,"&quot;")}" alt="Gallery ${i+1}"></div>`).join("");
  if(dots)dots.innerHTML=urls.map((_,i)=>`<button class="${i===0?"active":""}" type="button"></button>`).join("");
}
async function rest(path){
  try{const r=await fetch(`${DB}/${path}.json?t=${Date.now()}`,{cache:"no-store"});return r.ok?await r.json():null}catch(e){return null}
}
async function refresh(){
  const [s,site]=await Promise.all([rest("settings"),rest("siteSettings")]);
  if(s){applyLogo(s);applyHero(s)}
  if(site)applyGallery(site);
}
function start(){
  refresh();
  if(typeof db!=="undefined"){
    try{
      db.ref("settings").on("value",x=>{const s=x.val()||{};applyLogo(s);applyHero(s)},()=>refresh());
      db.ref("siteSettings").on("value",x=>applyGallery(x.val()||{}),()=>refresh());
    }catch(e){}
  }
}
window.infinityResolveMedia=resolveMedia;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();