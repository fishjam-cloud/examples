import type {
	FishjamAgent,
	FishjamClient,
	Peer,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { Story } from '../types.js';
import { getRandomStory } from '../utils.js';
import { FISHJAM_AGENT_OPTIONS } from '../config.js';
import { SessionManager } from './session.js';

class RoomService {
	private RoomToStory = new Map<RoomId, Story>();
	private RoomToPeers = new Map<RoomId, Peer[]>();
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

	getSessionManager(roomId: RoomId) {
		if (!this.RoomToSessionManager.get(roomId)) {
			this.RoomToSessionManager.set(roomId, new SessionManager());
		}
		return this.RoomToSessionManager.get(roomId);
	}

	createStory(roomId: RoomId) {
		const story = getRandomStory();
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
