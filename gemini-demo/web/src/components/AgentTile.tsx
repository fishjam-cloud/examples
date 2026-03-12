import geminiLogo from "/gemini.png";

export function AgentTile({ connected }: { connected: boolean }) {
  return (
    <div style={styles.tile}>
      <img
        src={geminiLogo}
        alt="Gemini"
        style={{
          ...styles.logo,
          animation: connected ? "agent-pulse 2s ease-in-out infinite" : "none",
          opacity: connected ? 1 : 0.4,
        }}
      />
      <div
        style={{
          fontSize: 13,
          color: connected ? "#666" : "#aaa",
          marginTop: 12,
        }}
      >
        {connected ? "Listening..." : "Connecting..."}
      </div>
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
    background: "#fff",
    border: "1px solid #eee",
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
