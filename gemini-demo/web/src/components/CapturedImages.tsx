export function CapturedImages({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Captured Images</div>
      <div style={styles.grid}>
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Capture ${i + 1}`}
            style={styles.image}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    borderTop: "1px solid #eee",
    padding: "12px 20px",
    maxHeight: 200,
    overflowY: "auto",
  },
  header: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
    color: "#333",
  },
  grid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  image: {
    width: 160,
    height: 120,
    objectFit: "cover",
    borderRadius: 6,
    border: "1px solid #eee",
  },
};
