import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { RoomView } from '@/components/moq/RoomView';
import { useMoqStreamViewer } from '@/components/moq/useMoqStreamViewer';
import { Button } from '@/components/ui/button';

function WatchPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  // Render the room straight away, but don't connect/play until the viewer presses Play.
  // The click is the user gesture browsers require before the audio AudioContext can start.
  const [started, setStarted] = useState(false);
  const { connection, connectionStatus, tiles } = useMoqStreamViewer(name, started);

  // Track whether a stream has ever appeared (so losing it means it ended).
  const [hasSeenStream, setHasSeenStream] = useState(false);
  useEffect(() => {
    if (tiles.length > 0) {
      setHasSeenStream(true);
    }
  }, [tiles.length]);

  // After starting, give the stream a short window to be announced before deciding it is
  // not available (covers links to streams that never started / don't exist).
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!started) {
      setWaited(false);
      return;
    }
    const timer = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(timer);
  }, [started]);

  // Unavailable if a stream we were watching ended, or none ever showed up after the grace.
  const streamUnavailable =
    started && tiles.length === 0 && (hasSeenStream || (waited && connectionStatus === 'connected'));

  const disconnect = () => {
    setStarted(false);
    setHasSeenStream(false);
  };

  return (
    <RoomView
      roomName={name}
      connection={connection}
      connectionStatus={connectionStatus}
      tiles={tiles}
      onDisconnect={disconnect}
      pending={started}
      unavailable={streamUnavailable}
      onStartOwn={() => navigate('/')}
      playOverlay={
        started ? undefined : (
          <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-[#FCF6E7]/70 backdrop-blur-sm">
            <Button
              size="lg"
              className="h-20 w-20 rounded-full p-0 shadow-lg"
              disabled={!name}
              aria-label="Play"
              onClick={() => setStarted(true)}>
              <Play size={32} className="translate-x-0.5" />
            </Button>
          </div>
        )
      }
    />
  );
}

export default WatchPage;
