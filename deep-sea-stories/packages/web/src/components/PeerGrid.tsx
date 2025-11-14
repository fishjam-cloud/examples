import type { usePeers } from '@fishjam-cloud/react-client';
import type { FC } from 'react';
import { PeerTile } from './PeerTile';
import { cn } from '@/lib/utils';

type PeerGridProps = {
	localPeer: ReturnType<typeof usePeers<{ name: string }>>['localPeer'];
	displayedPeers: ReturnType<typeof usePeers<{ name: string }>>['remotePeers'];
};

const PeerGrid: FC<PeerGridProps> = ({ localPeer, displayedPeers }) => {
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
			<PeerTile name="You" stream={localPeer?.cameraTrack?.stream} />
			{displayedPeers.map((peer) => (
				<PeerTile
					name={peer.metadata?.peer?.name ?? peer.id}
					key={peer.id}
					stream={peer.customVideoTracks[0]?.stream ?? peer.cameraTrack?.stream}
					audioStream={peer.microphoneTrack?.stream}
				/>
			))}
		</section>
	);
};

export default PeerGrid;
