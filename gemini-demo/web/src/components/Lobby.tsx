import { useState } from "react";

interface LobbyProps {
  loading: string | null;
  onJoin: (roomName: string, userName: string) => void;
}

export function Lobby({ loading, onJoin }: LobbyProps) {
  const [roomName, setRoomName] = useState("");
  const [userName, setUserName] = useState("");

  const canJoin = roomName.trim() && userName.trim() && !loading;

  const handleSubmit = () => {
    if (canJoin) onJoin(roomName.trim(), userName.trim());
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Gemini x Fishjam Demo</h1>
      <p style={styles.subtitle}>Videoconference with a Gemini Live AI agent</p>

      <div style={styles.card}>
        <input
          style={styles.input}
          placeholder="Room name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        <input
          style={styles.input}
          placeholder="Your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button
          style={styles.button}
          onClick={handleSubmit}
          disabled={!canJoin}
        >
          {loading || "Join"}
        </button>
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
