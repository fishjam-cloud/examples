import type { FC } from 'react';
import { Button, type ButtonProps } from './ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTrigger,
} from './ui/dialog';

const HowToPlay: FC<ButtonProps> = ({ variant, ...props }) => (
<Dialog>
		<DialogTrigger asChild>
			<Button variant={variant ?? 'outline'} {...props}>
				Help
			</Button>
		</DialogTrigger>
		<DialogContent className="bg-accent p-12 max-w-4xl rounded-4xl">
			<DialogHeader className="font-display text-2xl pb-4">
				How to Play
			</DialogHeader>
			<DialogDescription className="text-lg text-primary flex flex-col gap-4 overflow-auto max-h-[50vh]">
				<section>
					<h3 className="font-semibold text-xl mb-2">🎮 The Game</h3>
					<p>
						Solve mysterious scenarios by asking yes/no questions to an AI Storyteller. The mystery seems impossible at first, but clever questions reveal the truth.
					</p>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-2">🎯 Game Flow</h3>
					<ol className="list-decimal pl-6 space-y-2">
						<li><strong>Join:</strong> Create or join a room (share the link with friends)</li>
						<li><strong>Select Story:</strong> Choose from 10 mystery stories. You can change your selection until everyone's ready</li>
						<li><strong>Start Game:</strong> Once decided, press "Start Game". The AI Storyteller will read the mysterious scenario. You have 30 minutes to solve it!</li>
						<li><strong>Discuss:</strong> In Conference Mode (default), talk privately with your team about theories</li>
						<li><strong>Ask Questions:</strong> Toggle to Question Mode and speak yes/no questions to the AI. It answers "yes," "no," or "irrelevant"</li>
						<li><strong>Solve:</strong> When ready, say <em className="text-primary/90">"I'm guessing now..."</em> and explain the mystery. Win if correct, or keep investigating!</li>
					</ol>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-2">💡 Tips</h3>
					<ul className="list-disc pl-6 space-y-1">
						<li>Watch for wordplay and double meanings</li>
						<li>Pay attention to unusual details</li>
						<li>Question your assumptions</li>
						<li>Work together—different perspectives help</li>
					</ul>
				</section>

			</DialogDescription>
</DialogContent>
</Dialog>
);

export default HowToPlay;
