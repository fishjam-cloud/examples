import {
  useCamera,
  useConnection,
  useInitializeDevices,
  useMicrophone,
  usePeers,
} from "@fishjam-cloud/react-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "./trpc";

type View = "lobby" | "call";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful voice assistant in a video call.
Keep your responses concise and conversational.
You can use Google Search to look up current information when asked.`;

export default function App() {
  const [view, setView] = useState<View>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [agentActive, setAgentActive] = useState(false);
  const [loading, setLoading] = useState("");

  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const { isCameraOn, toggleCamera, cameraStream } = useCamera();
  const { isMicrophoneMuted, toggleMicrophoneMute } = useMicrophone();
  const { remotePeers, localPeer } = usePeers<{ name: string }>();

  const agentAudioRef = useRef<HTMLAudioElement>(null);

  // Agent peer has no metadata
  const agentPeer = useMemo(
    () => remotePeers.find((p) => !p.metadata),
    [remotePeers],
  );
  const humanPeers = useMemo(
    () => remotePeers.filter((p) => p.metadata),
    [remotePeers],
  );

  // Play agent audio
  useEffect(() => {
    if (!agentAudioRef.current) return;
    agentAudioRef.current.srcObject = agentPeer?.tracks[0]?.stream ?? null;
  }, [agentPeer?.tracks[0]?.stream]);

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
      console.log("token", token);
      await joinRoom({ peerToken: token, peerMetadata: { name } });
      console.log("room joined");
      if (!isCameraOn) await toggleCamera();
      console.log("camera on");
      setView("call");
    } finally {
      setLoading("");
    }
  }, [roomId, name, joinRoom, initializeDevices, isCameraOn, toggleCamera]);

  const handleStartAgent = useCallback(async () => {
    if (!roomId) return;
    setLoading("Starting agent...");
    try {
      await trpc.createAgent.mutate({ roomId, systemPrompt });
      setAgentActive(true);
    } finally {
      setLoading("");
    }
  }, [roomId, systemPrompt]);

  const handleLeave = useCallback(async () => {
    if (roomId && agentActive) {
      await trpc.removeAgent.mutate({ roomId }).catch(() => {});
    }
    leaveRoom();
    setView("lobby");
    setRoomId(null);
    setAgentActive(false);
  }, [roomId, agentActive, leaveRoom]);

  if (view === "lobby") {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Gemini Demo</h1>
        <p style={styles.subtitle}>Voice call with a Gemini Live AI agent</p>

        <div style={styles.card}>
          {!roomId ? (
            <button
              style={styles.button}
              onClick={handleCreateRoom}
              disabled={!!loading}
            >
              {loading || "Create Room"}
            </button>
          ) : (
            <>
              <p style={styles.roomId}>Room: {roomId}</p>
              <input
                style={styles.input}
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
              />
              <button
                style={styles.button}
                onClick={handleJoin}
                disabled={!name || !!loading}
              >
                {loading || "Join"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.callContainer}>
      <div style={styles.topBar}>
        <span style={styles.roomLabel}>Room: {roomId}</span>
        <button style={styles.leaveButton} onClick={handleLeave}>
          Leave
        </button>
      </div>

      <div style={styles.peerGrid}>
        {/* Local peer */}
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

        {/* Remote human peers */}
        {humanPeers.map((peer) => (
          <PeerTile
            key={peer.id}
            name={peer.metadata?.peer?.name ?? peer.id}
            stream={peer.cameraTrack?.stream}
            audioStream={peer.microphoneTrack?.stream}
          />
        ))}
      </div>

      {/* Agent panel */}
      {!agentActive ? (
        <div style={styles.agentPanel}>
          <textarea
            style={styles.textarea}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="System prompt for the AI agent..."
          />
          <button
            style={styles.button}
            onClick={handleStartAgent}
            disabled={!!loading}
          >
            {loading || "Start Agent"}
          </button>
        </div>
      ) : (
        <div style={styles.agentStatus}>
          Agent is active
          {agentPeer ? " and connected" : " (connecting...)"}
        </div>
      )}

      {/* Hidden audio element for agent */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={agentAudioRef} autoPlay playsInline />
    </div>
  );
}

// --- PeerTile component ---

function PeerTile({
  name,
  stream,
  audioStream,
  controls,
}: {
  name: string;
  stream?: MediaStream | null;
  audioStream?: MediaStream | null;
  controls?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = audioStream ?? null;
    }
  }, [audioStream]);

  return (
    <div style={styles.peerTile}>
      {stream ? (
        <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
      ) : (
        <div style={styles.noVideo}>{name}</div>
      )}
      <div style={styles.peerName}>{name}</div>
      {controls}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
    </div>
  );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#fff",
    color: "#111",
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 32,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: 320,
    alignItems: "stretch",
  },
  roomId: {
    fontSize: 13,
    color: "#666",
    textAlign: "center" as const,
    margin: 0,
    fontFamily: "monospace",
  },
  input: {
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 6,
    outline: "none",
  },
  button: {
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 500,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  callContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#fff",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    borderBottom: "1px solid #eee",
  },
  roomLabel: {
    fontSize: 13,
    color: "#666",
    fontFamily: "monospace",
  },
  leaveButton: {
    padding: "6px 16px",
    fontSize: 13,
    background: "#fff",
    color: "#e00",
    border: "1px solid #e00",
    borderRadius: 6,
    cursor: "pointer",
  },
  peerGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
    padding: 12,
    overflow: "hidden",
  },
  peerTile: {
    position: "relative" as const,
    background: "#f5f5f5",
    borderRadius: 10,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  noVideo: {
    fontSize: 18,
    color: "#999",
  },
  peerName: {
    position: "absolute" as const,
    bottom: 8,
    left: 10,
    fontSize: 13,
    color: "#fff",
    background: "rgba(0,0,0,0.5)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  controls: {
    position: "absolute" as const,
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
  agentPanel: {
    display: "flex",
    gap: 12,
    padding: "12px 20px",
    borderTop: "1px solid #eee",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    padding: "8px 12px",
    fontSize: 13,
    border: "1px solid #ddd",
    borderRadius: 6,
    resize: "vertical" as const,
    fontFamily: "inherit",
    outline: "none",
  },
  agentStatus: {
    padding: "12px 20px",
    borderTop: "1px solid #eee",
    fontSize: 13,
    color: "#666",
    textAlign: "center" as const,
  },
};
