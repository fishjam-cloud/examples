import type { FC } from 'react';

export type IconProps = {
	img: string;
	alt: string;
};

const Icon: FC<IconProps> = ({ img, alt }) => (
	<img src={img} alt={alt} className="size-6 block" />
);

export default Icon;
