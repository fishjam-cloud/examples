import { useEffect, useRef } from "react";

export function PeerTile({
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

      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  peerTile: {
    position: "relative",
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
    objectFit: "cover",
  },
  noVideo: {
    fontSize: 18,
    color: "#999",
  },
  peerName: {
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
