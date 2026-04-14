import { useEffect, useRef } from "react";
import { useLivestreamViewer } from "@fishjam-cloud/react-client";

type Props = {
  livestreamID: string;
};

export function WhepPlayer({ livestreamID }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { connect, disconnect, stream, error } = useLivestreamViewer();

  useEffect(() => {
    connect({ streamId: livestreamID });
    return () => {
      disconnect();
    };
  }, [livestreamID, connect, disconnect]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
