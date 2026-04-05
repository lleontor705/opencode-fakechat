# opencode-claude-bridge

OpenCode plugin that connects to Claude Code's fakechat WebSocket server, allowing OpenCode agents to delegate tasks to Claude Code.

## How it works

```
OpenCode AI Agent → claude-code tool → ws://localhost:8787 → Claude Code
```

When you run Claude Code with the fakechat channel:
```bash
claude --permission-mode bypassPermissions --channels plugin:fakechat@claude-plugins-official
```

It starts a WebSocket server on `ws://localhost:8787`. This plugin connects to it and exposes two custom tools in OpenCode:

### Tools

**`claude-code`** - Delegate a task to Claude Code
- `prompt` (string, required): The task to send
- `timeout` (number, optional): Timeout in seconds (default 120)

**`claude-code-status`** - Check connection status

## Install

### Option 1: Local plugin
Copy `src/index.ts` to your project's `.opencode/plugins/claude-bridge.ts`

### Option 2: npm (when published)
Add to your `opencode.json`:
```json
{
  "plugin": ["opencode-claude-bridge"]
}
```

## Usage in OpenCode session

Once installed, tell the OpenCode agent:
- "Use the claude-code tool to refactor the auth module"
- "Delegate the bug fix in src/api.ts to Claude Code"
- "Check if Claude Code is connected"

## Requirements

- [OpenCode](https://opencode.ai) installed
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) running with fakechat channel:
  ```bash
  claude --permission-mode bypassPermissions --channels plugin:fakechat@claude-plugins-official
  ```

## Architecture

The plugin:
1. Connects to `ws://localhost:8787/ws` on startup
2. Auto-reconnects on disconnect (5s interval)
3. Exposes `claude-code` custom tool that sends prompts via WebSocket
4. Returns Claude Code's response to the OpenCode agent
5. Handles timeouts and connection errors gracefully

## License

MIT
