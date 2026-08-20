import { JWT } from "google-auth-library";

import { readIfPresent } from "./credentials.ts";
import type { PushParams } from "./mod.ts";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

const fcmCredentials = await readIfPresent("./fcm-credentials.json");
const serviceAccount: ServiceAccount | null = fcmCredentials
  ? JSON.parse(fcmCredentials)
  : null;

const authClient = serviceAccount
  ? new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    })
  : null;

async function getAccessToken(client: JWT): Promise<string> {
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to get access token");
  return token;
}

export async function sendFcmPush(params: PushParams): Promise<void> {
  if (!serviceAccount || !authClient) {
    throw new Error("Android push requires ./fcm-credentials.json");
  }
  const accessToken = await getAccessToken(authClient);

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: params.token,
          data: {
            // Discriminator the SDK's PushNotificationService keys on; a data
            // message without it is never treated as a call.
            fishjam: "voip-incoming",
            roomName: params.roomName,
            displayName: params.displayName,
            isVideo: String(params.isVideo),
            ...(params.avatarUrl ? { avatarUrl: params.avatarUrl } : {}),
          },
          android: { priority: "high" },
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM push failed ${res.status}: ${text}`);
  }
}
