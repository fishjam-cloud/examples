const GATHER_ICE_TIMEOUT = 2000;

export type WhepResult = { stream: MediaStream; peer: RTCPeerConnection };

export async function initializeWhep(url: string): Promise<WhepResult> {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    bundlePolicy: "max-bundle",
  });

  const streamPromise = new Promise<MediaStream>((resolve) => {
    const stream = new MediaStream();
    peer.ontrack = (ev: RTCTrackEvent) => {
      stream.addTrack(ev.track);
      if (stream.getVideoTracks().length > 0) {
        resolve(stream);
      }
    };
  });

  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });

  await peer.setLocalDescription(await peer.createOffer());

  const offer = await gatherIceCandidates(peer);
  if (!offer) throw new Error("failed to gather ICE candidates");

  const answer = await exchangeSdp(url, offer.sdp);
  await peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer }));

  const stream = await streamPromise;
  return { stream, peer };
}

async function gatherIceCandidates(peer: RTCPeerConnection): Promise<RTCSessionDescription | null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(peer.localDescription), GATHER_ICE_TIMEOUT);
    peer.addEventListener("icegatheringstatechange", () => {
      if (peer.iceGatheringState === "complete") resolve(peer.localDescription);
    });
  });
}

async function exchangeSdp(url: string, sdpOffer: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/sdp" },
    body: sdpOffer,
  });
  if (res.status !== 201) throw new Error(`WHEP error: ${await res.text()}`);
  return res.text();
}
