import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { StreamView } from '@/components/StreamView';
import { useMoqStreamViewer } from '@/hooks/useMoqStreamViewer';
import { Button } from '@/components/ui/button';

function WatchPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  // Render the viewer straight away, but don't connect/play until the viewer presses Play.
  // The click is the user gesture browsers require before the audio AudioContext can start.
  const [started, setStarted] = useState(false);
  const { connection, connectionStatus, stream } = useMoqStreamViewer(name, started);

  // Track whether a stream has ever appeared (so losing it means it ended). A ref is enough:
  // nothing renders off this directly — it's only read to decide `streamUnavailable`, and the
  // transition that matters (stream going away) re-renders on its own. Reset whenever we're not
  // started so each watch session begins clean.
  const hasSeenStreamRef = useRef(false);
  if (!started) {
    hasSeenStreamRef.current = false;
  } else if (stream) {
    hasSeenStreamRef.current = true;
  }

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
    started && !stream && (hasSeenStreamRef.current || (waited && connectionStatus === 'connected'));

  const disconnect = () => {
    setStarted(false);
  };

  return (
    <StreamView
      connection={connection}
      stream={stream}
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
