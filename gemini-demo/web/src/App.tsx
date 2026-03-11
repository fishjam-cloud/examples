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
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const { joinRoom, leaveRoom } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const { isCameraOn, toggleCamera } = useCamera();

  const handleCreateRoom = useCallback(async () => {
    setLoading("Creating room...");
    try {
      const room = await trpc.createRoom.mutate();
      setRoomId(room.id);
    } finally {
      setLoading("");
    }
  }, []);

  const handleJoin = useCallback(async () => {
    if (!roomId || !name) return;
    setLoading("Joining...");
    try {
      await initializeDevices();
      const { token } = await trpc.createPeer.mutate({ roomId, name });

      await joinRoom({ peerToken: token, peerMetadata: { name } });

      if (!isCameraOn) await toggleCamera();
      setView("call");
    } finally {
      setLoading(null);
    }
  }, [roomId, name, joinRoom, initializeDevices, isCameraOn, toggleCamera]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    setView("lobby");
    setRoomId(null);
  }, [leaveRoom]);

  if (view === "lobby") {
    return (
      <Lobby
        roomId={roomId}
        name={name}
        loading={loading}
        onNameChange={setName}
        onCreateRoom={handleCreateRoom}
        onJoin={handleJoin}
      />
    );
  }

  return <CallView roomId={roomId!} onLeave={handleLeave} />;
}
