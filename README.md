# AURA Browser Prototype v0.2

Futuristic browser shell based on the reference UI.

## Run
```cmd
npm install
npm start
```

## Added in v0.2
- Persistent website shortcuts per workspace
- Add shortcut dialog
- Right-click shortcut menu
- Rename/remove shortcuts
- Move shortcuts between workspaces
- Workspace-specific shortcut sets
- Real browser tabs using Electron webviews
- Tab switching and closing
- Browser history controls per tab
- Ctrl+L focus URL/search
- Ctrl+T dashboard/new-tab
- Ctrl+Space AURA command palette
- Shortcut/workspace state stored in localStorage

## Architecture
This remains a standalone browser-shell prototype.
Do NOT merge it into the Python AURA core yet.

The eventual architecture is:
Browser UI -> local bridge/API -> AURA Python core -> commands/tools/AI
