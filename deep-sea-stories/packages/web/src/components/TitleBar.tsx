import type { FC } from 'react';

const TitleBar: FC = () => {
	return (
		<div className="flex w-full pt-16 flex-col items-center justify-between gap-10">
			<h1 className="font-title text-8xl">Deep Sea Stories</h1>
			<h2 className="font-display text-3xl">
				Hear the most mysterious stories and try to deduce how they happened.
			</h2>
		</div>
	);
};

export default TitleBar;
