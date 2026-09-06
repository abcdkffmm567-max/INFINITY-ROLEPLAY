const firebaseConfig = {
  apiKey: "AIzaSyBNRNmZJyxQiAj_AjNHLf43knOEmQ9e-FU",
  authDomain: "l2k-top-up-store.firebaseapp.com",
  databaseURL: "https://l2k-top-up-store-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "l2k-top-up-store"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Firebase Storage is used by the Admin Panel for APK/Data-file uploads.
// If your Firebase project has Storage enabled, add storageBucket to the
// firebaseConfig above and this will initialize automatically.
const storage = firebase.storage();
