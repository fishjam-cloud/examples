import type { FC } from 'react';
import { DeepSeaLogo } from './DeepSeaLogo';

const TitleBar: FC = () => {
	return (
		<div className="w-full space-y-4 text-center">
			<DeepSeaLogo className="text-6xl xl:text-8xl" />

			<h2 className="font-display text-xl lg:text-3xl">
				Hear the most mysterious stories and try to deduce how they happened.
			</h2>
		</div>
	);
};

export default TitleBar;
