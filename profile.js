const $=s=>document.querySelector(s);
let currentUser=null, googlePhoto="";

auth.onAuthStateChanged(async user=>{
  if(!user){ location.href="login.html"; return; }
  currentUser=user;

  const snap=await db.ref("users/"+user.uid).once("value");
  const data=snap.val()||{};

  googlePhoto=user.providerData?.find(p=>p.providerId==="google.com")?.photoURL || user.photoURL || "";
  const displayName=data.displayName || user.displayName || "Player";
  const photoURL=data.photoURL || user.photoURL || "";

  $("#profileName").textContent=displayName;
  $("#profileEmail").textContent=user.email||"";
  $("#displayNameInput").value=displayName;
  $("#photoUrlInput").value=photoURL;
  setAvatar(photoURL,displayName);
});

$("#profileForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser)return;

  const displayName=$("#displayNameInput").value.trim();
  const photoURL=$("#photoUrlInput").value.trim();

  try{
    await currentUser.updateProfile({
      displayName: displayName || "Player",
      photoURL: photoURL || null
    });

    await db.ref("users/"+currentUser.uid).update({
      displayName: displayName || "Player",
      email: currentUser.email || "",
      photoURL: photoURL || "",
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    $("#profileName").textContent=displayName || "Player";
    setAvatar(photoURL,displayName);
    alert("Profile updated successfully.");
  }catch(err){
    alert(err.message);
  }
};

$("#resetGooglePhotoBtn").onclick=()=>{
  if(!googlePhoto){
    alert("No Google profile photo found for this account.");
    return;
  }
  $("#photoUrlInput").value=googlePhoto;
  setAvatar(googlePhoto,$("#displayNameInput").value);
};

function setAvatar(url,name){
  $("#profileAvatar").src=url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||"User")}&background=111827&color=ffffff`;
}