import {
  useConnection,
  useInitializeDevices,
} from "@fishjam-cloud/react-client";
import { useEffect } from "react";

import { MicrophoneSettings } from "./MicrophoneSettings";
import { PeerList } from "./PeerList";
import { RoomInfo } from "./RoomInfo";

function App() {
  const { initializeDevices } = useInitializeDevices();
  const { peerStatus } = useConnection();

  useEffect(() => {
    initializeDevices({ enableVideo: false });
  }, [initializeDevices]);

  return (
    <main>
      <h1 className="text-red-500">Audio only chat example</h1>

      <MicrophoneSettings />

      <RoomInfo />

      {peerStatus === "connected" && <PeerList />}
    </main>
  );
}

export default App;
