import { type FC, type HTMLAttributes, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type PeerTileProps = {
	stream?: MediaStream | null;
	name: string;
} & HTMLAttributes<HTMLDivElement>;

export const PeerTile: FC<PeerTileProps> = ({
	stream,
	name,
	className,
	...props
}) => {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!videoRef.current) return;
		videoRef.current.srcObject = stream ?? null;
	}, [stream]);

	return (
		<div
			className={cn(
				'h-full w-full grid place-items-center border rounded-xl',
				className,
			)}
			{...props}
		>
			{stream ? (
				<video
					className="h-full w-full rounded-xl object-cover"
					autoPlay
					muted
					disablePictureInPicture
					playsInline
					ref={videoRef}
				></video>
			) : (
				<div className="text-xl font-display">{name}</div>
			)}
		</div>
	);
};
