import {
  useCamera,
  useConnection,
  useMicrophone,
  usePeers,
} from "@fishjam-cloud/react-client";
import { PeerTile } from "./PeerTile";
import { WhepPlayer } from "./WhepPlayer";

type Props = {
  whepUrl: string;
  roomName: string;
  peerName: string;
  onLeave: () => void;
};

export function Conference({ whepUrl, roomName, peerName, onLeave }: Props) {
  const { leaveRoom } = useConnection();
  const { isCameraOn, toggleCamera, cameraStream } = useCamera();
  const { isMicrophoneMuted, toggleMicrophoneMute } = useMicrophone();
  const { localPeer, remotePeers } = usePeers<{ name: string }>();
  const whepPlayToken = import.meta.env.VITE_VDO_NINJA_WHEPPLAY_TOKEN as string | undefined;

  const vdoNinjaParams = new URLSearchParams({
    whepplay: whepUrl,
    stereo: "2",
    whepwait: "0",
  });
  if (whepPlayToken) {
    vdoNinjaParams.set("whepplaytoken", whepPlayToken);
  }
  const vdoNinjaUrl = `https://vdo.ninja/?${vdoNinjaParams.toString()}`;

  async function handleLeave() {
    try {
      await leaveRoom();
    } catch (e) {
      console.error("Failed to leave room:", e);
    }
    onLeave();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="font-bold text-lg">{roomName}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => toggleCamera()}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isCameraOn ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-500"
            }`}
          >
            {isCameraOn ? "Camera On" : "Camera Off"}
          </button>
          <button
            onClick={() => toggleMicrophoneMute()}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isMicrophoneMuted ? "bg-gray-600 hover:bg-gray-500" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isMicrophoneMuted ? "Mic Muted" : "Mic On"}
          </button>
          <button
            onClick={handleLeave}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 transition"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 gap-4 p-4 overflow-auto">
        {/* Peer grid */}
        <div className="flex-1 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Conference</h2>
          <div className="grid grid-cols-2 gap-3 auto-rows-fr">
            <PeerTile
              name={peerName}
              stream={cameraStream ?? undefined}
            />
            {remotePeers.map((peer) => (
              <PeerTile
                key={peer.id}
                name={peer.metadata?.peer?.name ?? peer.id}
                stream={peer.cameraTrack?.stream ?? undefined}
                audioStream={peer.microphoneTrack?.stream ?? undefined}
              />
            ))}
          </div>
        </div>

        {/* WHEP preview */}
        <div className="w-80 flex flex-col gap-3 shrink-0">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Live Stream Preview</h2>
          <WhepPlayer url={whepUrl} />
          <a
            href={vdoNinjaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
          >
            Open in vdo.ninja player
          </a>
          <p className="text-xs text-gray-500">Composed stream via Foundry</p>
        </div>
      </div>
    </div>
  );
}
