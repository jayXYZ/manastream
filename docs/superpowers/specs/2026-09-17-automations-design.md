# Automations and OBS Bridge Design

## Goal

Let a stream operator react to ManaStream events with actions they configure
themselves, without code changes per workflow. The first concrete use case is
"stop or start streaming in OBS when a new tournament round is detected", but
the model is a generic trigger, condition, and action pipeline so other
operators can wire the same events to webhooks or to different OBS commands.

## Existing Context

Round detection is already centralized: the Spicerack poller calls
`checkForNewRound` in `convex/lib/rounds.ts`, which only calls
`handleNewRound` when the round id or number changes. Timer state changes go
through `setTournamentTimer` in `convex/tournaments.ts`, and polling status
changes go through `updateTournamentPollingStatus` in
`convex/tournamentSync.ts`. Public overlay pages already use unguessable
capability URLs (`publicUuid`), and `connectedLifeTrackers` already models a
heartbeat with `lastSeen`.

OBS has no inbound HTTP API. It ships obs-websocket v5 (OBS 28 and later),
which is a WebSocket server on the operator's LAN. The cloud backend cannot
reach it, so the OBS side must connect outward.

## Design

### Event emission

A single helper, `emitAutomationEvent(ctx, { userId, tournamentId, type,
payload, dedupeKey })`, is called from the existing mutations at the trigger
points. It records the event in `automationEvents`, finds the user's enabled
automations whose trigger matches and whose conditions pass, and creates one
`automationDeliveries` row per match. Delivery of each action is then
dispatched according to its type. A `dedupeKey` makes retried or replayed
mutations idempotent (for example `round.started:<tournamentId>:<roundId>`).

Trigger catalog (data, not code; extending it is one entry in the validator
plus one call site):

- `round.started`
- `timer.started`, `timer.paused`
- `tournament.polling.started`, `tournament.polling.stopped`,
  `tournament.polling.error`
- `obs.streaming.started`, `obs.streaming.stopped`, `obs.scene.changed`
  (reported by a bridge, so OBS is a trigger source as well as a target)

### Automations

`automations` rows are owned by a user and hold `{ name, enabled, trigger,
conditions, action }`. Conditions are a small list of `{ path, op, value }`
predicates evaluated against the event payload. The action is a discriminated
union:

- `webhook`: URL, method, optional headers, optional body template with
  `{{path}}` placeholders. A per-automation secret, never returned to the
  client, signs each request with HMAC-SHA256 over `timestamp.body`.
- `obs`: a target `obsControllers` row plus a structured command such as
  `streaming.stop`, `scene.set`, or `raw` for any obs-websocket request.

### Delivery

Webhook deliveries run in an internal action scheduled from the mutation
(mutations cannot call `fetch`). The action retries with backoff, records the
HTTP status or error on the delivery row, and disables the automation after a
run of consecutive failures.

OBS deliveries insert an `obsCommands` row with a short `expiresAt`. The
command queue is the executor interface: any process that can subscribe to
Convex and talk to OBS can drain it.

### OBS bridge

`packages/obs-bridge` is a small Node CLI that runs on the OBS machine. It
holds two connections: a Convex subscription to `pendingCommands` using a
controller token, and an obs-websocket-js client to the local OBS. For each
pending command it atomically claims the row, maps the command to an
obs-websocket request, calls OBS, and reports success or failure. It refuses
expired commands so a reconnecting bridge never replays a stale
stop-stream, treats "already streaming" as success for idempotent intent,
sends a heartbeat with OBS state every thirty seconds, and forwards OBS
stream and scene events back as triggers.

## Data Flow

1. Spicerack sync detects a new round and `handleNewRound` emits
   `round.started`.
2. `emitAutomationEvent` matches the user's automations and creates delivery
   rows; OBS actions also create `obsCommands` rows.
3. The bridge's subscription fires, it claims the command, calls OBS, and
   reports the result, which updates the delivery row.
4. The dashboard shows controllers with online state, the automation list, and
   a delivery log with per-attempt outcomes.

## Fallbacks

If no bridge is connected, OBS commands sit pending until they expire and are
marked failed with a clear reason. Webhook failures are retried three times
and then recorded. Test events can be sent from the dashboard to validate a
rule without waiting for a real round change.

## Testing

Unit tests cover condition evaluation, body templating, automation matching,
the obs-websocket request mapping in the bridge, and the round hook emitting
exactly one event per round change.
