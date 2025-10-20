import type { FC, PropsWithChildren } from 'react';
import { Link } from 'react-router';
import { Button, type ButtonProps } from './ui/button';

type LinkButtonProps = {
	to: string;
	newTab?: boolean;
} & ButtonProps;

const LinkButton: FC<PropsWithChildren<LinkButtonProps>> = ({
	to,
	newTab,
	children,
	...props
}) => (
	<Link to={to} target={newTab ? '_blank' : undefined}>
		<Button {...props}>{children}</Button>
	</Link>
);

export default LinkButton;
