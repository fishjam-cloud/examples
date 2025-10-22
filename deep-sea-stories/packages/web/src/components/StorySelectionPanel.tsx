import { Check } from 'lucide-react';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useTRPCClient } from '@/contexts/trpc';
import { toast } from './ui/sonner';
import type { StoryData } from '@deep-sea-stories/common';

export type StorySelectionPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	roomId: string;
	onStorySelected?: (storyIndex: number) => void;
};

const StorySelectionPanel: FC<StorySelectionPanelProps> = ({
	isOpen,
	onClose,
	roomId,
	onStorySelected,
}) => {
	const trpcClient = useTRPCClient();
	const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
	const [isStarting, setIsStarting] = useState(false);
	const [stories, setStories] = useState<StoryData[]>([]);
	const [isLoadingStories, setIsLoadingStories] = useState(false);

	useEffect(() => {
		if (!isOpen) return;

		const fetchStories = async () => {
			setIsLoadingStories(true);
			try {
				const fetchedStories = await trpcClient.getStories.query();
				setStories(fetchedStories);
			} catch (error) {
				console.error('Failed to fetch stories:', error);
				toast('Failed to load stories', Check);
			} finally {
				setIsLoadingStories(false);
			}
		};

		fetchStories();
	}, [isOpen, trpcClient]);

	const handleStartStory = async () => {
		if (!selectedStoryId) return;

		setIsStarting(true);
		try {
			await trpcClient.startStory.mutate({
				roomId,
				storyId: selectedStoryId,
			});
			toast('Story started successfully', Check);
			onStorySelected?.(selectedStoryId);
			onClose();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to start story';
			toast(`Error: ${errorMessage}`, Check);
		} finally {
			setIsStarting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Choose a Story</DialogTitle>
					<DialogDescription>
						Select a mystery story to play with your friends
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
					{isLoadingStories ? (
						<div className="col-span-full text-center py-8 text-muted-foreground">
							Loading stories...
						</div>
					) : (
						stories.map((story) => (
							<button
								type="button"
								key={story.id}
								onClick={() => setSelectedStoryId(story.id)}
								className={`text-left p-4 rounded-lg border-2 transition-all ${
									selectedStoryId === story.id
										? 'border-primary bg-primary/10'
										: 'border-border hover:border-primary/50'
								}`}
							>
								<h3 className="font-semibold text-base mb-2">{story.title}</h3>
								<p className="text-sm text-muted-foreground line-clamp-2">
									{story.front}
								</p>
							</button>
						))
					)}
				</div>

				{selectedStoryId && stories.length > 0 && (
					<div className="bg-muted p-4 rounded-lg">
						<h4 className="font-semibold mb-2">Preview</h4>
						<p className="text-sm mb-3">
							{stories.find((s: StoryData) => s.id === selectedStoryId)?.front}
						</p>
					</div>
				)}

				<div className="flex gap-3 justify-end pt-4">
					<Button variant="outline" onClick={onClose} disabled={isStarting}>
						Cancel
					</Button>
					<Button
						onClick={handleStartStory}
						disabled={!selectedStoryId || isStarting}
					>
						{isStarting ? 'Starting...' : 'Start Story'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default StorySelectionPanel;
