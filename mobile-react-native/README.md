# Examples for Fishjam client

- [Minimal React Native](./minimal-react-native/) - minimal example
  - joining a video room with a custom room name and user name
  - real-time video grid with local and remote participants
  - almost no UI

- [Fishjam Chat](./fishjam-chat/) - example video chat app
  - connecting to VideoRoom by entering a room name and username
  - streaming camera, microphone and screen sharing
  - joining and creating livestreams

- [Background Blur](./blur-example/) - example of applying background blur
  - toggling camera background blur on/off during a video call
  - using a camera track middleware

- [Text Chat](./text-chat/) - example text messaging app
  - real-time text messaging between participants
  - using WebRTC data channels

- [Video Player](./video-player/) - minimal livestreaming viewer
  - joining an existing livestream as a viewer

- [VoIP Call](./voip-call/) - two-user calling app with native call UI
  - ringing through CallKit on iOS and Telecom on Android
  - receiving calls while the app is backgrounded or killed
  - APNs / FCM push signaling via a small Deno server
