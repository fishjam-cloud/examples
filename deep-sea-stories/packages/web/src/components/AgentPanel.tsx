import type { FC } from 'react';
import EventNotifier from './EventNotifier';
import RiddleMasterPanel from './RiddleMasterPanel';

type AgentPanelProps = {
	roomId: string;
	agentStream?: MediaStream | null;
};

const AgentPanel: FC<AgentPanelProps> = ({ roomId, agentStream }) => {
	return (
		<div className="h-full flex flex-col lg:flex-row gap-2 lg:gap-1 lg:border rounded-3xl lg:p-2">
			<RiddleMasterPanel roomId={roomId} agentStream={agentStream} />
			<EventNotifier roomId={roomId} />
		</div>
	);
};

export default AgentPanel;
