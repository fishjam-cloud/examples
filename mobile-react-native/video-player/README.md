# React Native Fishjam Video Player example

This example provides a minimal, working livestreaming app using Fishjam.

---

## Running the Example app

1.  Clone the repository:

    ```bash
    git clone https://github.com/fishjam-cloud/examples.git
    cd examples/mobile-react-native/video-player
    ```

2.  Install dependencies:

    ```bash
    yarn
    ```

3.  Prebuild native files:

    ```bash
    npx expo prebuild --clean
    ```

    > [!NOTE]
    > Be sure to run `npx expo prebuild` and not `yarn prebuild` as there's an issue with path generation for the `ios/.xcode.env.local` file

4.  **Create a `.env` file** in this directory.

Add your fishjam ID:

```bash
EXPO_PUBLIC_FISHJAM_ID=<your_fishjam_ID>
```

5.  Build app:

    ```bash
    yarn ios
    yarn android
    ```
