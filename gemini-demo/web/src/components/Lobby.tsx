interface LobbyProps {
  roomId: string | null;
  name: string;
  loading: string | null;
  onNameChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoin: () => void;
}

export function Lobby({
  roomId,
  name,
  loading,
  onNameChange,
  onCreateRoom,
  onJoin,
}: LobbyProps) {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Gemini Demo</h1>
      <p style={styles.subtitle}>Voice call with a Gemini Live AI agent</p>

      <div style={styles.card}>
        {!roomId ? (
          <button
            style={styles.button}
            onClick={onCreateRoom}
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
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onJoin()}
              autoFocus
            />
            <button
              style={styles.button}
              onClick={onJoin}
              disabled={!name || !!loading}
            >
              {loading ? "Joining..." : "Join"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

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
    textAlign: "center",
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
};
