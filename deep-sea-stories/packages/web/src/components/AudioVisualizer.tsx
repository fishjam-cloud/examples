import { useEffect, useRef, useState, type FC } from 'react';

export type AudioVisualizerProps = {
	stream: MediaStream | null | undefined;
	barColor?: string;
	barWidth?: number;
	barGap?: number;
};

const AudioVisualizer: FC<AudioVisualizerProps> = ({
	stream,
	barColor = '#10b981',
	barWidth = 3,
	barGap = 2,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationRef = useRef<number | undefined>(undefined);
	const analyserRef = useRef<AnalyserNode | undefined>(undefined);
	const audioContextRef = useRef<AudioContext | undefined>(undefined);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateDimensions = () => {
			const rect = container.getBoundingClientRect();
			setDimensions({
				width: Math.floor(rect.width),
				height: Math.floor(rect.height),
			});
		};

		updateDimensions();

		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
		});

		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;

		const { width: canvasWidth, height: canvasHeight } = dimensions;

		if (!stream) {
			const drawWaiting = () => {
				animationRef.current = requestAnimationFrame(drawWaiting);

				ctx.fillStyle = '#221f1c';
				ctx.fillRect(0, 0, canvasWidth, canvasHeight);

				const totalBarWidth = barWidth + barGap;
				const barCount = Math.floor(canvasWidth / totalBarWidth);

				ctx.fillStyle = barColor;
				ctx.globalAlpha = 0.2;
				for (let i = 0; i < barCount; i++) {
					const x = i * totalBarWidth;
					const barHeight = canvasHeight * 0.2;
					const y = canvasHeight - barHeight;
					ctx.fillRect(x, y, barWidth, barHeight);
				}
				ctx.globalAlpha = 1.0;
			};

			drawWaiting();

			return () => {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
				}
			};
		}

		const audioContext = new AudioContext();
		const analyser = audioContext.createAnalyser();
		const source = audioContext.createMediaStreamSource(stream);

		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.75;
		source.connect(analyser);

		audioContextRef.current = audioContext;
		analyserRef.current = analyser;

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);

		const draw = () => {
			animationRef.current = requestAnimationFrame(draw);

			analyser.getByteFrequencyData(dataArray);

			ctx.fillStyle = '#221f1c';
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);

			const totalBarWidth = barWidth + barGap;
			const barCount = Math.floor(canvasWidth / totalBarWidth);

			// Focus on speech frequencies (roughly 20-40% of the frequency spectrum)
			// This corresponds to approximately 80Hz-3000Hz range
			const speechRangeStart = 0;
			const speechRangeEnd = Math.floor(bufferLength * 0.35); // Focus on lower 35% of frequencies
			const speechRange = speechRangeEnd - speechRangeStart;

			for (let i = 0; i < barCount; i++) {
				const dataIndex =
					Math.floor((i / barCount) * speechRange) + speechRangeStart;

				let amplitude = dataArray[dataIndex] / 256;

				amplitude = Math.min(1, amplitude);

				const barHeight = Math.min(amplitude * canvasHeight, canvasHeight);
				const y = Math.max(0, canvasHeight - barHeight);

				const x = i * totalBarWidth;

				ctx.fillStyle = barColor;
				ctx.fillRect(x, y, barWidth, barHeight);
			}
		};

		draw();

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
			if (audioContextRef.current?.state !== 'closed') {
				audioContextRef.current?.close();
			}
		};
	}, [stream, dimensions, barColor, barWidth, barGap]);

	return (
		<div ref={containerRef} className="w-full h-full">
			{dimensions.width > 0 && dimensions.height > 0 && (
				<canvas
					ref={canvasRef}
					width={dimensions.width}
					height={dimensions.height}
					className="rounded-lg"
					style={{
						backgroundColor: '#221f1c',
						width: `${dimensions.width}px`,
						height: `${dimensions.height}px`,
						display: 'block',
					}}
				/>
			)}
		</div>
	);
};

export default AudioVisualizer;
