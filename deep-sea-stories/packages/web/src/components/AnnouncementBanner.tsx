import { X } from 'lucide-react';
import { type PropsWithChildren, useState } from 'react';

export function AnnouncementBanner({ children }: PropsWithChildren) {
	const [isVisible, setIsVisible] = useState(true);

	if (!isVisible) return null;

	return (
		<aside className="fixed inset-x-0 top-0 z-50 bg-linear-to-r from-[#4285f4] via-[#8e75ff] to-[#d96570] text-white shadow-lg">
			<div className="relative flex min-h-10 items-center justify-center px-12 py-2 text-center text-sm">
				<div>{children}</div>
				<button
					type="button"
					onClick={() => setIsVisible(false)}
					className="absolute right-3 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
					aria-label="Dismiss announcement"
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			</div>
		</aside>
	);
}
