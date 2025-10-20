import { Copy } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CopyButtonProps = {
	value: string;
	onCopy: () => void;
} & React.ComponentProps<typeof Button>;

export default function CopyButton({
	value,
	onCopy,
	children,
	className,
	...buttonProps
}: CopyButtonProps) {
	const copyToClipboard = () => {
		navigator.clipboard.writeText(value);
		onCopy();
	};

	return (
		<Button
			className={cn('flex gap-4', className)}
			{...buttonProps}
			onClick={copyToClipboard}
		>
			{children}
			<Copy size={24} className="rotate-y-180" />
		</Button>
	);
}
