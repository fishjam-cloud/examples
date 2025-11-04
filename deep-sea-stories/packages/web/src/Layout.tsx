import type { FC, PropsWithChildren } from 'react';
import { Toaster } from '@/components/ui/sonner';

const Layout: FC<PropsWithChildren> = (props) => {
	return (
		<main className="flex flex-col h-screen w-screen px-4 md:px-8">
			{props.children}
			<Toaster />
		</main>
	);
};

export default Layout;
