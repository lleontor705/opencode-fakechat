import type { Plugin, PluginModule } from "@opencode-ai/plugin";
import { startServer } from "./server";

const plugin: Plugin = async (input, options) => {
  const { client, project } = input;
  const port = Number(options?.port) || 8788;

  let activeSessionID: string | undefined;
  const messageTexts = new Map<string, string>();

  const server = startServer({
    port,
    async onPrompt(text, sessionID) {
      try {
        const targetSession = sessionID || activeSessionID;
        if (!targetSession) {
          // Create a new session if none active
          server.broadcast({ type: "error", message: "No active session. Creating one..." });
          const res = await client.session.create({ body: {} });
          activeSessionID = res.data?.id;
          server.broadcast({ type: "session_created", sessionID: activeSessionID });
        }
        const sid = sessionID || activeSessionID;
        if (!sid) return;

        await client.session.chat({
          path: { id: sid },
          body: { parts: [{ type: "text", text }] },
        });
      } catch (err) {
        server.broadcast({ type: "error", message: String(err) });
      }
    },
    async onListSessions() {
      try {
        const res = await client.session.list();
        const sessions = res.data ?? [];
        return sessions.map((s: any) => ({
          id: s.id,
          title: s.title || s.id?.slice(0, 12),
        }));
      } catch {
        return [];
      }
    },
    onSwitchSession(sessionID) {
      activeSessionID = sessionID;
    },
  });

  await client.app.log({
    body: {
      service: "opencode-fakechat",
      level: "info",
      message: `Chat UI started on http://localhost:${port}`,
    },
  });

  return {
    event: async ({ event }) => {
      const e = event as any;
      const type = e.type as string;

      switch (type) {
        case "session.created": {
          if (!activeSessionID) {
            activeSessionID = e.properties?.id;
          }
          server.broadcast({
            type: "session_created",
            sessionID: e.properties?.id,
          });
          break;
        }

        case "session.idle": {
          server.broadcast({
            type: "session_status",
            status: "idle",
            sessionID: e.properties?.id,
          });
          server.broadcast({
            type: "prompt_done",
            sessionID: e.properties?.id,
          });
          break;
        }

        case "session.updated":
        case "session.status": {
          const status = e.properties?.status ?? "unknown";
          server.broadcast({
            type: "session_status",
            status,
            sessionID: e.properties?.id,
          });
          break;
        }

        case "message.part.updated": {
          const props = e.properties ?? {};
          const part = props.part;
          if (part?.type === "text") {
            const messageID = props.messageID ?? props.id ?? "unknown";
            messageTexts.set(messageID, part.text ?? "");
            server.broadcast({
              type: "assistant_text",
              messageID,
              text: part.text ?? "",
              streaming: true,
            });
          }
          break;
        }

        case "message.updated": {
          const props = e.properties ?? {};
          const messageID = props.id ?? "unknown";
          const text = messageTexts.get(messageID);
          if (text !== undefined) {
            server.broadcast({
              type: "assistant_text",
              messageID,
              text,
              streaming: false,
            });
            messageTexts.delete(messageID);
          }
          break;
        }

        case "session.error": {
          server.broadcast({
            type: "error",
            message: e.properties?.error ?? "Session error",
          });
          break;
        }
      }
    },

    "tool.execute.before": async ({ input: toolInput, output }) => {
      const toolName = (toolInput as any)?.tool ?? "unknown";
      server.broadcast({
        type: "tool_start",
        tool: toolName,
        sessionID: activeSessionID,
      });
      return output;
    },

    "tool.execute.after": async ({ input: toolInput, output }) => {
      const toolName = (toolInput as any)?.tool ?? "unknown";
      server.broadcast({
        type: "tool_end",
        tool: toolName,
        title: output?.title,
        sessionID: activeSessionID,
      });
      return output;
    },
  };
};

export default {
  id: "opencode-fakechat",
  server: plugin,
} satisfies PluginModule;
