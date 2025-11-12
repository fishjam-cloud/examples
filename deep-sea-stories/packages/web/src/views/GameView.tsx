import { usePeers } from '@fishjam-cloud/react-client';
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

	const userName = localPeer?.metadata?.peer?.name ?? 'Unknown';
	return (
		<div className="h-full w-full flex flex-col">
			<section className="w-full flex-none md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-2 md:gap-8 pt-2 md:pt-10 px-2 md:px-10 max-h-[40vh] md:max-h-none">
				<div className="flex-1 min-h-0 overflow-hidden">
					<AgentPanel
						roomId={roomId}
						agentStream={agentPeer?.tracks[0]?.stream}
					/>
				</div>
				<div className="flex-none md:flex-none md:w-auto">
					<RoomControls roomId={roomId} userName={userName} />
				</div>
			</section>

			<section
				className={cn(
					'flex-1 md:flex-1 items-center w-full justify-items-center grid gap-2 md:gap-4 p-2 md:py-10 md:px-6 overflow-hidden grid-cols-2 grid-rows-2 xl:grid-cols-4 xl:grid-rows-1',
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
		</div>
	);
};
export default GameView;
