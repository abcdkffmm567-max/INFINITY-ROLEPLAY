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


## Latest UI changes
- Whitelist application moved to `whitelist.html`.
- Main website now has a floating Live Chat button.
- Admin panel has an extra username/password gate before Firebase admin login.

Default admin gate:
Username: infinityadmin
Password: Infinity@11999

IMPORTANT: This extra username/password check is client-side and is only an additional UI gate.
Real admin security still depends on Firebase Authentication + `/admins/{uid}: true` database rules.

## Admin login update
The Admin Panel now shows only the custom Infinity admin login:
- Username: infinityadmin
- Password: Infinity@11999

The second Firebase email/password login screen has been removed.

Security note: because this is a static HTML/JS site, a hard-coded admin password is not strong production security. For truly secure custom username/password admin login, use a backend/serverless function.


## Firebase Admin Login Restored
Admin Panel now uses Firebase Authentication again.

To make an admin:
1. Create/register the account in Firebase Authentication.
2. Copy its UID.
3. In Realtime Database add:
   admins
     YOUR_UID: true

Only accounts with `/admins/{uid}: true` can open the Admin Dashboard.


## Hero Banner / Server Logo Background
Admin Panel > Server & Download Settings now includes:
- Hero Banner / Server Logo Image Link

Paste a public image URL and save settings. The image will automatically appear as the background of the Home hero section in `index.html`.

Recommended image size: 1920x1080 or wider landscape image.


## Admin Login now uses Username + Password
The Admin Panel no longer asks the visitor to type an email address.

It converts the username internally to a Firebase Authentication email:
- Username `infinityadmin` -> Firebase email `infinityadmin@infinityrp.com`

### Create the admin account
In Firebase Console:
1. Authentication > Users > Add user
2. Email: `infinityadmin@infinityrp.com`
3. Password: choose your admin password
4. Copy that Firebase user's UID
5. Realtime Database:
   `admins/YOUR_UID = true`

Then open `admin.html` and login using:
- Username: `infinityadmin`
- Password: the password you created in Firebase

The browser UI only asks for Username + Password, while Firebase Authentication still handles the real login.


## Admin Login (Normal Username + Password)
Firebase Authentication is no longer used for the Admin Panel login.

Default admin login:
- Username: `infinityadmin`
- Password: `Infinity@11999`

The Admin Panel still uses Firebase Realtime Database for website data such as settings, whitelist applications, rules and chat.

IMPORTANT: Because this website is static HTML/JS, the username/password is stored in JavaScript and can be discovered by someone inspecting the site source. For real production security, use a backend/serverless authentication system.


## Profile Photo Upload + INF User ID + Ban/Unban

### Profile photo
The old profile-photo URL box was removed.
Users now select a JPG/PNG/WEBP image from their device and it uploads to Firebase Storage.

Firebase Storage must be enabled. This project currently expects:
`l2k-top-up-store.firebasestorage.app`

If Firebase Console shows a different Storage bucket, replace `storageBucket` in `firebase-config.js`.

Deploy the included `storage.rules`.

### Infinity user IDs
Every registered/login user gets an automatic public ID beginning with `INF`.
Example: `INFXY12AB34`.

The ID is saved under:
`users/{firebaseUid}/infinityId`

### User ban/unban
Admin Panel now has a **User Management** section showing:
- Profile photo
- Display name
- INF user ID
- Email
- Active/Banned state
- Ban / Unban buttons

Ban state is stored under:
`users/{uid}/banned`

Banned users are blocked by the website from profile updates, chat, and whitelist actions.

### Important admin security note
Your current Admin Panel uses a local/static username and password rather than Firebase Admin Authentication.
The secure `database.rules.json` included here only allows true Firebase admins (`admins/{uid}=true`) to change another user's ban state.

For Ban/Unban to be securely functional on a public site, the Admin Panel should use Firebase admin authentication behind the UI, or a backend/serverless admin API.
Do NOT make the whole `users` database publicly writable just to bypass this rule.


## Admin login fix + server logo setting
The normal Admin Panel login has been fixed.

Default login:
- Username: `infinityadmin`
- Password: `Infinity@11999`

Admin Panel > Server & Download Settings now includes:
- **Server Logo Image Link**

Paste a public PNG/JPG/WebP image URL and save. The header logo on the website pages updates automatically.

Note: the Admin Panel login is local/static. Firebase Realtime Database may still reject protected reads/writes depending on your database rules, because this login does not create a Firebase authenticated admin session.


## Custom notifications + Verified Blue Badge
Browser `alert()` messages such as account-ban notices have been replaced with a styled Infinity Role Play modal.

User records now support:
`users/{uid}/verified = true`

Admin Panel > User Management now includes:
- Give Verified
- Remove Verified
- Ban / Unban

