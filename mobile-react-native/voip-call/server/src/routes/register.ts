import { assignLeastUsedAvatar, avatarUrl } from "../avatars.ts";
import { db } from "../db.ts";
import { isDevicePlatform } from "../push/mod.ts";

// POST /register  { username, voipToken, platform }
export async function handleRegister(req: Request): Promise<Response> {
  const { username, voipToken, platform } = (await req.json()) as {
    username: string;
    voipToken: string;
    platform: string;
  };
  if (!username || !voipToken) {
    return Response.json(
      { error: "username and voipToken are required" },
      { status: 400 },
    );
  }
  if (!isDevicePlatform(platform)) {
    return Response.json(
      { error: 'platform must be "ios" or "android"' },
      { status: 400 },
    );
  }
  const existing = db.sql<{ avatar: string | null }>`
    SELECT avatar FROM users WHERE username = ${username}
  `;
  const avatar = existing[0]?.avatar ?? assignLeastUsedAvatar();
  db.exec(
    `INSERT OR REPLACE INTO users (username, voip_token, platform, avatar, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [username, voipToken, platform, avatar, Date.now()],
  );
  return Response.json({ ok: true, avatarUrl: avatarUrl(req, avatar) });
}
