import { Check } from 'lucide-react';
import type { FC } from 'react';
import CopyButton from './CopyButton';
import HowItWorks from './HowItWorks';
import HowToPlay from './HowToPlay';
import { Button } from './ui/button';
import { toast } from './ui/sonner';

export type RoomControlsProps = {
	roomId: string;
};

const RoomControls: FC<RoomControlsProps> = ({ roomId }) => {
	const url = `https://dss.fishjam.io/${roomId}`;

	return (
		<div className="flex flex-col py-6 gap-8">
			<section className="font-title text-2xl text-center">
				Deep Sea Stories
			</section>
			<section className="w-full grow">
				<Button size="large" className="w-full">
					Choose a story
				</Button>
			</section>
			<section className="w-full flex-none flex flex-col gap-4">
				<HowToPlay className="w-full" />
				<HowItWorks className="w-full" />
				<CopyButton
					variant="outline"
					onCopy={() => toast('Gameroom link copied to clipboard', Check)}
					value={url}
				>
					{url}
				</CopyButton>
			</section>
		</div>
	);
};

export default RoomControls;
