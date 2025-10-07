import Footer from '@/components/Footer';
import LinkButton from '@/components/LinkButton';
import TitleBar from '@/components/TitleBar';
import { randomString } from '@/lib/utils';

export default function HomeView() {
	return (
		<>
			<TitleBar />
			<section className="flex-1 py-16 grid place-items-center">
				<LinkButton to={randomString()} className="font-display">
					Create a game room
				</LinkButton>
			</section>
			<Footer />
		</>
	);
}
