import { usePeers } from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import AgentPanel from '@/components/AgentPanel';
import { PeerTile } from '@/components/PeerTile';
import RoomControls from '@/components/RoomControls';

export type GameViewProps = {
	roomId: string;
};

const GameView: FC<GameViewProps> = ({ roomId }) => {
	const { remotePeers, localPeer } = usePeers<{ name: string }>();
	const peers = remotePeers.length + 1;
	return (
		<>
			<section className="w-full h-1/2 flex gap-8 pt-10 px-10">
				<AgentPanel />
				<RoomControls roomId={roomId} />
			</section>
			<section
				className="w-full h-1/2 grid place-items-center gap-4 py-10 px-10"
				style={{ gridTemplateColumns: `repeat(${peers}, minmax(0, 1fr))` }}
			>
				<PeerTile
					className="max-w-2xl"
					name="You"
					stream={localPeer?.cameraTrack?.stream}
				/>
				{remotePeers.map((peer) => (
					<PeerTile
						className="max-w-2xl"
						name={peer.metadata?.peer?.name ?? peer.id}
						key={peer.id}
						stream={
							peer.customVideoTracks[0]?.stream ?? peer.cameraTrack?.stream
						}
						audioStream={peer.tracks[0]?.stream ?? peer.microphoneTrack?.stream}
					/>
				))}
			</section>
		</>
	);
};
export default GameView;
