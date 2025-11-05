import {
	useCamera,
	useInitializeDevices,
	usePeers,
} from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import AgentPanel from '@/components/AgentPanel';
import { PeerTile } from '@/components/PeerTile';
import RoomControls from '@/components/RoomControls';
import { useTRPCClient } from '@/contexts/trpc';
import { cn } from '@/lib/utils';

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

	return (
		<>
			<section className="w-full h-1/2 flex flex-col md:flex-row gap-8 pt-10 px-10">
				<AgentPanel roomId={roomId} />
				<RoomControls roomId={roomId} />
			</section>

			<section
				className={cn(
					'h-1/2 items-center w-full justify-items-center grid gap-4 py-10 overflow-hidden grid-cols-2 grid-rows-2 xl:grid-cols-4 xl:grid-rows-1',
					{
						'grid-cols-1 grid-rows-1 xl:grid-cols-1 md:grid-rows-1':
							displayedPeers.length === 0,
						'grid-rows-2 grid-cols-1 md:grid-cols-2 md:grid-rows-1 xl:grid-rows-1 xl:grid-cols-2':
							displayedPeers.length === 1,
					},
				)}
			>
				<PeerTile name="You" stream={localPeer?.cameraTrack?.stream} />
				{displayedPeers.map((peer) => (
					<PeerTile
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
