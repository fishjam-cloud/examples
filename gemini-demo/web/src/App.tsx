import { useConnection } from "@fishjam-cloud/react-client";
import { useCallback, useState } from "react";
import { Lobby } from "./components/Lobby";
import { CallView } from "./components/CallView";

type View = "lobby" | "call";

export default function App() {
  const [view, setView] = useState<View>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");

  const { leaveRoom } = useConnection();

  const handleLeave = useCallback(() => {
    leaveRoom();
    setView("lobby");
    setRoomId(null);
    setRoomName("");
  }, [leaveRoom]);

  if (view === "lobby") {
    return (
      <Lobby
        onJoined={(roomId: string, roomName) => {
          setView("call");
          setRoomId(roomId);
          setRoomName(roomName);
        }}
      />
    );
  }

  return (
    <CallView roomId={roomId!} roomName={roomName} onLeave={handleLeave} />
  );
}
