import type { FC } from 'react';
import elevenlabs from '@/assets/elevenlabs.svg';
import fishjam from '@/assets/fishjam.svg';
import HowItWorks from './HowItWorks';
import HowToPlay from './HowToPlay';
import Icon from './Icon';
import LinkButton from './LinkButton';

const Footer: FC = () => {
	return (
		<div className="flex pb-20 px-16 w-full flex-col items-center justify-between gap-4 md:flex-row">
			<div className="flex items-center gap-4">
				<p className="shrink-0 text-lg">Created with</p>
				<LinkButton to="https://fishjam.io" variant="outline" newTab>
					Fishjam
					<Icon img={fishjam} alt="fishjam logo" />
				</LinkButton>
				<LinkButton to="https://elevenlabs.io" variant="outline" newTab>
					ElevenLabs
					<Icon img={elevenlabs} alt="elevenlabs logo" />
				</LinkButton>
			</div>
			<div className="flex items-center gap-4">
				<HowToPlay />
				<HowItWorks />
			</div>
		</div>
	);
};

export default Footer;
