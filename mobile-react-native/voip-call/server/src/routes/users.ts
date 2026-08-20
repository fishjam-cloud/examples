import { avatarUrl } from "../avatars.ts";
import { db } from "../db.ts";

// GET /users?exclude=<me>
export function handleUsers(req: Request, url: URL): Response {
  const exclude = url.searchParams.get("exclude") ?? "";
  const rows = db.sql<{ username: string; avatar: string | null }>`
    SELECT username, avatar FROM users WHERE username != ${exclude} ORDER BY username
  `;
  return Response.json(
    rows.map((r) => ({
      username: r.username,
      avatarUrl: r.avatar ? avatarUrl(req, r.avatar) : null,
    })),
  );
}
