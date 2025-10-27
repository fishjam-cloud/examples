import { type FC, type HTMLAttributes, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type PeerTileProps = {
  stream?: MediaStream | null;
  audioStream?: MediaStream | null;
  name: string;
} & HTMLAttributes<HTMLDivElement>;

export const PeerTile: FC<PeerTileProps> = ({
  stream,
  audioStream,
  name,
  className,
  ...props
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = audioStream ?? null;
  }, [audioStream]);

  return (
    <div
      className={cn(
        "h-full w-full grid place-items-center border rounded-xl",
        className,
      )}
      {...props}
    >
      {stream ? (
        <video
          className="h-full max-w-full rounded-xl "
          autoPlay
          muted
          disablePictureInPicture
          playsInline
          ref={videoRef}
        ></video>
      ) : (
        <div className="text-xl font-display">{name}</div>
      )}
      {/* biome-ignore lint/a11y/useMediaCaption: Peer audio feed from WebRTC doesn't have captions */}
      <audio ref={audioRef} autoPlay playsInline title={`Audio from ${name}`} />
    </div>
  );
};
