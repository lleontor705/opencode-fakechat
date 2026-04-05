# opencode-fakechat

A WebSocket-based chat web UI plugin for [OpenCode](https://opencode.ai).

Provides a browser-accessible chat interface that bridges to OpenCode sessions, showing streaming responses, tool executions, and session management.

## Install

Add to your project's `.opencode/package.json`:

```json
{
  "dependencies": {
    "opencode-fakechat": "^0.1.0"
  }
}
```

Then add to `opencode.json`:

```json
{
  "plugin": ["opencode-fakechat"]
}
```

With a custom port:

```json
{
  "plugin": [["opencode-fakechat", { "port": 9000 }]]
}
```

## Usage

Once OpenCode starts, open `http://localhost:8788` in your browser.

The chat UI supports:

- **Sending messages** — type in the input box and press Enter
- **Streaming responses** — assistant replies stream in real-time
- **Tool execution** — see when tools start and complete
- **Session management** — list sessions in the sidebar, click to switch
- **Auto-reconnect** — WebSocket reconnects automatically on disconnect

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `port` | `8788` | HTTP/WebSocket server port |

## Architecture

```
Browser ──WebSocket──▶ Bun.serve (src/server.ts)
                            │
                            ▼
                     Plugin hooks (src/index.ts)
                            │
                            ▼
                     OpenCode SDK client
                      (session.chat, session.list)
```

- **src/index.ts** — Plugin entry point, exports hooks for OpenCode events
- **src/server.ts** — Bun.serve HTTP + WebSocket server
- **src/chat-ui.ts** — HTML/CSS/JS template for the chat interface

## Events Handled

| OpenCode Event | UI Effect |
|---------------|-----------|
| `session.created` | Notifies UI, updates session list |
| `session.idle` | Status indicator turns green |
| `session.updated` | Status indicator updates |
| `message.part.updated` | Streams assistant text |
| `message.updated` | Finalizes assistant message |
| `tool.execute.before` | Shows tool start indicator |
| `tool.execute.after` | Shows tool completion |
| `session.error` | Displays error message |

## License

MIT
