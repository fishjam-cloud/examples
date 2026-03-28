export function Toolbar({
  roomName,
  agentActive,
  onAddAgent,
  onLeave,
}: {
  roomName: string;
  agentActive: boolean;
  onAddAgent: () => void;
  onLeave: () => void;
}) {
  return (
    <div style={styles.bar}>
      <div>
        <div style={styles.header}>Gemini x Fishjam Demo</div>
        <span style={styles.roomLabel}>Room: {roomName}</span>
      </div>
      <div style={styles.actions}>
        {!agentActive && (
          <button style={styles.agentBtn} onClick={onAddAgent}>
            Add Agent
          </button>
        )}
        <button style={styles.leaveBtn} onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid #eee",
  },
  header: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111",
  },
  roomLabel: {
    fontSize: 13,
    color: "#666",
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  agentBtn: {
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 500,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  leaveBtn: {
    padding: "6px 16px",
    fontSize: 13,
    background: "#fff",
    color: "#e00",
    border: "1px solid #e00",
    borderRadius: 6,
    cursor: "pointer",
  },
};
