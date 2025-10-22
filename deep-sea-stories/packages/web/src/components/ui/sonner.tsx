import type { LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function toast(title: string, icon: LucideIcon) {
	return sonnerToast.custom(() => <Toast title={title} icon={icon} />);
}

type ToastProps = {
	icon: LucideIcon;
	title: string;
};

function Toast({ title, icon: Icon }: ToastProps) {
	return (
		<div className="flex items-center gap-2 rounded-full text-secondary-foreground bg-secondary p-4 shadow-md/30 md:max-w-[364px]">
			<Icon size={24} />
			<p className="font-display">{title}</p>
		</div>
	);
}

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = 'system' } = useTheme();

	return (
		<Sonner
			position="top-center"
			theme={theme as ToasterProps['theme']}
			className="toaster group"
			toastOptions={{
				classNames: {
					toast:
						'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
					description: 'group-[.toast]:text-muted-foreground',
					actionButton:
						'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
					cancelButton:
						'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
