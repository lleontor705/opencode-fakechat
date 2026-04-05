import type { Plugin } from "@opencode-ai/plugin"

const CLAUDE_WS_URL = "ws://127.0.0.1:8787/ws"
const RECONNECT_INTERVAL = 5000

/**
 * OpenCode plugin that bridges to Claude Code's fakechat WebSocket server.
 *
 * When OpenCode starts, this plugin connects to ws://localhost:8787 (the Claude Code
 * fakechat channel) and exposes a custom tool so the AI agent can delegate tasks
 * to Claude Code programmatically.
 *
 * Usage in OpenCode session:
 *   "Use the claude-code tool to refactor src/auth.ts"
 */
const plugin: Plugin = async ({ client, project, directory, worktree }) => {
  let ws: WebSocket | null = null
  let connected = false
  let pendingRequests = new Map<string, {
    resolve: (text: string) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  let assistantBuffer = new Map<string, string>()
  let currentMsgId: string | null = null

  function connect() {
    try {
      ws = new WebSocket(CLAUDE_WS_URL)

      ws.onopen = () => {
        connected = true
        client.app.log({
          body: {
            service: "opencode-claude-bridge",
            level: "info",
            message: "Connected to Claude Code fakechat at " + CLAUDE_WS_URL,
          },
        })
      }

      ws.onclose = () => {
        connected = false
        setTimeout(connect, RECONNECT_INTERVAL)
      }

      ws.onerror = () => {
        connected = false
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data))

          // Handle assistant responses
          if (msg.type === "msg" && msg.from === "assistant") {
            assistantBuffer.set(msg.id, msg.text || "")
            currentMsgId = msg.id

            // If there's a pending request, resolve it
            // Claude Code sends complete responses in one message (non-streaming for us)
            for (const [reqId, pending] of pendingRequests.entries()) {
              clearTimeout(pending.timer)
              pendingRequests.delete(reqId)
              pending.resolve(msg.text || "")
            }
          }

          // Handle edits (streaming updates)
          if (msg.type === "edit" && currentMsgId) {
            const existing = assistantBuffer.get(currentMsgId) || ""
            assistantBuffer.set(currentMsgId, existing + (msg.text || ""))
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch {
      connected = false
      setTimeout(connect, RECONNECT_INTERVAL)
    }
  }

  connect()

  function sendToClaude(text: string, timeoutMs = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected to Claude Code fakechat"))
        return
      }

      const id = `oc-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const timer = setTimeout(() => {
        pendingRequests.delete(id)
        reject(new Error("Claude Code request timed out"))
      }, timeoutMs)

      pendingRequests.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ id, text }))
    })
  }

  return {
    tool: {
      "claude-code": {
        description:
          "Delegate a coding task to Claude Code via the fakechat WebSocket bridge. " +
          "Use this for complex coding tasks like refactoring, implementing features, " +
          "debugging, or any work that benefits from Claude Code's capabilities. " +
          "Returns Claude Code's response as text.",
        args: {
          prompt: {
            type: "string" as const,
            description: "The task or prompt to send to Claude Code",
          },
          timeout: {
            type: "number" as const,
            description: "Timeout in seconds (default 120)",
          },
        },
        async execute(args: { prompt: string; timeout?: number }) {
          const timeoutMs = (args.timeout ?? 120) * 1000

          if (!connected) {
            return "⚠️ Not connected to Claude Code. Make sure Claude Code is running with --channels plugin:fakechat@claude-plugins-official"
          }

          try {
            const response = await sendToClaude(args.prompt, timeoutMs)
            return response || "(empty response from Claude Code)"
          } catch (err: any) {
            return `❌ Claude Code error: ${err.message}`
          }
        },
      } satisfies any,

      "claude-code-status": {
        description: "Check the connection status to Claude Code fakechat bridge",
        args: {},
        async execute() {
          const status = connected ? "✅ Connected" : "❌ Disconnected"
          const url = CLAUDE_WS_URL
          const pending = pendingRequests.size
          return `${status} to ${url}\nPending requests: ${pending}\n\nTo start Claude Code:\nclaude --permission-mode bypassPermissions --channels plugin:fakechat@claude-plugins-official`
        },
      } satisfies any,
    },

    event: async ({ event }) => {
      const e = event as any
      // Log connection status changes
      if (e.type === "session.created") {
        await client.app.log({
          body: {
            service: "opencode-claude-bridge",
            level: "info",
            message: `Claude Code bridge status: ${connected ? "connected" : "disconnected"}`,
          },
        })
      }
    },
  }
}

export default plugin
