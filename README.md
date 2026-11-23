# PANTHALCHAAM — Local Demo Edition

A separate, offline showcase build of PANTHALCHAAM. It is designed to demonstrate the customer, owner and admin experience on **one device only**.

## Important demo limits

- No Firebase, no backend, no real online booking, and no sharing or synchronization with other phones.
- All demo data is saved in the app's local storage on this device.
- Clearing app data or uninstalling the app can erase the demo data. Use **Admin → Notice & settings → Export backup** to save a JSON backup.
- The admin PIN is intentionally a demo bypass: any non-empty PIN opens the demo admin dashboard. This is not authentication and must never be used for a live booking service.
- Demo owner accounts: `OWNER01` / `1234` and `OWNER02` / `1234`.
- Customer booking does not require a login.
- Local notifications and the PANTHALCHAAM alert sound are device-only. Android notification permission must be allowed. Android notification-channel settings may need to be enabled in system Settings.
- The in-app logo can be replaced in demo settings, but the Android launcher icon remains the original PANTHALCHAAM logo for this installed demo.

## Included showcase features

- Original PANTHALCHAAM black-and-gold logo, app name and launcher icon.
- Customer turf browsing and booking without registration.
- 5s and 7s with separate hourly prices at every turf; exactly one demo turf initially offers Mini 7s with its own price.
- Local slot-overlap checks, booking ID and access code, booking status and local booking list.
- Admin demo login with any non-empty PIN.
- Owner demo accounts, owner ID/PIN login, turf assignment, owner booking queue and credit balance.
- Approve/decline booking requests and submit/verify payment proof.
- A once-only ₹50 owner credit when an approved booking's payment is verified.
- Admin turf and owner management, visibility controls, turf images, QR/UPI settings, in-app logo setting, commission display setting.
- Optional custom notice board with message and image, enabled/disabled by admin.
- Local notification + PANTHALCHAAM ringtone/vibration when booking and payment events happen, where the device permits it.
- JSON backup export/import and demo-data reset.

## Build the Android APK with GitHub Actions

1. Create a **new, separate GitHub repository** for this demo. Do not put it into the Firebase/live project repository.
2. Upload all files from this ZIP to the root of the new repository, preserving folders.
3. Commit the files to the `main` branch.
4. Open the repository's **Actions** tab and select **Build PANTHALCHAAM Local Demo APK**.
5. Run the workflow (or let the first push start it).
6. When the run succeeds, open the run and download the `PANTHALCHAAM-LOCAL-DEMO-APK` artifact. Extract `app-debug.apk` and install it on the Android device.

The demo package ID is `com.panthalchaam.localdemo`, so it can be installed alongside the existing Firebase app (`com.turfbook.app`) rather than replacing it.

## Run a browser preview

```bash
npm install
npm run dev
```

The preview also uses local storage. For Android, use the included GitHub Actions workflow so the Capacitor Android project and ringtone resource are packaged correctly.
