import { type FC, useEffect, useLayoutEffect, useRef } from 'react';

import type { SyncedStreamPlayer } from '@/hooks/useSyncedStreamPlayer';

type Props = {
  className?: string;
  style?: React.CSSProperties;
  showVideo?: boolean;
  player?: SyncedStreamPlayer | null;
};

export const VideoSurface: FC<Props> = ({ player, className, style, showVideo = true, ...props }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element || !player) {
      return;
    }

    player.attachCanvas(element);

    return () => {
      player.attachCanvas(null);
    };
  }, [player]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || showVideo) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }, [showVideo]);

  return <canvas {...props} className={className} ref={canvasRef} style={style} />;
};
