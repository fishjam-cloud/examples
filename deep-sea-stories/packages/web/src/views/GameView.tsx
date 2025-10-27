import { usePeers } from "@fishjam-cloud/react-client";
import type { FC } from "react";
import AgentPanel from "@/components/AgentPanel";
import { PeerTile } from "@/components/PeerTile";
import RoomControls from "@/components/RoomControls";
import RoomLog from "@/components/RoomLog";

export type GameViewProps = {
  roomId: string;
};

const GameView: FC<GameViewProps> = ({ roomId }) => {
  const { remotePeers, localPeer } = usePeers<{ name: string }>();
  const peers = remotePeers.length + 1;
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Desktop layout */}
      <section className="w-full h-1/2 gap-4 pt-4 px-4 md:gap-8 md:pt-10 md:px-10 hidden md:flex">
        <AgentPanel />
        <RoomControls roomId={roomId} />
      </section>

      {/* Mobile layout */}
      <section className="md:hidden flex flex-col h-full">
        <div className="flex-none p-4">
          <section className="font-title text-3xl text-center py-4">
            Deep Sea Stories
          </section>
          <RoomControls roomId={roomId} />
        </div>

        <div className="flex-1 overflow-hidden">
          <RoomLog />
        </div>
      </section>

      {/* Peer tiles section - responsive grid */}
      <section
        className={`w-full ${peers > 2 ? "h-1/2" : "h-auto"} grid place-items-center gap-2 p-4 md:gap-4 md:py-10 md:px-10 ${
          peers === 1
            ? "grid-cols-1"
            : peers === 2
              ? "grid-cols-1 md:grid-cols-2"
              : peers <= 4
                ? "grid-cols-2"
                : "grid-cols-2 md:grid-cols-3"
        }`}
      >
        <PeerTile
          className={`w-full ${peers <= 2 ? "max-w-md" : "max-w-xs md:max-w-2xl"} aspect-video`}
          name="You"
          stream={localPeer?.cameraTrack?.stream}
        />
        {remotePeers.map((peer) => (
          <PeerTile
            className={`w-full ${peers <= 2 ? "max-w-md" : "max-w-xs md:max-w-2xl"} aspect-video`}
            name={peer.metadata?.peer?.name ?? peer.id}
            key={peer.id}
            stream={
              peer.customVideoTracks[0]?.stream ?? peer.cameraTrack?.stream
            }
            audioStream={peer.tracks[0]?.stream ?? peer.microphoneTrack?.stream}
          />
        ))}
      </section>
    </div>
  );
};
export default GameView;
