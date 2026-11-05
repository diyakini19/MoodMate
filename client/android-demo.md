# MoodMate Android (college demo)

The Android app wraps the same Vite/React website with Capacitor. The website is unchanged.

## One-time setup

1. Install [Android Studio](https://developer.android.com/studio) (includes Android SDK + a compatible JDK).
2. Open Android Studio once → finish setup wizard → install an SDK Platform + a virtual device (or use a USB phone with USB debugging).
3. Use **JDK 17 or 21** for Gradle (Android Studio’s bundled JBR is fine). Java 25 alone can fail builds with `Unsupported class file major version 69`.
4. In `client/`:

```bash
npm install
npm run build:android
```

## Build a trial (debug) APK

### Option A — Android Studio (recommended)

```bash
cd client
npm run android
```

This builds the web app, syncs into `android/`, and opens Android Studio.

Then: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Typical APK path:

`client/android/app/build/outputs/apk/debug/app-debug.apk`

### Option B — command line (after Android Studio is installed)

```bash
cd client
npm run build:android
cd android
.\gradlew.bat assembleDebug
```

APK:

`android/app/build/outputs/apk/debug/app-debug.apk`

Copy that file to a phone and install it (enable **Install unknown apps** for your file manager / browser).

## Local API from a phone

`VITE_API_URL=http://localhost:8080` only works on the device itself.

For a real phone on the same Wi‑Fi:

1. Find your PC LAN IP (e.g. `192.168.1.10`).
2. Run the Express server on the PC (`server` on port 8080).
3. Before `npm run build:android`, set in `client/.env`:

```env
VITE_API_URL=http://192.168.1.10:8080
```

4. Rebuild the APK. Firebase auth still needs internet; travel APIs need the PC server reachable.

Emulator tip: `http://10.0.2.2:8080` reaches the host PC’s `localhost`.

## After website changes

```bash
cd client
npm run build:android
```

Then rebuild/reinstall the APK. No Play Store / OTA for this college build.

## Project layout

- `capacitor.config.json` — app id `app.moodmate`
- `android/` — native Android project (generated)
- Website source stays in `src/` (same as always)
