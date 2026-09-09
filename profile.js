
function applyVerifiedVipStyle(profile){
  const v=profile?.verified===true;
  document.body.classList.toggle("verified-vip-profile",v);
  const b=document.getElementById("vipBadge");
  if(b) b.classList.toggle("hidden",!v);
  const a=document.getElementById("profilePhoto")||
          document.getElementById("profileAvatar")||
          document.querySelector(".profile-avatar img")||
          document.querySelector(".profile-photo img");
  if(a){
    a.classList.toggle("verified-vip-avatar",v);
  }
}
const $=s=>document.querySelector(s);
let currentUser=null,currentProfile=null,googlePhoto="";

auth.onAuthStateChanged(async user=>{
  if(!user){ location.href="login.html"; return; }

  currentUser=user;

  // Show Google/Firebase profile immediately while database profile loads.
  const quickName=user.displayName||"Player";
  $("#profileName").textContent=quickName;
  $("#profileEmail").textContent=user.email||"";
  setAvatar(user.photoURL||"",quickName);

  const ban=await getBanState(user);
  if(ban.banned){
    showNotice("Your Infinity Role Play account is banned."+ (ban.banReason ? " Reason: "+ban.banReason : ""),"Account Banned","danger");
    await auth.signOut();
    location.href="login.html";
    return;
  }

  currentProfile=await ensureInfinityUser(user);
  applyVerifiedVipStyle(currentProfile);
  googlePhoto=user.providerData?.find(p=>p.providerId==="google.com")?.photoURL || "";

  const displayName=currentProfile.displayName||user.displayName||"Player";
  const photoURL=currentProfile.photoURL||user.photoURL||"";

  $("#profileName").textContent=displayName;
  if(currentProfile.verified===true) $("#profileVerifiedBadge").classList.remove("hidden"); else $("#profileVerifiedBadge").classList.add("hidden");
  $("#profileEmail").textContent=user.email||"";
  $("#profileInfinityId").textContent=currentProfile.infinityId||makeInfinityId(user.uid);
  $("#displayNameInput").value=displayName;
  setAvatar(photoURL,displayName);
});

$("#profileForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser)return;

  const displayName=$("#displayNameInput").value.trim()||"Player";
  try{
    await currentUser.updateProfile({displayName});
    await db.ref("users/"+currentUser.uid).update({
      displayName,
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    });
    currentProfile.displayName=displayName;
    $("#profileName").textContent=displayName;
    showNotice("Profile name updated successfully.","Profile Updated","success");
  }catch(err){ showNotice(err.message,"Error","danger"); }
};

$("#profilePhotoInput").addEventListener("change",async e=>{
  const file=e.target.files && e.target.files[0];
  if(!file||!currentUser)return;

  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
    $("#profileUploadStatus").textContent="Please choose JPG, PNG or WEBP.";
    e.target.value="";
    return;
  }
  if(file.size>5*1024*1024){
    $("#profileUploadStatus").textContent="Image is too large. Maximum size is 5 MB.";
    e.target.value="";
    return;
  }

  const ban=await getBanState(currentUser);
  if(ban.banned){
    $("#profileUploadStatus").textContent="Your account is banned.";
    return;
  }

  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const ref=storage.ref(`profilePhotos/${currentUser.uid}/avatar.${ext}`);
  const task=ref.put(file,{contentType:file.type});

  $("#profileUploadStatus").textContent="Uploading...";
  task.on("state_changed",
    snap=>{
      const p=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
      $("#profileUploadBar").style.width=p+"%";
      $("#profileUploadStatus").textContent=`Uploading ${p}%`;
    },
    err=>{
      $("#profileUploadStatus").textContent=err.message;
      $("#profileUploadBar").style.width="0%";
    },
    async()=>{
      try{
        const photoURL=await task.snapshot.ref.getDownloadURL();
        await currentUser.updateProfile({photoURL});
        await db.ref("users/"+currentUser.uid).update({
          photoURL,
          updatedAt:firebase.database.ServerValue.TIMESTAMP
        });
        currentProfile.photoURL=photoURL;
        setAvatar(photoURL,currentProfile.displayName);
        $("#profileUploadStatus").textContent="Profile photo updated successfully.";
        $("#profileUploadBar").style.width="100%";
      }catch(err){
        $("#profileUploadStatus").textContent=err.message;
      }
    }
  );
});

$("#resetGooglePhotoBtn").onclick=async()=>{
  if(!googlePhoto){
    showNotice("No Google profile photo found for this account.","Photo Not Found","info");
    return;
  }
  try{
    await currentUser.updateProfile({photoURL:googlePhoto});
    await db.ref("users/"+currentUser.uid).update({
      photoURL:googlePhoto,
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    });
    currentProfile.photoURL=googlePhoto;
    setAvatar(googlePhoto,currentProfile.displayName);
    showNotice("Google profile photo restored.","Profile Updated","success");
  }catch(err){ showNotice(err.message,"Error","danger"); }
};

function setAvatar(url,name){
  $("#profileAvatar").src=url||`https://ui-avatars.com/api/?name=${encodeURIComponent(name||"User")}&background=111827&color=ffffff`;
}