import { useState } from 'react';
import { useNavigate } from 'react-router';
import Footer from '@/components/Footer';
import TitleBar from '@/components/TitleBar';
import { Button } from '@/components/ui/button';
import { useTRPCClient } from '@/contexts/trpc';

export default function HomeView() {
	const navigate = useNavigate();
	const trpcClient = useTRPCClient();
	const [isLoading, setIsLoading] = useState(false);

	const handleCreateRoom = async () => {
		setIsLoading(true);
		try {
			const room = await trpcClient.createRoom.mutate();
			navigate(`/${room.id}`);
		} catch (error) {
			console.error('Failed to create room:', error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section className="h-full w-full flex justify-between flex-col py-16 px-4 lg:px-16">
			<TitleBar />
			<section className="flex-1 py-16 grid place-items-center">
				<Button
					onClick={handleCreateRoom}
					disabled={isLoading}
					className="font-display"
					size="large"
				>
					{isLoading ? 'Creating room...' : 'Create a game room'}
				</Button>
			</section>
			<Footer />
		</section>
	);
}
