import type { FC } from 'react';
import { Button, type ButtonProps } from './ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTrigger,
} from './ui/dialog';

const HowItWorks: FC<ButtonProps> = ({ variant, ...props }) => (
	<Dialog>
		<DialogTrigger asChild>
			<Button variant={variant ?? 'outline'} {...props}>
				How does it work?
			</Button>
		</DialogTrigger>
		<DialogContent className="bg-accent p-12 max-w-4xl rounded-4xl">
			<DialogHeader className="font-display text-2xl pb-4">
				How Does It Work?
			</DialogHeader>
			<DialogDescription className="text-lg text-primary flex flex-col gap-6 overflow-auto max-h-[50vh]">
				<section>
					<h3 className="font-semibold text-xl mb-3">Technology Stack</h3>
					<p className="leading-relaxed">
						This demo showcases the power of real-time WebRTC infrastructure and
						conversational AI working together:
					</p>
					<ul className="list-disc pl-6 mt-3 space-y-2">
						<li>
							<a
								href="https://fishjam.io"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								<strong>Fishjam</strong>
							</a>{' '}
							- WebRTC SFU handling real-time audio and video streaming
						</li>
						<li>
							<a
								href="https://gemini.google/overview/gemini-live/"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								<strong>Gemini Live API</strong>
							</a>{' '}
							- Powers the AI Storyteller with natural voice interaction
						</li>
					</ul>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-3">How It Works</h3>
					<ol className="list-decimal pl-6 space-y-4">
						<li className="leading-relaxed">
							<strong>Room Creation:</strong> When you create a Deep Sea Stories
							room, a new{' '}
							<a
								href="https://docs.fishjam.io/explanation/room-types"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								Fishjam conference room
							</a>{' '}
							is established. Players connect via WebRTC through Fishjam's SFU
							(Selective Forwarding Unit), enabling efficient multi-party audio
							streaming.
						</li>
						<li className="leading-relaxed">
							<strong>Agent Setup:</strong> When the first player joins, the
							backend creates a{' '}
							<a
								href="https://docs.fishjam.io/tutorials/agents"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								Fishjam Agent
							</a>{' '}
							that connects to the same room. This agent acts as a bridge
							between Fishjam and the Gemini Live API.
						</li>
						<li className="leading-relaxed">
							<strong>Starting the Game:</strong> When players press "Start
							Game", the backend initializes an Gemini Live API session with
							custom storytelling instructions. The Fishjam Agent establishes a
							WebSocket connection to stream audio bidirectionally.
						</li>
						<li className="leading-relaxed">
							<strong>Deafen/Undeafen Control:</strong> Players can toggle the
							Storyteller between listening and deafened states. When deafened,
							the Fishjam Agent stops forwarding player audio to Gemini Live API
							– allowing players to discuss theories privately while still
							hearing each other through Fishjam. When undeafened, the agent
							resumes listening to player questions.
						</li>
						<li className="leading-relaxed">
							<strong>Smart Audio Routing:</strong> Since multiple players might
							speak at once (and thus confuse the AI), the system uses Voice
							Activity Detection (VAD) to manage turn-taking during Question
							Mode. When someone starts speaking, their audio is sent to the AI
							Storyteller. Other players' audio is temporarily held back until
							the current speaker finishes. This ensures the AI hears one clear
							voice at a time while still allowing natural conversation flow.
						</li>
						<li className="leading-relaxed">
							<strong>AI Responses:</strong> The Gemini Live API voice agent
							processes players' questions and generates natural spoken
							responses. Audio is streamed back through the Fishjam Agent and
							broadcast to all players in real-time.
						</li>
						<li className="leading-relaxed">
							<strong>Game Completion:</strong> The AI Storyteller monitors the
							game state. When players solve the mystery or time runs out, the
							AI agent sends an event to the backend, which gracefully
							disconnects the voice agent and notifies all players.
						</li>
					</ol>
				</section>
			</DialogDescription>
		</DialogContent>
	</Dialog>
);

export default HowItWorks;
