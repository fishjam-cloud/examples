const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:8080";

export type JoinRoomResult = {
  roomId: string;
  whepUrl: string;
  livestreamID: string;
};

export type JoinPeerResult = {
  peerToken: string;
  peerWebsocketUrl: string;
};

export async function createRoom(roomName: string): Promise<JoinRoomResult> {
  const res = await fetch(`${backendUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName }),
  });
  if (!res.ok) throw new Error(`create room failed: ${await res.text()}`);
  return res.json();
}

export async function createPeer(roomId: string, peerName: string): Promise<JoinPeerResult> {
  const res = await fetch(`${backendUrl}/api/rooms/${roomId}/peers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peerName }),
  });
  if (!res.ok) throw new Error(`create peer failed: ${await res.text()}`);
  return res.json();
}
