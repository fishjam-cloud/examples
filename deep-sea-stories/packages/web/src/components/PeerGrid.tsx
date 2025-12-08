import type { AgentEvent } from '@deep-sea-stories/common';
import {
	useCamera,
	useMicrophone,
	type usePeers,
} from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { cn } from '@/lib/utils';
import { LocalPeerOverlay } from './LocalPeerOverlay';
import { PeerTile } from './PeerTile';
import { RemotePeerOverlay } from './RemotePeerOverlay';

const getCurrentSpeaker = (events: AgentEvent[]): string | null => {
	const reversedEvents = [...events].reverse();
	const lastVAD = reversedEvents.find((event) => event.type === 'VAD');

	return lastVAD ? lastVAD.peerId : null;
};

type PeerGridProps = {
	roomId: string;
	localPeer: ReturnType<typeof usePeers<{ name: string }>>['localPeer'];
	displayedPeers: ReturnType<typeof usePeers<{ name: string }>>['remotePeers'];
};

const PeerGrid: FC<PeerGridProps> = ({ roomId, localPeer, displayedPeers }) => {
	const { isMicrophoneMuted, toggleMicrophoneMute } = useMicrophone();
	const { isCameraOn, toggleCamera } = useCamera();

	const events = useAgentEvents(roomId);
	const currentSpeaker = getCurrentSpeaker(events);

	return (
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
			<PeerTile
				name="You"
				className="relative"
				stream={localPeer?.cameraTrack?.stream}
				videoPaused={localPeer?.cameraTrack?.metadata?.paused}
				isSpeaking={localPeer ? localPeer.id === currentSpeaker : false}
			>
				<LocalPeerOverlay
					isMuted={isMicrophoneMuted}
					toggleMute={toggleMicrophoneMute}
					isCameraOn={isCameraOn}
					toggleCamera={toggleCamera}
				/>
			</PeerTile>

			{displayedPeers.map((peer) => (
				<PeerTile
					className="relative"
					name={peer.metadata?.peer?.name ?? peer.id}
					key={peer.id}
					stream={peer.cameraTrack?.stream}
					audioStream={peer.microphoneTrack?.stream}
					isSpeaking={currentSpeaker === peer.id}
					videoPaused={peer?.cameraTrack?.metadata?.paused}
				>
					<RemotePeerOverlay
						isMuted={
							!peer.microphoneTrack?.stream ||
							!!peer.microphoneTrack.metadata?.paused
						}
					/>
				</PeerTile>
			))}
		</section>
	);
};

export default PeerGrid;
