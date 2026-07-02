# examples

A collection of ~20 example apps demonstrating Fishjam SDKs, grouped under `mobile-react-native/`, `web-react/`, `web-ts/`, plus standalone demos (`deep-sea-stories`, `gemini-demo`, `moq-demo`, `translation-demo`).

## Cursor Cloud specific instructions

Node (via nvm) and Corepack are pre-installed. Each app is an independent project (mostly Yarn Berry; `fishjam-react-native-webrtc`-style apps may use npm) — install per app directory (`yarn install` / `npm install`) as needed.

- Validated across all 20 apps: dependency install succeeds, and the best available check per app passes — web apps via `yarn build`, TS libs via `yarn typecheck`, React Native apps via `yarn lint` (native iOS/Android builds are not possible headless). `mobile-react-native/common` is a shared library with no validation script.
- The apps are demos that need a running Fishjam backend (and API keys, e.g. Gemini for `gemini-demo`) configured via each app's env to actually connect; build/typecheck/lint work standalone.
