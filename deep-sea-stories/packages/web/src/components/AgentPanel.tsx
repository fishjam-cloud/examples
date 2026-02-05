import type { FC } from 'react';
import EventNotifier from './EventNotifier';
import RiddleMasterPanel from './RiddleMasterPanel';

type AgentPanelProps = {
	roomId: string;
	agentStream?: MediaStream | null;
	volume: number;
	onVolumeChange: (volume: number) => void;
};

const AgentPanel: FC<AgentPanelProps> = ({
	roomId,
	agentStream,
	volume,
	onVolumeChange,
}) => {
	return (
		<div className="h-full flex flex-col lg:flex-row gap-2 lg:gap-1 lg:border rounded-3xl lg:p-2">
			<RiddleMasterPanel
				roomId={roomId}
				agentStream={agentStream}
				volume={volume}
				onVolumeChange={onVolumeChange}
			/>
			<EventNotifier roomId={roomId} />
		</div>
	);
};

export default AgentPanel;
