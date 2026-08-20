import { db } from "./db.ts";

const AVATARS = ["orchid", "mint", "sunny", "coral", "ocean"] as const;
type AvatarName = (typeof AVATARS)[number];

const baseUrl = (req: Request) =>
  Deno.env.get("PUBLIC_BASE_URL") ?? new URL(req.url).origin;

export const avatarUrl = (req: Request, avatar: string) =>
  `${baseUrl(req)}/avatars/${avatar}.png`;

export function assignLeastUsedAvatar(): AvatarName {
  const counts = new Map<AvatarName, number>(AVATARS.map((a) => [a, 0]));
  const rows = db.sql<{ avatar: string | null }>`
    SELECT avatar FROM users WHERE avatar IS NOT NULL
  `;
  for (const { avatar } of rows) {
    if (avatar && counts.has(avatar as AvatarName)) {
      counts.set(avatar as AvatarName, counts.get(avatar as AvatarName)! + 1);
    }
  }
  const min = Math.min(...counts.values());
  const leastUsed = AVATARS.filter((a) => counts.get(a) === min);
  return leastUsed[Math.floor(Math.random() * leastUsed.length)];
}

// GET /avatars/<name>.png
export async function serveAvatarImage(pathname: string): Promise<Response> {
  const name = pathname.slice("/avatars/".length);
  if (!/^[a-z0-9_-]+\.png$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const file = await Deno.readFile(`./avatars/${name}`);
    return new Response(file, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
