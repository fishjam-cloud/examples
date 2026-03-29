import { useEffect, useRef } from "react";

type Props = {
  stream?: MediaStream;
  audioStream?: MediaStream;
  name: string;
};

export function PeerTile({ stream, audioStream, name }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
    }
  }, [audioStream]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video flex items-center justify-center">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-white text-4xl font-bold select-none">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-2 left-2 text-white text-xs bg-black/50 rounded px-1 py-0.5">
        {name}
      </span>
      {audioStream && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
    </div>
  );
}
