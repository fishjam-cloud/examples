import { usePeers } from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import GameControlPanel from '@/components/GameControlPanel';
import PeerGrid from '@/components/PeerGrid';
import { PlayerCountIndicator } from '@/components/PlayerCountIndicator';

export type GameViewProps = {
	roomId: string;
};

const GameView: FC<GameViewProps> = ({ roomId }) => {
	const { remotePeers, localPeer } = usePeers<{ name: string }>();
	const agentAudioRef = useRef<HTMLAudioElement>(null);
	const [volume, setVolume] = useState(1);

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

	useEffect(() => {
		if (agentAudioRef.current) {
			agentAudioRef.current.volume = volume;
		}
	}, [volume]);

	const userName = localPeer?.metadata?.peer?.name ?? 'Unknown';
	const playerCount = (localPeer ? 1 : 0) + displayedPeers.length;

	return (
		<div className="h-full w-full flex flex-col">
			<GameControlPanel
				roomId={roomId}
				userName={userName}
				agentStream={agentPeer?.tracks[0]?.stream}
				volume={volume}
				onVolumeChange={setVolume}
			/>

			<div className="relative flex-1 flex flex-col">
				<div className="absolute right-2 top-2 md:right-6 md:top-6 z-10">
					<PlayerCountIndicator count={playerCount} />
				</div>

				<PeerGrid
					roomId={roomId}
					localPeer={localPeer}
					displayedPeers={displayedPeers}
				/>
			</div>

			{/* biome-ignore lint/a11y/useMediaCaption: Peer audio feed from WebRTC doesn't have captions */}
			<audio ref={agentAudioRef} autoPlay playsInline title={'Agent audio'} />
		</div>
	);
};
export default GameView;
