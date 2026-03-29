import { useEffect, useState } from "react";
import { Conference } from "./components/Conference";
import { JoinForm } from "./components/JoinForm";

type AppState =
  | { status: "idle"; initialRoomName?: string }
  | { status: "joined"; whepUrl: string; roomName: string; peerName: string };

function getRoomNameFromURL(): string {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return path || "";
}

export function App() {
  const [state, setState] = useState<AppState>(() => {
    const initialRoomName = getRoomNameFromURL();
    return { status: "idle", initialRoomName };
  });

  useEffect(() => {
    function handlePopState() {
      const roomName = getRoomNameFromURL();
      if (!roomName && state.status === "joined") {
        setState({ status: "idle" });
      } else if (roomName && state.status === "idle") {
        setState({ status: "idle", initialRoomName: roomName });
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [state.status]);

  if (state.status === "joined") {
    return (
      <Conference
        whepUrl={state.whepUrl}
        roomName={state.roomName}
        peerName={state.peerName}
        onLeave={() => {
          history.pushState({}, "", "/");
          setState({ status: "idle" });
        }}
      />
    );
  }

  return (
    <JoinForm
      initialRoomName={state.initialRoomName}
      onJoined={({ whepUrl, roomName, peerName }) => {
        history.pushState({}, "", `/${roomName}`);
        setState({ status: "joined", whepUrl, roomName, peerName });
      }}
    />
  );
}
