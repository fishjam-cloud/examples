import { Check } from 'lucide-react';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import CopyButton from './CopyButton';
import HowItWorks from './HowItWorks';
import HowToPlay from './HowToPlay';
import StorySelectionPanel from './StorySelectionPanel';
import { Button } from './ui/button';
import { toast } from './ui/sonner';
import { useTRPCClient } from '@/contexts/trpc';

export type RoomControlsProps = {
	roomId: string;
};

const RoomControls: FC<RoomControlsProps> = ({ roomId }) => {
	const url = `https://deepsea.fishjam.io/${roomId}`;
	const [isStoryPanelOpen, setIsStoryPanelOpen] = useState(false);
	const trpc = useTRPCClient();

	useEffect(() => {
		void trpc.getStories.query();
	}, [trpc]);

	return (
		<div className="flex flex-col py-6 gap-8">
			<section className="font-title text-2xl text-center">
				Deep Sea Stories
			</section>
			<section className="w-full grow">
				<Button
					size="large"
					className="w-full"
					onClick={() => setIsStoryPanelOpen(true)}
				>
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
					{url.length > 40 ? `${url.substring(0, 37)}...` : url}
				</CopyButton>
			</section>
			<StorySelectionPanel
				isOpen={isStoryPanelOpen}
				onClose={() => setIsStoryPanelOpen(false)}
				roomId={roomId}
			/>
		</div>
	);
};

export default RoomControls;
