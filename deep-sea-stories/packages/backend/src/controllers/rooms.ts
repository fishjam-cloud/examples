import type { FishjamClient, RoomId } from '@fishjam-cloud/js-server-sdk';

export async function createRoom(fishjam: FishjamClient) {
	return await fishjam.createRoom();
}

export async function getRoom(fishjam: FishjamClient, roomId: RoomId) {
	return await fishjam.getRoom(roomId);
}
