# VoIP call example

A two-user calling app: an Expo React Native client (`app/`) and a small Deno
push + signaling server (`server/`). Calls ring through the native call UI
(CallKit on iOS, Telecom on Android) even when the app is backgrounded or
killed, and connect through a Fishjam room.

How it all works (native configuration, `VoipProvider`, and the JS call flow)
is documented in the
[VoIP calls guide](https://documentation.fishjam.io/docs/how-to/client/voip-calls);
this README only covers running the example.

## Running the example

VoIP pushes can only be delivered through your own Apple and Firebase accounts,
so the first step is minting push credentials. Configure APNs to call iOS
devices, FCM to call Android devices, or both to call between them.

1. **Server credentials.** Create the APNs VoIP certificate (`apns.pem`) and/or
   the FCM service account key (`fcm-credentials.json`) as described in
   [`server/README.md`](./server/README.md), then start the server:

   ```bash
   cd server
   deno task start   # listens on :4400
   ```

2. **`google-services.json` (Android only).** The file is gitignored, so you
   have to fetch your own. In the
   [Firebase console](https://console.firebase.google.com/), open the same
   project the server's `fcm-credentials.json` came from → _Project settings_ →
   _Your apps_ → add an **Android** app if none exists → download
   `google-services.json` → save it at `app/google-services.json`.

   Its `package_name` must match `android.package` in `app.json` exactly
   (`io.fishjam.example.voipcall`), or the build fails with
   `No matching client found for package name`. Keep the file at the app root:
   `expo prebuild` copies it into `android/` for you, and a copy placed inside
   `android/` by hand doesn't survive `expo prebuild --clean`.

3. **App environment.** Copy `app/.env.example` to `app/.env` and fill it in:
   - `EXPO_PUBLIC_FISHJAM_ID`: your Fishjam app id.
   - `EXPO_PUBLIC_SANDBOX_API_URL`: the Sandbox API url from your Fishjam
     dashboard, used to mint peer tokens.
   - `EXPO_PUBLIC_VOIP_SERVER_URL`: where the devices can reach the server
     above. Not `localhost` when running on a physical phone; use your
     machine's LAN address.

4. **Run on real devices.** VoIP pushes never reach the iOS Simulator, and FCM
   needs Google Play services.

   ```bash
   cd app
   yarn
   yarn ios       # or: yarn android
   ```

To test it, register two users on two devices and call between them. The
[guide's checklist](https://documentation.fishjam.io/docs/how-to/client/voip-calls#11-test-it)
lists the paths worth checking: ringing with the app killed, Recents redial,
and Hold & Accept.

## Local SDK checkout

Unlike the other examples here, this one does not build against published
packages alone. The VoIP support it needs is not on npm yet:

- `@fishjam-cloud/ios-expo-voip` has never been published.
- The `useVoip` / `VoipProvider` API is missing from the published
  `@fishjam-cloud/react-native-client`.
- The iOS `VoipManager` native code is missing from the published
  `@fishjam-cloud/react-native-webrtc`.

So `app/package.json` resolves those three through `link:` to a local
[`web-client-sdk`](https://github.com/fishjam-cloud/web-client-sdk) checkout,
expected as a sibling of this repository:

```
Desktop/
  examples/            <- you are here
  web-client-sdk/      <- expected at ../../../../web-client-sdk
```

Two extra pieces make that work under Yarn 1 and Metro:

- **`resolutions` in `app/package.json`.** The linked packages declare their own
  dependencies with Yarn Berry's `workspace:*` protocol, which Yarn 1 cannot
  resolve. The overrides pin those to the published `0.29.0` instead. The
  top-level `link:` still wins for `react-native-webrtc`, so the local native
  code is what actually gets built.
- **`app/metro.config.js`.** It adds the checkout to `watchFolders` and to
  `nodeModulesPaths`, so Metro can bundle the symlinked sources, and forces a
  single copy of `react` / `react-native`.

If your checkout lives elsewhere, adjust the `link:` paths. Once the packages
ship to npm, replace each `link:` with a plain version range and delete both
`resolutions` and `app/metro.config.js`.
