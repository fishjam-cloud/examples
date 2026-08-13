import { avatarUrl } from "../avatars.ts";
import { db } from "../db.ts";
import { isDevicePlatform, sendPush } from "../push/mod.ts";

// POST /call  { from, to, roomName }
export async function handleCall(req: Request): Promise<Response> {
  const { from, to, roomName, isVideo } = (await req.json()) as {
    from: string;
    to: string;
    roomName: string;
    isVideo: boolean;
  };
  if (!from || !to || !roomName) {
    return Response.json(
      { error: "from, to and roomName are required" },
      { status: 400 },
    );
  }

  const calleeRows = db.sql<{ voip_token: string; platform: string | null }>`
    SELECT voip_token, platform FROM users WHERE username = ${to}
  `;
  if (calleeRows.length === 0) {
    return Response.json({ error: "callee not found" }, { status: 404 });
  }
  const { voip_token: voipToken, platform } = calleeRows[0];
  if (!isDevicePlatform(platform)) {
    return Response.json(
      { error: "callee registered without a known platform" },
      { status: 409 },
    );
  }

  const callerRows = db.sql<{ avatar: string | null }>`
    SELECT avatar FROM users WHERE username = ${from}
  `;
  const callerAvatar = callerRows[0]?.avatar;

  try {
    await sendPush[platform]({
      token: voipToken,
      roomName: roomName,
      displayName: from,
      isVideo: isVideo,
      avatarUrl: callerAvatar ? avatarUrl(req, callerAvatar) : undefined,
    });
  } catch (err) {
    console.error(`Failed to send ${platform} VoIP push:`, err);
    return Response.json(
      { error: "failed to send VoIP push" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
