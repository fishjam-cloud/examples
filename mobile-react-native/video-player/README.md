# React Native Fishjam Video Player example

This example provides a minimal, working livestreaming app using Fishjam.

---

## Running the Example app

1.  Clone the repository:

    ```bash
    git clone https://github.com/fishjam-cloud/examples.git
    cd examples
    ```

2.  Install dependencies in the example directory:

    ```bash
    cd mobile-react-native/video-player
    yarn
    ```

3.  Prebuild native files:

    ```bash
    npx expo prebuild --clean
    ```

    > [!NOTE]
    > Be sure to run `npx expo prebuild` and not `yarn prebuild` as there's an issue with path generation for the `ios/.xcode.env.local` file

4.  **Create a `.env` file** in the `mobile-react-native/video-player` directory.

Add your fishjam ID and Sandbox API URL (copy both from the sandbox dashboard at [https://fishjam.io/app/sandbox](https://fishjam.io/app/sandbox)):

```bash
EXPO_PUBLIC_FISHJAM_ID=<your_fishjam_ID>
EXPO_PUBLIC_SANDBOX_API_URL=<your_sandbox_api_url>
```

5.  Build app:

    ```bash
    yarn ios
    yarn android
    ```
