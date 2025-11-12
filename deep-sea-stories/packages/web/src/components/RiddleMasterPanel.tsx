import type { FC } from 'react';
import AudioVisualizer from './AudioVisualizer';
import GameTimer from './GameTimer';

type RiddleMasterPanelProps = {
	roomId: string;
	agentStream?: MediaStream | null;
};

const RiddleMasterPanel: FC<RiddleMasterPanelProps> = ({
	roomId,
	agentStream,
}) => {
	return (
		<div className="hidden lg:flex flex-col lg:w-1/3 bg-card min-h-0 lg:m-2 gap-2">
			<GameTimer roomId={roomId} />
			<div className="flex-1 min-h-0">
				<AudioVisualizer stream={agentStream} barColor="#10b982" />
			</div>
		</div>
	);
};

export default RiddleMasterPanel;
