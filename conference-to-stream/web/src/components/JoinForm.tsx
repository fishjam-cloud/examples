import { useConnection, useInitializeDevices } from "@fishjam-cloud/react-client";
import { useEffect, useState } from "react";
import { createPeer, createRoom } from "../api";

type Props = {
  initialRoomName?: string;
  onJoined: (result: { whepUrl: string; roomName: string; peerName: string }) => void;
};

export function JoinForm({ initialRoomName, onJoined }: Props) {
  const { joinRoom } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const [roomName, setRoomName] = useState(initialRoomName ?? "");
  const [peerName, setPeerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeDevices({ enableVideo: true, enableAudio: true });
  }, [initializeDevices]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim() || !peerName.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { roomId, whepUrl } = await createRoom(roomName.trim());
      const { peerToken } = await createPeer(roomId, peerName.trim());
      await joinRoom({ peerToken, peerMetadata: { name: peerName.trim() } });
      onJoined({ whepUrl, roomName: roomName.trim(), peerName: peerName.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Conference to Stream</h1>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Room name
          <input
            type="text"
            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="my-room"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            autoFocus={!initialRoomName}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Your name
          <input
            type="text"
            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Alice"
            value={peerName}
            onChange={(e) => setPeerName(e.target.value)}
            autoFocus={!!initialRoomName}
          />
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2 transition"
        >
          {loading ? "Joining..." : "Join"}
        </button>
      </form>
    </div>
  );
}
