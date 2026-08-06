# React Native Fishjam example

## Prerequisites

Copy `.env.example` to `.env` in this directory and fill in the required value:

- `EXPO_PUBLIC_FISHJAM_ID` - Fishjam ID for production environment

You can find the value for this variable by creating an account on [fishjam.io](https://fishjam.io) and copying it from the sandbox dashboard.

There also exists this additional environment variable, which is used for internal testing purposes:

- `EXPO_PUBLIC_VIDEOROOM_STAGING_SANDBOX_URL` - Sandbox URL for VideoRoom staging environment

## Example Overview

The app has 2 tabs showing different ways to connect to Fishjam video calls:

**VideoRoom** - Connect to VideoRoom (Fishjam's demo service, something like Google Meet) by entering a room name and username. The app automatically creates the room and generates tokens for you.

**Livestream** - Join existing livestreams or create your own livestream.

## Project setup

1. Clone the repository:

```
git clone https://github.com/fishjam-cloud/examples.git
cd examples/mobile-react-native/fishjam-chat
```

2. Install dependencies:

```sh
yarn
```

> [!IMPORTANT]
> Before prebuilding, replace all occurrences of `io.fishjam.example.fishjamchat` in `app.json` with your own bundle identifier:
>
> - **iOS bundle identifier** — `expo.ios.bundleIdentifier`
> - **Android package name** — `expo.android.package`
>
> For example, if your bundle ID is `com.yourcompany.yourapp`:
>
> - iOS & Android: `com.yourcompany.yourapp`
> - ScreenBroadcastExtension: `com.yourcompany.yourapp.ScreenBroadcastExtension`
> - App group: `group.com.yourcompany.yourapp`

3. Prebuild native files:

```sh
npx expo prebuild --clean
```

> [!NOTE]
> Be sure to run `npx expo prebuild` and not `yarn prebuild` as there's an issue with path generation for the `ios/.xcode.env.local` file

4. Build app:

```
yarn ios
yarn android
```
