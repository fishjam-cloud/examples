import { usePeers } from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import AgentPanel from '@/components/AgentPanel';
import { PeerTile } from '@/components/PeerTile';
import RoomControls from '@/components/RoomControls';
import { useTRPCClient } from '@/contexts/trpc';

export type GameViewProps = {
	roomId: string;
};

const GameView: FC<GameViewProps> = ({ roomId }) => {
	const { remotePeers, localPeer } = usePeers<{ name: string }>();
	const trpcClient = useTRPCClient();
	const agentAudioRef = useRef<HTMLAudioElement>(null);

	const { data: roomData } = useQuery({
		queryKey: ['room', roomId],
		queryFn: () => trpcClient.getRoom.query({ roomId }),
		staleTime: Infinity,
	});

	const agentPeerId = useMemo(
		() => roomData?.peers?.find((peer) => peer.type === 'agent')?.id,
		[roomData?.peers],
	);

	const displayedPeers = useMemo(
		() =>
			agentPeerId
				? remotePeers.filter((peer) => String(peer.id) !== String(agentPeerId))
				: remotePeers,
		[remotePeers, agentPeerId],
	);

	const agentPeer = useMemo(
		() =>
			agentPeerId
				? remotePeers.find((peer) => String(peer.id) === String(agentPeerId))
				: undefined,
		[remotePeers, agentPeerId],
	);

	useEffect(() => {
		if (!agentAudioRef.current) return;
		const audioStream = agentPeer?.tracks[0]?.stream;
		agentAudioRef.current.srcObject = audioStream ?? null;
	}, [agentPeer?.tracks[0]?.stream]);

	const gridColumns = displayedPeers.length + 1;

	return (
		<>
			<section className="w-full h-1/2 flex flex-col md:flex-row gap-8 pt-10 px-10">
				<AgentPanel roomId={roomId} />
				<RoomControls roomId={roomId} />
			</section>

			<section
				className="w-full h-1/2 grid place-items-center gap-4 py-10 px-10"
				style={{
					gridTemplateColumns: `repeat(${Math.min(2, gridColumns)}, minmax(0, 1fr))`,
					gridTemplateRows: `repeat(${Math.floor(Math.min(2, gridColumns) / 2)}, minmax(0, 1fr))`,
					gridAutoRows: '1fr',
				}}
			>
				<PeerTile
					className="max-w-2xl"
					name="You"
					stream={localPeer?.cameraTrack?.stream}
				/>

				{displayedPeers.map((peer) => (
					<PeerTile
						className="max-w-2xl"
						name={peer.metadata?.peer?.name ?? peer.id}
						key={peer.id}
						stream={
							peer.customVideoTracks[0]?.stream ?? peer.cameraTrack?.stream
						}
						audioStream={peer.microphoneTrack?.stream}
					/>
				))}
			</section>
			{/* biome-ignore lint/a11y/useMediaCaption: Peer audio feed from WebRTC doesn't have captions */}
			<audio ref={agentAudioRef} autoPlay playsInline title={'Agent audio'} />
		</>
	);
};
export default GameView;
