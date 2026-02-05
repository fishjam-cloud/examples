import type { FC } from 'react';

type VolumeSliderProps = {
	volume: number;
	onVolumeChange: (volume: number) => void;
	label?: string;
};

const VolumeSlider: FC<VolumeSliderProps> = ({
	volume,
	onVolumeChange,
	label,
}) => {
	return (
		<div className="flex flex-col gap-1 px-2">
			{label && <span className="text-xs text-muted-foreground">{label}</span>}
			<div className="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					className="w-5 h-5 text-muted-foreground flex-shrink-0"
				>
					{volume === 0 ? (
						<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06l-1.72 1.72-1.72-1.72z" />
					) : (
						<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
					)}
				</svg>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={volume}
					onChange={(e) => onVolumeChange(Number(e.target.value))}
					className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
		</div>
	);
};

export default VolumeSlider;
