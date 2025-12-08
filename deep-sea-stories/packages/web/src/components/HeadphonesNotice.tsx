import { Headphones } from 'lucide-react';
import type { FC } from 'react';

const HeadphonesNotice: FC = () => (
	<div className="w-full flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
		<div className="p-2 rounded-xl bg-primary/10 text-primary">
			<Headphones size={24} aria-hidden />
		</div>
		<div className="leading-snug text-left">
			<div className="font-semibold text-primary">Headphones recommended</div>
			<div className="text-xs sm:text-sm text-muted-foreground">
				Keeps audio clear and echo-free.
			</div>
		</div>
	</div>
);

export default HeadphonesNotice;
