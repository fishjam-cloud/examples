import { Camera, CameraOff, Mic, MicOff } from 'lucide-react';
import type { FC } from 'react';
import { Button } from './ui/button';

export type LocalPeerOverlayProps = {
	isMuted: boolean;
	toggleMute: () => void;
	isCameraOn: boolean;
	toggleCamera: () => void;
};

export const LocalPeerOverlay: FC<LocalPeerOverlayProps> = ({
	isMuted,
	toggleMute,
	isCameraOn,
	toggleCamera,
}) => {
	const MicIcon = isMuted ? MicOff : Mic;
	const micColor = isMuted ? 'text-red-600' : '';

	const CameraIcon = !isCameraOn ? CameraOff : Camera;
	const cameraColor = !isCameraOn ? 'text-red-600' : '';

	return (
		<div className="absolute inset-x-0 bottom-0 p-2 gap-2 flex justify-center">
			<Button variant="outline" className={micColor} onClick={toggleMute}>
				<MicIcon size={24} />
			</Button>
			<Button variant="outline" className={cameraColor} onClick={toggleCamera}>
				<CameraIcon size={24} />
			</Button>
		</div>
	);
};
