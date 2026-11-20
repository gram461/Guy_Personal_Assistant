# Synergy phone app (iPhone and Android)

A thin native shell, built with [Capacitor](https://capacitorjs.com), that shows the Synergy website's `/app` page
(`capacitor.config.json`, `server.url`) and adds what a website can't do: a **Schoology sign-in window** inside the app.

## How the Schoology sign-in works

1. The person taps *Sign in to Schoology*. The app opens `fuhsd.schoology.com` in the in-app browser plugin
   ([`@capgo/inappbrowser`](https://github.com/Cap-go/capacitor-inappbrowser)).
2. They sign in as usual. Their password is typed into Schoology's own page and never reaches Synergy.
3. When the window reaches their Schoology home page, the app injects `public/synergy-native-grabber.js` there.
   It reads their grades with that window's login and sends them back to the app.
4. The app closes the window and saves the grades **on the phone**. Nothing is uploaded to a server.

The code is in `components/synergy/nativeSignIn.ts` and `appBridge.ts` (website side) and
`Guy-Scraper/browser/nativeGrabber.ts` (the injected script).

## How the app connects to the PWA

The phone app and the installable website (PWA) are the same page: the shell loads `/app`, which is also the PWA's `start_url`.
Fix something on the website and both update, with no new store release. What the shell adds, and what was adapted for it:

- **Native detection:** the page asks Capacitor whether it is inside the shell and, if so, uses the phone bridge
  (the Schoology sign-in window) instead of the website's bookmark and file import. A phone's Chrome or Safari still counts as the website.
- **Screen edges:** the page uses the whole screen and keeps content clear of the notch and home bar with `viewport-fit=cover` and
  `env(safe-area-inset-*)` (`app/layout.tsx`, `Guy-Scraper/desktop/ui/styles.css`).
- **No web service worker inside the shell:** the website's push-notification worker isn't registered there (`components/AuthProvider.tsx`).
- **Icons and launch screen:** the source images are in `assets/`; `npm run assets` turns them into every size iOS and Android need.

## What you need before building

| For | You need |
|---|---|
| Both | Node 20+ and `npm install` run in this folder |
| iPhone (`.ipa`) | A Mac with **Xcode** (App Store), **CocoaPods** (`brew install cocoapods`), and an Apple Developer account (US$99/year) to sign and distribute |
| Android (`.aab`) | **Android Studio** (includes the Android SDK and a JDK), and an **upload keystore** that you create once and keep safe forever (losing it means you can't update the app). A Google Play developer account is US$25, once |

Run `npm run doctor` to see what this computer is missing.

## Build steps (not done yet; waiting for the go-ahead)

```bash
npm install
npm run add:ios        # creates the ios/ project (needs Xcode + CocoaPods)
npm run add:android    # creates the android/ project (needs Android Studio)
npm run assets         # makes the app icons and launch screens from assets/
npm run sync           # copies the config and plugins into both projects
```

- **iPhone:** `npm run open:ios`, choose your team under *Signing & Capabilities*, then *Product > Archive* and *Distribute App* to export the `.ipa`.
- **Android:** `npm run open:android`, then *Build > Generate Signed App Bundle* with your keystore to export the `.aab`.

## Known limits

- **Calendar and Email aren't in the phone app.** Google refuses sign-in inside an app's own window. They stay on the website.
- **Apple review.** Apple can reject apps that only wrap a website. The native Schoology sign-in window is the main native feature;
  expect to explain it in the review notes.
- **The app needs the website to be up**, because it loads Synergy from there. Use your own domain in `server.url` before publishing.
- **No store listing yet:** screenshots, descriptions, an app icon and a privacy "nutrition label" are still to do.
