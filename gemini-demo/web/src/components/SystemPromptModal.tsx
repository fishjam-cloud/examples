import { useState } from "react";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful voice assistant in a video call.
Keep your responses concise and conversational.
You can use Google Search to look up current information when asked.`;

export function SystemPromptModal({
  onStart,
  onClose,
}: {
  onStart: (prompt: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>Agent System Prompt</h3>
        <textarea
          style={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="System prompt for the AI agent..."
          autoFocus
        />
        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={styles.startBtn}
            onClick={() => onStart(prompt)}
            disabled={!prompt.trim()}
          >
            Start Agent
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    width: 480,
    maxWidth: "90vw",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  textarea: {
    padding: "10px 12px",
    fontSize: 13,
    border: "1px solid #ddd",
    borderRadius: 6,
    resize: "vertical",
    fontFamily: "inherit",
    outline: "none",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelBtn: {
    padding: "8px 16px",
    fontSize: 13,
    background: "#fff",
    color: "#666",
    border: "1px solid #ddd",
    borderRadius: 6,
    cursor: "pointer",
  },
  startBtn: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
};
