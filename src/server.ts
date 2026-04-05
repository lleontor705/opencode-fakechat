import type { ServerWebSocket } from "bun";
import { chatHTML } from "./chat-ui";

export type PromptHandler = (text: string, sessionID?: string) => Promise<void>;
export type ListSessionsHandler = () => Promise<Array<{ id: string; title?: string }>>;
export type SwitchSessionHandler = (sessionID: string) => void;

interface WSData {
  id: string;
}

interface ChatServer {
  port: number;
  broadcast: (msg: object) => void;
  stop: () => void;
}

export function startServer(opts: {
  port: number;
  onPrompt: PromptHandler;
  onListSessions: ListSessionsHandler;
  onSwitchSession: SwitchSessionHandler;
}): ChatServer {
  const clients = new Set<ServerWebSocket<WSData>>();
  let clientCounter = 0;

  const html = chatHTML(opts.port);

  const server = Bun.serve<WSData>({
    port: opts.port,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const id = String(++clientCounter);
        const ok = server.upgrade(req, { data: { id } });
        return ok ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
      }

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      async message(ws, raw) {
        try {
          const msg = JSON.parse(String(raw));

          switch (msg.type) {
            case "prompt":
              await opts.onPrompt(msg.text, msg.sessionID);
              break;
            case "list_sessions":
              const sessions = await opts.onListSessions();
              ws.send(JSON.stringify({ type: "sessions", sessions }));
              break;
            case "switch_session":
              opts.onSwitchSession(msg.sessionID);
              break;
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: "error", message: String(err) }));
        }
      },
    },
  });

  function broadcast(msg: object) {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      ws.send(data);
    }
  }

  function stop() {
    server.stop();
  }

  return { port: opts.port, broadcast, stop };
}
