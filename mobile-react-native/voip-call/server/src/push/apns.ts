import { readIfPresent } from "./credentials.ts";
import type { PushParams } from "./mod.ts";

const BUNDLE_ID = "io.fishjam.example.voipcall";
const APNS_HOST = "api.development.push.apple.com";

const apnsPem = await readIfPresent("./apns.pem");
const apnsClient = apnsPem
  ? Deno.createHttpClient({ cert: apnsPem, key: apnsPem })
  : null;

export async function sendApnsPush(params: PushParams): Promise<void> {
  if (!apnsClient) {
    throw new Error("iOS push requires ./apns.pem");
  }
  const res = await fetch(`https://${APNS_HOST}/3/device/${params.token}`, {
    client: apnsClient,
    method: "POST",
    headers: {
      "apns-push-type": "voip",
      "apns-topic": `${BUNDLE_ID}.voip`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      roomName: params.roomName,
      displayName: params.displayName,
      isVideo: params.isVideo,
      ...(params.avatarUrl ? { avatarUrl: params.avatarUrl } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APNs push failed ${res.status}: ${text}`);
  }
}
