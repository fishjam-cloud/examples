import { type FC, type HTMLAttributes, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type PeerTileProps = {
	stream?: MediaStream | null;
	audioStream?: MediaStream | null;
	name: string;
} & HTMLAttributes<HTMLDivElement>;

export const PeerTile: FC<PeerTileProps> = ({
	stream,
	audioStream,
	name,
	className,
	...props
}) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		if (!videoRef.current) return;
		videoRef.current.srcObject = stream ?? null;
	}, [stream]);

	useEffect(() => {
		if (!audioRef.current) return;
		audioRef.current.srcObject = audioStream ?? null;
	}, [audioStream]);

	return (
		<div
			className={cn(
				'h-full w-full border flex items-center justify-center rounded-xl overflow-hidden',
				className,
			)}
			{...props}
		>
			{stream ? (
				<video
					className="h-fit rounded-xl max-w-full object-contain"
					autoPlay
					muted
					disablePictureInPicture
					playsInline
					ref={videoRef}
				></video>
			) : (
				<div className="text-sm md:text-xl font-display text-center p-2">
					{name}
				</div>
			)}
			{/* biome-ignore lint/a11y/useMediaCaption: Peer audio feed from WebRTC doesn't have captions */}
			<audio ref={audioRef} autoPlay playsInline title={`Audio from ${name}`} />
		</div>
	);
};
