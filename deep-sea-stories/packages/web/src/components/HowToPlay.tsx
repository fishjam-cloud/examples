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
			<DialogDescription className="text-lg text-primary flex flex-col gap-6 overflow-auto max-h-[50vh]">
				<section>
					<p className="leading-relaxed">
						Deep Sea Stories is a loose adaptation of the well-known card game
						called Dark Stories. With an AI agent and a dedicated online room,
						you and your friends can play together fully online.
					</p>
					<p className="leading-relaxed mt-3">
						Choose one of ten predefined Deep Sea Stories and listen to the
						backstory, which gives you clues and directions to help you uncover
						the case. Then, you can start asking the Storyteller yes-or-no
						questions to gather more information.
					</p>
					<p className="leading-relaxed mt-3">
						Once you figure out the Deep Sea Story solution, say,{' '}
						<em className="text-primary/90">"I'm guessing now..."</em> followed
						by your guess. If you're right, the Storyteller will stop the game
						and congratulate you. If not, you can keep playing until you piece
						everything together.
					</p>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-3">The Game</h3>
					<p className="leading-relaxed">
						Dive into mysterious scenarios and solve them by asking the AI
						Storyteller yes-or-no questions. The mystery may seem unsolvable at
						first, but smart questions will reveal the truth about what
						happened.
					</p>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-3">Game Flow</h3>
					<ol className="list-decimal pl-6 space-y-3">
						<li>
							<strong>Join:</strong> Create a room and share the link with
							friends, or join an existing game using a shared link.
						</li>
						<li>
							<strong>Select Story:</strong> Choose one of ten scenarios for
							your gameplay.
						</li>
						<li>
							<strong>Start:</strong> Press "Start Game" once your story is
							selected. The AI Storyteller will narrate your gameplay. You have
							30 minutes to solve the mystery.
						</li>
						<li>
							<strong>Discuss:</strong> Deafen the Storyteller so it can't hear
							you, allowing you to share ideas and debate theories privately
							with your team.
						</li>
						<li>
							<strong>Ask Questions:</strong> Undeafen the Storyteller and ask
							yes-or-no questions to gather clues.
						</li>
						<li>
							<strong>Solve:</strong> When you're ready, say{' '}
							<em className="text-primary/90">"I'm guessing now..."</em> and
							explain the mystery. Win if correct, or keep investigating!
						</li>
					</ol>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-3">Tips</h3>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							Watch out for wordplay and double meanings used in the scenarios
							presented by the AI Storyteller
						</li>
						<li>Pay attention to unusual details</li>
						<li>Question your assumptions</li>
						<li>Work together – sharing different perspectives helps</li>
					</ul>
				</section>
			</DialogDescription>
		</DialogContent>
	</Dialog>
);

export default HowToPlay;
