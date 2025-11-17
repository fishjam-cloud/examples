import { usePeers } from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import GameControlPanel from '@/components/GameControlPanel';
import PeerGrid from '@/components/PeerGrid';
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

	const userName = localPeer?.metadata?.peer?.name ?? 'Unknown';
	return (
		<div className="h-full w-full flex flex-col">
			<GameControlPanel
				roomId={roomId}
				userName={userName}
				agentStream={agentPeer?.tracks[0]?.stream}
			/>

			<PeerGrid localPeer={localPeer} displayedPeers={displayedPeers} />

			{/* biome-ignore lint/a11y/useMediaCaption: Peer audio feed from WebRTC doesn't have captions */}
			<audio ref={agentAudioRef} autoPlay playsInline title={'Agent audio'} />
		</div>
	);
};
export default GameView;
