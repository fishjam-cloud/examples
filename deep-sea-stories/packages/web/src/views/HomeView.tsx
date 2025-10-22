import Footer from '@/components/Footer';
import TitleBar from '@/components/TitleBar';
import { useTRPCClient } from '@/contexts/trpc';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

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
		<>
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
		</>
	);
}
