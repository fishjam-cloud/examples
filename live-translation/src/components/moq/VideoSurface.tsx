import * as Watch from '@moq/watch';
import { type FC, useEffect, useLayoutEffect, useRef } from 'react';

type Props = {
  className?: string;
  style?: React.CSSProperties;
  muted?: boolean;
  disableLocalBackend?: boolean;
  showVideo?: boolean;
  ['data-peer-id']?: string;
  stream?: MediaStream | null;
  broadcast?: Watch.Broadcast;
  backend?: Watch.MultiBackend | null;
  onBackendChange?: (backend: Watch.MultiBackend | null) => void;
};

export const VideoSurface: FC<Props> = ({
  stream,
  broadcast,
  backend,
  onBackendChange,
  className,
  style,
  muted,
  disableLocalBackend = false,
  showVideo = true,
  ...props
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || broadcast) {
      return;
    }

    element.srcObject = stream ?? null;

    return () => {
      element.srcObject = null;
    };
  }, [broadcast, stream]);

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element || !broadcast) {
      return;
    }

    if (backend) {
      backend.element.set(element);
      return () => {
        if (backend.element.peek() === element) {
          backend.element.set(undefined);
        }
      };
    }

    if (disableLocalBackend) {
      return;
    }

    let localBackend: Watch.MultiBackend | null = null;
    let timeoutId: number | null = null;

    const attachBackend = () => {
      if (localBackend) {
        return;
      }

      localBackend = new Watch.MultiBackend({
        element,
        broadcast,
        paused: false,
      });

      onBackendChange?.(localBackend);
    };

    const scheduleAttach = () => {
      if (timeoutId !== null || !broadcast.catalog.peek()) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        attachBackend();
      }, 200);
    };

    scheduleAttach();

    const disposeCatalog = broadcast.catalog.subscribe(scheduleAttach);

    return () => {
      disposeCatalog();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      onBackendChange?.(null);
      if (localBackend) {
        localBackend.close();
        localBackend.video.source.close();
        localBackend.audio.source.close();
        localBackend.sync.close();
      }
    };
  }, [backend, broadcast, disableLocalBackend, onBackendChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !broadcast || showVideo) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }, [broadcast, showVideo]);

  if (broadcast) {
    return <canvas {...props} className={className} ref={canvasRef} style={style} />;
  }

  return <video {...props} autoPlay className={className} muted={muted} playsInline ref={videoRef} style={style} />;
};
