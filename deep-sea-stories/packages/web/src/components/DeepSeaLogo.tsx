import { cn } from '@/lib/utils';
import type { FC, HTMLAttributes } from 'react';

type DeepSeaLogoProps = HTMLAttributes<HTMLHeadingElement>;

export const DeepSeaLogo: FC<DeepSeaLogoProps> = (props) => (
	<h1
		{...props}
		className={cn(
			'font-title text-xl md:text-2xl text-center',
			props.className,
		)}
	>
		Deep Sea Stories
	</h1>
);
