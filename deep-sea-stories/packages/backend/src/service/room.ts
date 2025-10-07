import type {
	FishjamAgent,
	FishjamClient,
	Peer,
	PeerId,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { Story } from '../types.js';
import { FISHJAM_AGENT_OPTIONS } from '../config.js';
import { SessionManager } from './session.js';

class RoomService {
	private RoomToStory = new Map<RoomId, Story>();
	private RoomToPeers = new Map<RoomId, Peer[]>();
	private RoomToConnectedPeers = new Map<RoomId, Set<PeerId>>();
	private RoomToFishjamAgent = new Map<RoomId, FishjamAgent>();
	private RoomToSessionManager = new Map<RoomId, SessionManager>();

	getStory(roomId: RoomId) {
		return this.RoomToStory.get(roomId);
	}

	getAgent(roomId: RoomId) {
		return this.RoomToFishjamAgent.get(roomId);
	}

	getPeers(roomId: RoomId) {
		return this.RoomToPeers.get(roomId) || [];
	}

	getConnectedPeers(roomId: RoomId): PeerId[] {
		const connectedPeerIds = this.RoomToConnectedPeers.get(roomId) || new Set();
		return Array.from(connectedPeerIds);
	}

	addConnectedPeer(roomId: RoomId, peerId: PeerId) {
		const connectedPeers = this.RoomToConnectedPeers.get(roomId) || new Set();
		connectedPeers.add(peerId);
		this.RoomToConnectedPeers.set(roomId, connectedPeers);
	}

	removeConnectedPeer(roomId: RoomId, peerId: PeerId) {
		const connectedPeers = this.RoomToConnectedPeers.get(roomId);
		if (connectedPeers) {
			connectedPeers.delete(peerId);
		}
	}

	getSessionManager(roomId: RoomId) {
		if (!this.RoomToSessionManager.get(roomId)) {
			this.RoomToSessionManager.set(roomId, new SessionManager());
		}
		return this.RoomToSessionManager.get(roomId);
	}

	setStory(roomId: RoomId, story: Story) {
		this.RoomToStory.set(roomId, story);
	}

	async createPeer(roomId: RoomId, fishjam: FishjamClient) {
		const { peer, peerToken } = await fishjam.createPeer(roomId);
		const peers = this.RoomToPeers.get(roomId) || [];
		peers.push(peer);
		this.RoomToPeers.set(roomId, peers);
		return { peer, peerToken };
	}

	async createFishjamAgent(roomId: RoomId, fishjam: FishjamClient) {
		const { agent } = await fishjam.createAgent(
			roomId,
			FISHJAM_AGENT_OPTIONS,
			(msg) => {
				console.log(`Fishjam Agent for room: ${roomId} got error: ${msg}`);
			},
			(code, reason) => {
				console.log(
					`Fishjam Agent for room: ${roomId} closed with code: ${code}, reason: ${reason}`,
				);
			},
		);

		this.RoomToFishjamAgent.set(roomId, agent);
	}
}

export const roomService = new RoomService();
