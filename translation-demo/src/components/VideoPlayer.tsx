import type { FC } from "react";
import { useEffect, useRef } from "react";

interface VideoPlayerProps extends React.HTMLAttributes<HTMLVideoElement> {
  stream?: MediaStream | null;
}

const VideoPlayer: FC<VideoPlayerProps> = ({ stream, ...props }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  return <video {...props} autoPlay playsInline muted ref={videoRef} />;
};

export default VideoPlayer;
