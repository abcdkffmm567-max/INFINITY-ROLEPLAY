const firebaseConfig = {
  apiKey: "AIzaSyDWxZPjXFtLPP4GfueoLdohMhGjvrD_z2c",
  authDomain: "infinityroleplay.firebaseapp.com",
  databaseURL: "https://infinityroleplay-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "infinityroleplay",
  storageBucket: "infinityroleplay.firebasestorage.app",
  messagingSenderId: "262561203529",
  appId: "1:262561203529:web:36ebab6e99f9d1703c8698"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();
