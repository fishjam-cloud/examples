import { useEffect, useRef, useState } from "react";
import { initializeWhep } from "../whep";

type Props = {
  url: string;
};

export function WhepPlayer({ url }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let peerConnection: RTCPeerConnection | null = null;

    initializeWhep(url)
      .then(({ stream, peer }) => {
        peerConnection = peer;
        if (!cancelled && videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          peer.close();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "WHEP connection failed");
        }
      });

    return () => {
      cancelled = true;
      peerConnection?.close();
    };
  }, [url]);

  if (error) {
    return (
      <div className="rounded-xl bg-gray-800 aspect-video flex items-center justify-center text-red-400 text-sm p-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full rounded-xl bg-gray-800 aspect-video"
    />
  );
}
