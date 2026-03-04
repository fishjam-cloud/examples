import { useState } from "react";
import { Conference } from "./components/Conference";
import { JoinForm } from "./components/JoinForm";

type AppState =
  | { status: "idle" }
  | { status: "joined"; whepUrl: string };

export function App() {
  const [state, setState] = useState<AppState>({ status: "idle" });

  if (state.status === "joined") {
    return (
      <Conference
        whepUrl={state.whepUrl}
        onLeave={() => setState({ status: "idle" })}
      />
    );
  }

  return (
    <JoinForm
      onJoined={(whepUrl) => setState({ status: "joined", whepUrl })}
    />
  );
}
