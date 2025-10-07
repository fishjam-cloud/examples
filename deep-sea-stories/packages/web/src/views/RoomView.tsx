import { useConnection } from '@fishjam-cloud/react-client';
import { useParams } from 'react-router';
import GameView from './GameView';
import JoinView from './JoinView';

export default function RoomView() {
	const { roomId } = useParams();
	const { peerStatus } = useConnection();
	const isConnected = peerStatus === 'connected';

	return !isConnected ? <GameView roomId={roomId ?? ''} /> : <JoinView />;
}
