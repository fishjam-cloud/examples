import { usePeers } from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import GameControlPanel from '@/components/GameControlPanel';
import PeerGrid from '@/components/PeerGrid';

export type GameViewProps = {
	roomId: string;
};

const GameView: FC<GameViewProps> = ({ roomId }) => {
	const { remotePeers, localPeer } = usePeers<{ name: string }>();
	const agentAudioRef = useRef<HTMLAudioElement>(null);

	const displayedPeers = useMemo(
		() => remotePeers.filter((peer) => peer.metadata),
		[remotePeers],
	);

	const agentPeer = useMemo(
		() => remotePeers.find((peer) => !peer.metadata),
		[remotePeers],
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
