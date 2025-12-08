import type { FC } from 'react';
import fishjam from '@/assets/fishjam.svg';
import gemini from '@/assets/gemini.svg';
import HowItWorks from './HowItWorks';
import HowToPlay from './HowToPlay';
import LinkButton from './LinkButton';

const Footer: FC = () => {
	return (
		<div className="flex w-full flex-col items-center md:flex-row-reverse justify-between gap-16 md:gap-4">
			<div className="flex flex-col lg:flex-row items-center justify-between gap-4">
				<HowToPlay />
				<HowItWorks />
			</div>

			<div className="flex items-center flex-col md:flex-row gap-4">
				<p className="shrink-0 text-lg">Created with</p>
				<div className="flex gap-2 items-center flex-col lg:flex-row">
					<LinkButton to="https://fishjam.io" variant="outline" newTab>
						Fishjam
						<img src={fishjam} alt="Fishjam logo" className="size-6 block" />
					</LinkButton>

					<LinkButton
						to="https://gemini.google/overview/gemini-live/"
						variant="outline"
						newTab
					>
						Gemini
						<img src={gemini} alt="Gemini logo" className="h-4 block" />
					</LinkButton>
				</div>
			</div>
		</div>
	);
};

export default Footer;