Verified users display a blue check badge beside their username in Live Chat and on their Profile page.

Important: your current Admin Panel login is still a local/static username/password. If Firebase rules require an authenticated Firebase admin, Verified/Ban/Unban writes can be denied. A backend or Firebase-authenticated admin session is the secure production solution.

## Google Sign-In setup
1. Firebase Authentication > Sign-in method > Google > Enable.
2. Firebase Authentication > Settings > Authorized domains.
3. Add your GitHub Pages host, for example `abcdkffmm567-max.github.io`.
4. Save, then upload/redeploy this updated website.

The code now shows a clear error when Google is disabled, the domain is unauthorized, or the popup is blocked.

## IMPORTANT: Fix for Google login/profile
This version fixes the user-profile database rule that could reject a brand-new Google user's first profile write.

You MUST publish the included `database.rules.json` rules in Firebase Realtime Database > Rules, otherwise the old deployed rules can still return `PERMISSION_DENIED`.

Also verify:
- Firebase Authentication > Sign-in method > Google = Enabled
- Firebase Authentication > Settings > Authorized domains includes your GitHub Pages host
- Example host: `abcdkffmm567-max.github.io`

After Google sign-in, the site now opens `profile.html` directly and shows the Google account display name and Google profile photo.

## Profile menu fix
After a successful login:
- Login button is hidden
- Register button is hidden
- Profile button is shown in the navigation menu
- The Profile button displays the user's Google/Firebase display name
- Logout remains available

If the Realtime Database profile read temporarily fails, the Profile button still appears using Firebase Auth data.

## Profile icon menu fix
After a successful Firebase login, the navigation now shows a circular profile icon.

- If the user has a profile photo, that photo is shown.
- If no photo exists, a user icon fallback is shown.
- Login/Register buttons are hidden while logged in.
- Tapping the circular icon opens `profile.html`.

## Live Chat login fix
This version fixes the chat send flow after login.

Changes:
- Uses `auth.currentUser` directly.
- Ensures the user's Firebase profile exists before sending.
- A failed admin-status lookup no longer blocks normal users.
- Shows a styled error if Firebase denies the chat write.
- Updated chat rules prevent users from spoofing Admin/Verified badges.

IMPORTANT:
After uploading the website files to GitHub, also open:
Firebase Console > Realtime Database > Rules

Paste the contents of `database.rules.json` and press **Publish**.
GitHub upload does not automatically publish Firebase Database rules.

## Live Chat `ensureInfinityUser is not defined` fix
This version guarantees `user-utils.js` loads before `app.js` on `index.html`.

It also includes fallback `ensureInfinityUser()` and `makeInfinityId()` helpers inside `app.js`, so Live Chat will not break even if the helper script fails to load because of caching or a deployment mismatch.

After uploading the new files to GitHub Pages:
1. Wait for the green GitHub Pages deployment.
2. Open the website.
3. Hard refresh / clear site cache if the old JavaScript is still cached.


## User Management list fix
The Admin Panel previously tried to read `/users`, but the Firebase rules correctly protect that node.
Because the Admin Panel currently uses a local/static username/password instead of Firebase Admin Authentication, Firebase rejected that read, so it showed **No users found**.

This version adds a safe public directory:
`publicUsers/{uid}`

Each logged-in/registered user automatically mirrors only:
- displayName
- profile photo URL
- INF ID

The Admin Panel reads that safe directory, so registered users can be listed without exposing user emails.

IMPORTANT:
Publish the included `database.rules.json` in Firebase Realtime Database > Rules.

Existing users may need to login once after this update so their `publicUsers/{uid}` entry is created.

Ban/Unban/Verified writes still require a secure Firebase-authenticated admin or backend if your rules protect `/users`.


## FIX: Ban / Unban / Verified Permission Denied
The permission error happened because the Admin Panel was using only a local/static login, so Firebase saw the browser as an unauthenticated visitor.

This version keeps the visible Admin UI as **Username + Password**, but authenticates that admin securely with Firebase in the background.

### One-time Firebase setup
1. Firebase Console > Authentication > Sign-in method > enable **Email/Password**.
2. Firebase Console > Authentication > Users > Add user.
3. Use:
   - Email: `infinityadmin@infinityrp.com`
   - Password: choose your admin password
4. Copy that user's Firebase UID.
5. Realtime Database > Data:
   - create `admins`
   - under it create the copied UID
   - set its value to `true`
6. Realtime Database > Rules:
   - paste this ZIP's `database.rules.json`
   - press **Publish**

### Admin login on the website
The website still asks for:
- Username: `infinityadmin`
- Password: the same password you created in Firebase

After this, User Management can securely:
- Give Verified
- Remove Verified
- Ban
- Unban

No email is shown or typed in the Admin Panel UI.
