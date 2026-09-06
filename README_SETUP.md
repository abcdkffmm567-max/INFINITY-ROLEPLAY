# INFINITY ROLE PLAY — Whitelist Website

## Included
- Responsive home page (mobile + PC)
- Firebase Email/Password register & login
- Whitelist application form
- User whitelist status
- Admin panel with accept / reject / admin notes
- Server IP editable from Admin Panel
- Server rules editable from Admin Panel
- SA-MP APK download URL + Firebase Storage upload
- Infinity Data File download URL + Firebase Storage upload
- Firebase Realtime Database live chat
- Verified blue badge for admin chat messages

## 1) Add your Firebase config
Open `firebase-config.js` and replace the placeholder values with:
Firebase Console > Project Settings > Your apps > Web App > SDK setup and configuration.

## 2) Enable Firebase services
Firebase Console:
1. Authentication > Sign-in method > Enable Email/Password.
2. Realtime Database > Create database.
3. Storage > Get started.

## 3) Realtime Database rules
Open `database.rules.json`, copy everything, then:
Firebase Console > Realtime Database > Rules > Paste > Publish.

## 4) Storage rules
Open `storage.rules`.
For this starter project, uploads are allowed for authenticated accounts.
IMPORTANT: For a public production site, use Firebase custom admin claims or a server-side upload endpoint so only admins can write Storage.

## 5) Create the first admin
1. Register normally on the website.
2. Firebase Console > Authentication > Users > copy that user's UID.
3. Realtime Database > Data.
4. Create:
   admins
     YOUR_ADMIN_UID: true

Example JSON:
{
  "admins": {
    "AbCdEf123456": true
  }
}

Now that account can login at `admin.html`.

## 6) Uploading SAMP APK / Data
Admin Panel > Server Settings:
- You can paste a direct download URL, OR
- Choose a local APK/data file and upload it to Firebase Storage.
The generated Firebase download URL is automatically saved in Realtime Database.

## 7) Default Server IP
51.68.107.75:11999
You can change it at any time from Admin Panel.

## 8) Hosting
This is a normal static HTML/CSS/JS project. You can host it on:
- Firebase Hosting
- Netlify
- Cloudflare Pages
- GitHub Pages (Firebase features still work if Firebase authorized domains are configured)

For Firebase Authentication, add your live website domain in:
Authentication > Settings > Authorized domains.

## Security note
Do not make admins by only changing HTML/JavaScript. Admin access here is checked against `/admins/{uid}` in Realtime Database rules.

For strongest production security, set admin status with Firebase Custom Claims using Admin SDK / Cloud Functions, especially for Storage uploads.


## Download Links (Updated)
You do NOT need to upload APK/Data files to Firebase Storage.

In Admin Panel:
- Paste the SAMP APK download URL.
- Paste the Infinity Data File download URL.
- Click **Save Server & Download Links**.

On the public website:
- **Download SAMP App** opens the saved APK link.
- **Download Data File** opens the saved data-file link.

You can use links from Google Drive, MediaFire, Dropbox, GitHub Releases, your own hosting, or any direct download host.


## Google Login / Register
Firebase Console > Authentication > Sign-in method > Google > Enable.

Also add your hosted website domain under:
Authentication > Settings > Authorized domains.

Google users automatically use their Google display name and profile photo when they first log in.

## User Profile
`profile.html` lets logged-in users:
- Change display name
- Change profile photo using a public image URL
- Restore/use their Google profile photo if available

Live chat messages display each user's profile photo and display name.
