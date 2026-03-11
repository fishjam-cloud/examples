export function AgentPanel({
  agentActive,
  agentConnected,
  systemPrompt,
  onSystemPromptChange,
  onStart,
  loading,
}: {
  agentActive: boolean;
  agentConnected: boolean;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onStart: () => void;
  loading: string;
}) {
  if (agentActive) {
    return (
      <div style={styles.status}>
        Agent is active
        {agentConnected ? " and connected" : " (connecting...)"}
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <textarea
        style={styles.textarea}
        value={systemPrompt}
        onChange={(e) => onSystemPromptChange(e.target.value)}
        rows={3}
        placeholder="System prompt for the AI agent..."
      />
      <button style={styles.button} onClick={onStart} disabled={!!loading}>
        {loading || "Start Agent"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
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
    resize: "vertical",
    fontFamily: "inherit",
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
  status: {
    padding: "12px 20px",
    borderTop: "1px solid #eee",
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
};
