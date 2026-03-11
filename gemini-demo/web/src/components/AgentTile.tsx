export function AgentTile({ connected }: { connected: boolean }) {
  return (
    <div style={styles.tile}>
      <div style={styles.inner}>
        <div style={styles.orb}>
          <div
            style={{
              ...styles.orbRing,
              animation: connected
                ? "agent-pulse 2s ease-in-out infinite"
                : "none",
              opacity: connected ? 1 : 0.3,
            }}
          />
          <div style={styles.orbCore} />
        </div>
        <div
          style={{
            fontSize: 13,
            color: connected ? "#666" : "#aaa",
            marginTop: 12,
          }}
        >
          {connected ? "Listening..." : "Connecting..."}
        </div>
      </div>
      <div style={styles.name}>Gemini Agent</div>
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tile: {
    position: "relative",
    background: "#f5f5f5",
    borderRadius: 10,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
    background: "#1a1a2e",
  },
  orb: {
    position: "relative",
    width: 64,
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  orbCore: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
  orbRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "2px solid #8b5cf6",
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
