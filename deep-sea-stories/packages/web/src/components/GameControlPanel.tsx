import type { FC } from 'react';
import AgentPanel from './AgentPanel';
import RoomControls from './RoomControls';

type GameControlPanelProps = {
	roomId: string;
	userName: string;
	agentStream?: MediaStream | null;
};

const GameControlPanel: FC<GameControlPanelProps> = ({
	roomId,
	userName,
	agentStream,
}) => {
	return (
		<section className="w-full flex-none md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-2 md:gap-4 pt-2 md:pt-10 px-2 md:px-10 max-h-[40vh] md:max-h-none">
			<div className="flex-1 min-h-0 overflow-hidden">
				<AgentPanel roomId={roomId} agentStream={agentStream} />
			</div>
			<div className="flex-none md:flex-none md:w-1/4 border rounded-3xl p-2 md:p-3 lg:p-4 overflow-hidden">
				<RoomControls roomId={roomId} userName={userName} />
			</div>
		</section>
	);
};

export default GameControlPanel;
