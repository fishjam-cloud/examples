import {
	type FC,
	type HTMLAttributes,
	type PropsWithChildren,
	useEffect,
	useRef,
} from 'react';
import { cn } from '@/lib/utils';
import { VideoOff } from 'lucide-react';

export type PeerTileProps = {
	stream?: MediaStream | null;
	audioStream?: MediaStream | null;
	name: string;
	isSpeaking: boolean;
	videoPaused?: boolean | null;
} & HTMLAttributes<HTMLDivElement>;

export const PeerTile: FC<PropsWithChildren<PeerTileProps>> = ({
	stream,
	audioStream,
	name,
	className,
	isSpeaking,
	videoPaused,
	children,
	...props
}) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		if (!videoRef.current || videoPaused) return;
		videoRef.current.srcObject = stream ?? null;
	}, [stream, videoPaused]);

	useEffect(() => {
		if (!audioRef.current) return;
		audioRef.current.srcObject = audioStream ?? null;
	}, [audioStream]);

	return (
		<div className={cn('h-full w-full max-w-xl', className)} {...props}>
			<div
				className={cn(
					'h-full w-full flex border items-center justify-center rounded-xl overflow-hidden',
					isSpeaking ? 'border-green-400 border-4' : '',
				)}
			>
				{stream && !videoPaused ? (
					<video
						className="h-full rounded-xl max-w-full object-cover"
						autoPlay
						muted
						disablePictureInPicture
						playsInline
						ref={videoRef}
					/>
				) : (
					<div className="text-sm md:text-xl font-display text-center p-2">
						{name || <VideoOff size={96} className="text-muted-foreground" />}
					</div>
				)}
				{/* biome-ignore lint/a11y/useMediaCaption: Peer audio feed from WebRTC doesn't have captions */}
				<audio
					ref={audioRef}
					autoPlay
					playsInline
					title={`Audio from ${name}`}
				/>
			</div>
			{children}
		</div>
	);
};
