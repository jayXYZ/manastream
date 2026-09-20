# ManaStream OBS Bridge

A small Node process that runs on the machine hosting OBS. It keeps an
outbound connection to ManaStream and a local connection to OBS, so
ManaStream automations can start or stop the stream, switch scenes, toggle
sources, and more, without exposing OBS to the internet.

## How it works

1. In the ManaStream dashboard, open **Automations**, add an **OBS
   controller**, and copy its token.
2. In OBS, open **Tools → WebSocket Server Settings**, enable the server, and
   note the port and password (OBS 28 or later bundles obs-websocket v5).
3. Run the bridge on that machine with the token and your ManaStream URL.
4. Create automations such as "when a new round starts, stop streaming" and
   target the controller. The dashboard shows whether the bridge is online
   and what OBS is currently doing.

The bridge subscribes to a per-controller command queue. For each command it
atomically claims the row, maps it to an obs-websocket request, runs it, and
reports the result. Commands that are not claimed within a minute expire,
so a bridge that was offline never replays a stale stop-stream. Start and
stop commands are idempotent: if OBS is already in the requested state the
bridge reports success without calling OBS.

Every thirty seconds the bridge sends a heartbeat with the OBS connection
state, streaming and recording status, and the current scene. OBS stream
start/stop and scene changes are forwarded back as ManaStream triggers
(`obs.streaming.started`, `obs.streaming.stopped`, `obs.scene.changed`).

## Running

From the repository root:

```bash
pnpm install
pnpm --filter @manastream/obs-bridge build
MANASTREAM_CONVEX_URL=https://your-deployment.convex.cloud \
MANASTREAM_BRIDGE_TOKEN=paste-token-here \
OBS_WEBSOCKET_PASSWORD=your-obs-password \
pnpm --filter @manastream/obs-bridge start
```

Or with flags:

```bash
node packages/obs-bridge/dist/cli.js \
  --convex-url https://your-deployment.convex.cloud \
  --token paste-token-here \
  --obs-url ws://127.0.0.1:4455 \
  --obs-password your-obs-password
```

The ManaStream URL is the same value as `NEXT_PUBLIC_CONVEX_URL` in the web
app's environment.

| Setting        | Flag             | Environment variable       | Default                 |
| -------------- | ---------------- | -------------------------- | ----------------------- |
| ManaStream URL | `--convex-url`   | `MANASTREAM_CONVEX_URL`    | required                |
| Controller     | `--token`        | `MANASTREAM_BRIDGE_TOKEN`  | required                |
| OBS URL        | `--obs-url`      | `OBS_WEBSOCKET_URL`        | `ws://127.0.0.1:4455`   |
| OBS password   | `--obs-password` | `OBS_WEBSOCKET_PASSWORD`   | none                    |
| Heartbeat (ms) | `--heartbeat-ms` | `MANASTREAM_HEARTBEAT_MS`  | `30000`                 |

Keep the bridge running for the whole broadcast. A process manager such as
`pm2`, a Windows scheduled task, or a launchd agent works well. The bridge
reconnects to OBS automatically with backoff if OBS restarts.

## Supported commands

| ManaStream command      | obs-websocket request                          |
| ----------------------- | ---------------------------------------------- |
| `streaming.start/stop`  | `StartStream` / `StopStream`                   |
| `recording.start/stop`  | `StartRecord` / `StopRecord`                   |
| `replayBuffer.save`     | `SaveReplayBuffer`                             |
| `scene.set`             | `SetCurrentProgramScene`                       |
| `sceneItem.setEnabled`  | `GetSceneItemId` then `SetSceneItemEnabled`    |
| `filter.setEnabled`     | `SetSourceFilterEnabled`                       |
| `raw`                   | Any request type and payload                   |

## Security

The controller token is a capability: anyone holding it can queue commands
for that OBS instance. Treat it like a password and regenerate it from the
dashboard if it leaks. The bridge only ever makes outbound connections.
