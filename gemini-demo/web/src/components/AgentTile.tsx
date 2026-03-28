import type { PeerWithTracks } from "@fishjam-cloud/react-client";
import geminiLogo from "/gemini.png";
import { useEffect, useRef } from "react";

export function AgentTile({
  agentPeer,
}: {
  agentPeer: PeerWithTracks<unknown, unknown> | undefined;
}) {
  const agentAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!agentAudioRef.current) return;
    agentAudioRef.current.srcObject = agentPeer?.tracks[0]?.stream ?? null;
  }, [agentPeer?.tracks[0]?.stream]);

  if (!agentPeer) return null;
  return (
    <div style={styles.tile}>
      <img
        src={geminiLogo}
        alt="Gemini"
        style={{
          ...styles.logo,
          animation: agentPeer ? "agent-pulse 2s ease-in-out infinite" : "none",
          opacity: agentPeer ? 1 : 0.4,
        }}
      />

      <audio ref={agentAudioRef} playsInline autoPlay />

      <div style={styles.name}>Gemini Agent</div>
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tile: {
    position: "relative",
    background: "#eee",
    border: "1px solid #ddd",
    borderRadius: 10,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: 560,
  },
  logo: {
    width: 64,
    height: 64,
  },
  name: {
    position: "absolute",
    bottom: 8,
    left: 10,
    fontSize: 13,
    color: "#fff",
    background: "rgba(0,0,0,0.5)",
    padding: "2px 8px",
    borderRadius: 4,
  },
};
