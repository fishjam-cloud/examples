import { VolumeOff } from 'lucide-react';
import type { FC } from 'react';

export type RemotePeerOverlayProps = {
	isMuted: boolean;
};

export const RemotePeerOverlay: FC<RemotePeerOverlayProps> = ({ isMuted }) =>
	isMuted && (
		<div className="absolute border-2 border-foreground rounded-full bg-background m-2 p-2 top-0 right-0 flex justify-center">
			<VolumeOff size={24} />
		</div>
	);
