import {
  useCamera,
  useMicrophone,
  usePeers,
} from "@fishjam-cloud/react-client";
import { useMemo, useState } from "react";
import { trpc } from "../trpc";
import { PeerTile } from "./PeerTile";
import { AgentTile } from "./AgentTile";
import { Toolbar } from "./Toolbar";
import { SystemPromptModal } from "./SystemPromptModal";

interface CallViewProps {
  roomId: string;
  roomName: string;
  onLeave: () => void;
}

export function CallView({ roomId, roomName, onLeave }: CallViewProps) {
  const [showPromptModal, setShowPromptModal] = useState(false);

  const { isCameraOn, toggleCamera, cameraStream } = useCamera();
  const { isMicrophoneMuted, toggleMicrophoneMute } = useMicrophone();

  const { remotePeers } = usePeers<{ name: string }>();

  const agentPeer = useMemo(
    () => remotePeers.find((p) => !p.metadata),
    [remotePeers],
  );
  const humanPeers = useMemo(
    () => remotePeers.filter((p) => p.metadata),
    [remotePeers],
  );

  const handleStartAgent = async (systemPrompt: string) => {
    setShowPromptModal(false);
    await trpc.createAgent.mutate({ roomId, systemPrompt });
  };

  const handleLeave = async () => {
    onLeave();
  };

  return (
    <div style={styles.container}>
      <Toolbar
        roomName={roomName}
        agentActive={!!agentPeer}
        onAddAgent={() => setShowPromptModal(true)}
        onLeave={handleLeave}
      />

      <div style={styles.peerGrid}>
        <PeerTile
          name="You"
          stream={cameraStream}
          controls={
            <div style={styles.controls}>
              <button style={styles.controlBtn} onClick={toggleMicrophoneMute}>
                {isMicrophoneMuted ? "Unmute" : "Mute"}
              </button>
              <button style={styles.controlBtn} onClick={toggleCamera}>
                {isCameraOn ? "Cam Off" : "Cam On"}
              </button>
            </div>
          }
        />

        {humanPeers.map((peer) => (
          <PeerTile
            key={peer.id}
            name={peer.metadata?.peer?.name ?? peer.id}
            stream={peer.cameraTrack?.stream}
            audioStream={peer.microphoneTrack?.stream}
          />
        ))}

        <AgentTile agentPeer={agentPeer} />
      </div>

      {showPromptModal && (
        <SystemPromptModal
          onStart={handleStartAgent}
          onClose={() => setShowPromptModal(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#fff",
  },
  peerGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))",
    gap: 32,
    padding: 32,
    overflow: "hidden",
    alignContent: "center",
    maxWidth: 1300,
    width: "100%",
    margin: "0 auto",
  },
  controls: {
    position: "absolute",
    bottom: 8,
    right: 10,
    display: "flex",
    gap: 6,
  },
  controlBtn: {
    padding: "4px 10px",
    fontSize: 12,
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
};
