const sockets = new Map<string, WebSocket>();

// GET /ws?username=<name>
export function handleSignaling(req: Request, url: URL): Response {
  const username = url.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "username required" }, { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.onopen = () => {
    sockets.set(username, socket);
    console.log(`${username} connected`);
  };
  socket.onclose = () => {
    if (sockets.get(username) === socket) sockets.delete(username);
    console.log(`${username} disconnected`);
  };
  socket.onmessage = (e) => {
    let msg: { type?: string; to?: string; [key: string]: unknown };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (!msg.to) return;
    const target = sockets.get(msg.to);
    if (target?.readyState === WebSocket.OPEN) {
      target.send(JSON.stringify({ ...msg, from: username }));
    }
  };
  return response;
}
