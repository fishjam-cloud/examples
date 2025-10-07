import type { FC } from 'react';

const TitleBar: FC = () => {
	return (
		<div className="flex w-full pt-16 flex-col items-center justify-between gap-10">
			<div className="font-title text-8xl">Deep Sea Stories</div>
			<div className="font-display text-3xl">
				Hear the most mysterious stories and try to deduce how they happened.
			</div>
		</div>
	);
};

export default TitleBar;
