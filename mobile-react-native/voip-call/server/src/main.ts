import { serveAvatarImage } from "./avatars.ts";
import { handleCall } from "./routes/call.ts";
import { handleRegister } from "./routes/register.ts";
import { handleSignaling } from "./routes/signaling.ts";
import { handleUsers } from "./routes/users.ts";

Deno.serve({ port: 4400 }, (req) => {
  const url = new URL(req.url);
  console.log(`${req.method} ${url.pathname}`);

  const { method } = req;
  const path = url.pathname;

  if (method === "POST" && path === "/register") return handleRegister(req);
  if (method === "GET" && path === "/users") return handleUsers(req, url);
  if (method === "POST" && path === "/call") return handleCall(req);
  if (method === "GET" && path === "/ws") return handleSignaling(req, url);
  if (method === "GET" && path.startsWith("/avatars/")) {
    return serveAvatarImage(path);
  }

  return new Response("Not found", { status: 404 });
});
