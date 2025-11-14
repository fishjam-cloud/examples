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
			<DialogDescription className="text-lg text-primary flex flex-col gap-4 overflow-auto max-h-[50vh]">
				<section>
					<h3 className="font-semibold text-xl mb-2">Technology Stack</h3>
					<p>
						This demo showcases the power of real-time WebRTC infrastructure and conversational AI working together:
					</p>
					<ul className="list-disc pl-6 mt-2 space-y-1">
						<li>
							<a 
								href="https://fishjam.io" 
								target="_blank" 
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								<strong>Fishjam</strong>
							</a> - WebRTC SFU that handles all real-time audio streaming between players
						</li>
						<li>
							<a 
								href="https://elevenlabs.io/conversational-ai" 
								target="_blank" 
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								<strong>ElevenLabs Conversational AI</strong>
							</a> - Powers the intelligent Storyteller agent with natural voice interaction
						</li>
					</ul>
				</section>

				<section>
					<h3 className="font-semibold text-xl mb-2">How It Works</h3>
					<ol className="list-decimal pl-6 space-y-3">
						<li>
							<strong>Room Creation:</strong> When you create a room, a new Fishjam room is established. Players connect via WebRTC through Fishjam's SFU (Selective Forwarding Unit), enabling efficient multi-party audio streaming.
						</li>
						<li>
							<strong>Agent Setup:</strong> When the first player joins, the backend creates a{' '}
							<a 
								href="https://docs.fishjam.io/tutorials/agents" 
								target="_blank" 
								rel="noopener noreferrer"
								className="underline hover:text-primary/80"
							>
								Fishjam Agent
							</a>
							{' '}that connects to the same room. This agent acts as a bridge between Fishjam and the ElevenLabs voice AI.
						</li>
						<li>
							<strong>Starting the Game:</strong> When players press "Start Game", the backend initializes an ElevenLabs Conversational AI session with custom storytelling instructions. The Fishjam Agent establishes a WebSocket connection to stream audio bidirectionally.
						</li>
						<li>
							<strong>Conference Mode Control:</strong> Players can toggle between Conference Mode and Question Mode. In Conference Mode, the Fishjam Agent stops forwarding player audio to ElevenLabs—players can discuss theories privately while still hearing each other through Fishjam. When switched to Question Mode, audio transmission to the AI resumes, allowing players to ask the Storyteller questions.
						</li>
						<li>
							<strong>Smart Audio Routing:</strong> Since multiple players might speak at once (which would confuse the AI), the system uses Voice Activity Detection (VAD) to manage turn-taking during Question Mode. When someone starts speaking, their audio is sent to the AI Storyteller. Other players' audio is temporarily held back until the current speaker finishes. This ensures the AI hears one clear voice at a time while still allowing natural conversation flow.
						</li>
						<li>
							<strong>AI Responses:</strong> The ElevenLabs voice agent processes player questions and generates natural spoken responses. Audio is streamed back through the Fishjam Agent and broadcast to all players in real-time.
						</li>
						<li>
							<strong>Game Completion:</strong> The AI Storyteller monitors the game state. When players solve the mystery or time runs out, it sends an event to the backend, which gracefully disconnects the voice agent and notifies all players.
						</li>
					</ol>
				</section>
			</DialogDescription>
		</DialogContent>
	</Dialog>
);

export default HowItWorks;
