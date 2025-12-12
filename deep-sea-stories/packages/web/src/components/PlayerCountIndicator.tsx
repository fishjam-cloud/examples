import { ROOM_PLAYERS_LIMIT } from '@deep-sea-stories/common';
import { Users } from 'lucide-react';
import type { FC } from 'react';

type PlayerCountIndicatorProps = {
	count: number;
};

export const PlayerCountIndicator: FC<PlayerCountIndicatorProps> = ({
	count,
}) => {
	return (
		<div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs md:text-sm font-display text-white backdrop-blur flex items-center gap-1.5">
			<Users className="w-3 h-3 md:w-4 md:h-4" />
			{count}/{ROOM_PLAYERS_LIMIT}
		</div>
	);
};
