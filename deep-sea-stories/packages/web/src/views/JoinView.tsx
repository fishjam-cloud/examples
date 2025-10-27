import {
	useCamera,
	useConnection,
	useInitializeDevices,
	useMicrophone,
} from '@fishjam-cloud/react-client';
import { Camera, Mic } from 'lucide-react';
import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceSelect } from '@/components/DeviceSelect';
import { PeerTile } from '@/components/PeerTile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTRPCClient } from '@/contexts/trpc';

interface JoinViewProps {
	roomId: string;
}

const JoinView: FC<JoinViewProps> = ({ roomId }) => {
	const { initializeDevices } = useInitializeDevices();
	const wasCameraTurnedOff = useRef(false);
	const { joinRoom } = useConnection();
	const [name, setName] = useState('');
	const trpcClient = useTRPCClient();

	const {
		isCameraOn,
		toggleCamera,
		cameraStream,
		cameraDevices,
		selectCamera,
		currentCamera,
	} = useCamera();
	const { microphoneDevices, selectMicrophone, currentMicrophone } =
		useMicrophone();

	const initAndTurnOnCamera = useCallback(async () => {
		await initializeDevices();
		if (!isCameraOn && !wasCameraTurnedOff.current) {
			await toggleCamera();
		}
	}, [initializeDevices, isCameraOn, toggleCamera]);

	useEffect(() => {
		initAndTurnOnCamera();
	}, [initAndTurnOnCamera]);

	const handleEnterRoom = useCallback(async () => {
		if (!roomId) return;

		try {
			const { token } = await trpcClient.createPeer.mutate({
				roomId,
				name,
			});
			await joinRoom({
				peerToken: token,
				peerMetadata: { name },
			});
		} catch (error) {
			console.error('Failed to join room:', error);
		}
	}, [trpcClient, roomId, joinRoom, name]);

	return (
		<>
			<section className="font-title w-full text-center text-lg py-10">
				Deep Sea Stories
			</section>
			<section className="w-full text-center flex flex-col gap-8 py-12">
				<div className="text-4xl font-display">Finish a player setup</div>
				<div className="text-2xl">
					Enter your player’s name and test out your camera and microphone.
				</div>
			</section>
			<section className="w-full flex-1 grid place-items-center">
				<div className="w-2xl h-full flex flex-col gap-4 items-center justify-between">
					<Input
						className="font-display"
						onChange={(e) => setName(e.target.value)}
						value={name}
						placeholder="Enter your name"
					/>
					<PeerTile className="flex-1" name={name} stream={cameraStream} />
					<div className="flex gap-4">
						<DeviceSelect
							placeholder="Select camera"
							devices={cameraDevices}
							onSelectDevice={selectCamera}
							defaultDevice={currentCamera}
						>
							<Camera size={24} className="flex-none" />
						</DeviceSelect>
						<DeviceSelect
							placeholder="Select microphone"
							devices={microphoneDevices}
							onSelectDevice={selectMicrophone}
							defaultDevice={currentMicrophone}
						>
							<Mic size={24} className="flex-none" />
						</DeviceSelect>
					</div>
				</div>
			</section>
			<section className="w-full pt-10 pb-16 grid place-items-center">
				<Button onClick={handleEnterRoom} size="large">
					Enter the game room
				</Button>
			</section>
		</>
	);
};

export default JoinView;
