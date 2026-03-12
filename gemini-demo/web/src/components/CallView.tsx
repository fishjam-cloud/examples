import {
  useCamera,
  useMicrophone,
  usePeers,
} from "@fishjam-cloud/react-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "../trpc";
import { PeerTile } from "./PeerTile";
import { AgentTile } from "./AgentTile";
import { Toolbar } from "./Toolbar";
import { SystemPromptModal } from "./SystemPromptModal";
import { CapturedImages } from "./CapturedImages";

export function CallView({
  roomId,
  roomName,
  onLeave,
}: {
  roomId: string;
  roomName: string;
  onLeave: () => void;
}) {
  const [agentActive, setAgentActive] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  const { isCameraOn, toggleCamera, cameraStream } = useCamera();
  const { isMicrophoneMuted, toggleMicrophoneMute } = useMicrophone();
  const { localPeer, remotePeers } = usePeers<{ name: string }>();

  const agentAudioRef = useRef<HTMLAudioElement>(null);

  const agentPeer = useMemo(
    () => remotePeers.find((p) => !p.metadata),
    [remotePeers],
  );
  const humanPeers = useMemo(
    () => remotePeers.filter((p) => p.metadata),
    [remotePeers],
  );

  useEffect(() => {
    if (!agentActive) return;

    const sub = trpc.onImageCapture.subscribe(
      { roomId },
      {
        onData: ({ dataUrl }) => {
          setCapturedImages((prev) => [dataUrl, ...prev]);
        },
      },
    );

    return () => sub.unsubscribe();
  }, [roomId, agentActive]);

  useEffect(() => {
    if (!agentAudioRef.current) return;
    agentAudioRef.current.srcObject = agentPeer?.tracks[0]?.stream ?? null;
  }, [agentPeer?.tracks[0]?.stream]);

  const handleStartAgent = async (systemPrompt: string) => {
    setShowPromptModal(false);
    await trpc.createAgent.mutate({ roomId, systemPrompt });
    setAgentActive(true);
  };

  const handleCaptureImage = async () => {
    const trackId = localPeer?.cameraTrack?.trackId;
    if (!trackId) return;
    await trpc.captureImage.mutate({ roomId, trackId });
  };

  const handleLeave = async () => {
    if (agentActive) {
      await trpc.removeAgent.mutate({ roomId }).catch(() => {});
    }
    onLeave();
  };

  return (
    <div style={styles.container}>
      <Toolbar
        roomName={roomName}
        agentActive={agentActive}
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
              {agentActive && (
                <button style={styles.controlBtn} onClick={handleCaptureImage}>
                  Capture
                </button>
              )}
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

        {agentActive && <AgentTile connected={!!agentPeer} />}
      </div>

      <CapturedImages images={capturedImages} />

      {showPromptModal && (
        <SystemPromptModal
          onStart={handleStartAgent}
          onClose={() => setShowPromptModal(false)}
        />
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={agentAudioRef} autoPlay playsInline />
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
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 32,
    padding: 32,
    overflow: "hidden",
    alignContent: "center",
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
