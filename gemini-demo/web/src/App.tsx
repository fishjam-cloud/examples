import {
  useCamera,
  useConnection,
  useInitializeDevices,
} from "@fishjam-cloud/react-client";
import { useCallback, useState } from "react";
import { trpc } from "./trpc";
import { Lobby } from "./components/Lobby";
import { CallView } from "./components/CallView";

type View = "lobby" | "call";

export default function App() {
  const [view, setView] = useState<View>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);

  const { joinRoom, leaveRoom } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const { isCameraOn, toggleCamera } = useCamera();

  const handleJoin = useCallback(
    async (roomName: string, userName: string) => {
      setLoading("Joining...");
      try {
        const { id } = await trpc.joinOrCreateRoom.mutate({ roomName });
        setRoomId(id);
        setRoomName(roomName);

        await initializeDevices();
        const { token } = await trpc.createPeer.mutate({
          roomId: id,
          name: userName,
        });

        await joinRoom({ peerToken: token, peerMetadata: { name: userName } });

        if (!isCameraOn) await toggleCamera();
        setView("call");
      } finally {
        setLoading(null);
      }
    },
    [joinRoom, initializeDevices, isCameraOn, toggleCamera],
  );

  const handleLeave = useCallback(() => {
    leaveRoom();
    setView("lobby");
    setRoomId(null);
    setRoomName("");
  }, [leaveRoom]);

  if (view === "lobby") {
    return <Lobby loading={loading} onJoin={handleJoin} />;
  }

  return <CallView roomId={roomId!} roomName={roomName} onLeave={handleLeave} />;
}
