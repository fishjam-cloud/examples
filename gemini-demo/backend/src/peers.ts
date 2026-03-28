import type { RoomId } from "@fishjam-cloud/js-server-sdk";
import { fishjam } from "./clients.js";

const roomNameToId = new Map<string, RoomId>();

export const getPeerToken = async (roomName: string, peerName: string) => {
  const roomId = roomNameToId.get(roomName);

  const room = await (roomId ? fishjam.getRoom(roomId) : fishjam.createRoom());

  roomNameToId.set(roomName, room.id);

  const isNameTaken = room.peers.some(
    (p) => (p.metadata as { name?: string } | null)?.name === peerName,
  );

  if (isNameTaken) {
    throw new Error("Peer name is already taken");
  }

  const { peer, peerToken } = await fishjam.createPeer(room.id, {
    metadata: { name: peerName },
  });

  return { roomId: room.id, peer, peerToken };
};
