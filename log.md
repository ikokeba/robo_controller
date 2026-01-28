# Log
## 2026-01-28 10:55:09
- Added a reconnect button for the WebSocket client and enabled it on disconnect.
- Updated connection status to show connecting/connected/disconnected states.
- Styled the header actions for the status and reconnect button.
## 2026-01-28 11:01:21
- Added robot connection status updates from server to client.
- Updated client status rendering to reflect robot disconnection while WebSocket is open.
- Added server-side polling to keep robot connection state in sync.
## 2026-01-28 16:05:37
- Rewired the reconnect button to trigger a robot reconnect over WebSocket.
- Added a pending reconnect flag to retry once the WebSocket opens.
## 2026-01-28 16:09:24
- Made robot reconnect force-close stale sockets before opening a new one.
- Send immediate status update after reconnect attempts.
