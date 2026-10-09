# Legend of Now – Temple of Z

A browser game about walking the desert of the Now. No build step: open `index.html` (or the hosted build) and play. The same page exposes `window.game`, so an agent can observe the world, act, and advance time without anyone sitting at the screen.

## Play (human)

WASD or the arrow keys move. Q and E (or the left and right arrows) turn. Z fires. X or Shift spends **Now-shift**: for two seconds the world, including the level clock, runs at quarter speed while you keep most of yours. On-screen buttons and a gamepad do the same thing.

Three levels. The dunes want 10 relic coins. The pilgrim road wants 6 wisdom crystals. The threshold wants the chasers gone, the Guardian down, and a walk into the portal. Three lives. Touching a chaser costs one and defeats that chaser. Bolts defeat chasers at a distance.

Nothing here changes when you open the game normally. Agent controls are inert until something calls them.

## Agent API

The page always installs `window.game`. Useful flags:

| Flag | Effect |
| --- | --- |
| `?agent=1` | Step mode. Time advances only when `step(n)` is called. The picture still renders, so a person can watch. |
| `?headless=1` | Step mode, and the page skips drawing, shadows, bloom, and cosmetic particles. This is the mode the bots use. |
| `?seed=1` | Seeds relic, wisdom, and chaser rolls. Combined with step mode, the same inputs replay the same run. |
| `?bot=1` | After load, runs the built-in reference bot. Optional `&levels=1` and `&maxTicks=7000`. |

`?agent=1` and `?headless=1` both count as on when the value is empty, `1`, `true`, `yes`, or `on`.

```js
await window.game.ready;
window.game.act('start');
window.game.act({ forward: 1, turn: 0.2, fire: true });
const obs = window.game.step(5);   // 5 ticks of 1/30 s. Returns the observation.
```

### Methods

- `ready` — Promise. Resolves when the cast has loaded and the menu is up.
- `getState()` — Compact observation. Drains the event queue.
- `listActions()` — The action catalog.
- `act(action)` — A string (`"forward"`, `"fire"`, `"now_shift"`, `"start"`, `"restart"`, …) or a move object `{forward, strafe, turn, fire, shift}`. Axes latch until changed and are clamped to [-1, 1]. `fire` and `shift` happen once, on the next tick. Returns `{ok, error?}`.
- `step(n)` — Simulate `n` ticks (max 5000) at a fixed 1/30 second and return the observation. Calling it switches the page into step mode.
- `setSeed(seed, {restart})` — Seed used the next time a level loads. `restart: true` reloads level 1 now.
- `setDrive("realtime" | "step")` — Hand the clock back to the display, or take it again.
- `manifest` — The same document served at `/agent.json`.

String actions set one channel and leave the others alone. `"stop"` clears move and turn. `"forward"` then `"turn_left"` walks while turning.

### Observation

`getState()` is JSON. It carries the level and its story, objective counters, score, lives, time left, Now-shift meter, and the player pose (`x`, `z`, `yaw`, `heading`). Nearby chasers, pickups (`kind` of `coin` or `wisdom`), the portal, the NPC, and the boss (when one exists) each include world `x`/`z` plus `dx`, `dz`, `dist`, and `bearing` relative to the player. Bearing is signed radians: positive means the target is to the left, which is the direction of `turn_left`. Yaw `0` faces −Z, toward the temple. Lists are nearest first.

`outcome` is `null`, `"cleared"`, `"failed"`, or `"won"`. `levelsCleared` is how many levels this run has finished. `drive` is `"realtime"` or `"step"`. `events` since the previous read include `coin`, `wisdom`, `enemy_down`, `hurt`, `boss_hit`, `boss_down`, `now_shift`, `level_cleared`, `level_failed`, and `game_won`.

Movement is on the ground plane. The player walks at 8 units/s and turns at up to 2.4 rad/s. Bolts travel at 16 units/s and hit a chaser within 1.2 units horizontally. Now-shift slows the world (clock and bolts included) to 1/4 for 2 seconds, then cools down for 8.

### Manifest

`/agent.json` (and `window.game.manifest`) is a machine-readable description of the actions, the observation, and the tool schemas. An MCP client can treat `tools` as its tool list. The copy on disk is generated from `js/manifest.js`:

```bash
node scripts/write-manifest.mjs
```

## Run the reference bot

The bot in `js/bot.js` is a heuristic: it faces threats, kites when they get close, shoots when the bearing is tight, grabs the nearest relic or crystal it still needs, and walks into an open portal. It only talks to `window.game`.

```bash
npm install
npm run bot                                         # all 3 levels, seed 1
node scripts/run-bot.mjs --levels 1 --seed 1        # level 1 only
node scripts/run-bot.mjs --levels 3 --seed 2
```

Headless Chrome (or Chromium) has to be on `PATH`. Set `CHROME_PATH` if it lives somewhere else. The script exits 0 when the requested number of levels are cleared.

On seed 1 the reference bot finishes the legend: level 1 with all three lives, then the pilgrim road, then the Guardian and the portal. That run is the default for `npm run bot` and `npm test`.

`npm test` parses the modules, checks the manifest and the heuristic, checks that keyboard play still moves the hero, checks step mode, replay, and that a bolt can defeat a chaser, checks the HTTP bridge, and runs the bot.

## Drive it from outside

`scripts/agent-bridge.mjs` loads the game in headless Chrome and speaks three protocols.

```bash
npm run agent               # HTTP on 127.0.0.1:8787, seed 1
node scripts/agent-bridge.mjs --port 8787 --seed 1
node scripts/agent-bridge.mjs --stdio
node scripts/agent-bridge.mjs --mcp
```

HTTP:

```bash
curl -s http://127.0.0.1:8787/api/state
curl -s -X POST http://127.0.0.1:8787/api/act -d '{"action":"start"}' -H 'content-type: application/json'
curl -s -X POST http://127.0.0.1:8787/api/step -d '{"n":10,"action":{"forward":1,"fire":true}}' -H 'content-type: application/json'
curl -s -X POST http://127.0.0.1:8787/api/bot -d '{"levels":1}' -H 'content-type: application/json'
```

JSON lines on stdin (`--stdio`), one response line each:

```json
{"id": 1, "method": "getState"}
{"id": 2, "method": "act", "params": {"action": "start"}}
{"id": 3, "method": "step", "params": {"n": 5, "action": {"forward": 1}}}
```

`--mcp` speaks MCP over stdio (JSON-RPC 2.0, Content-Length framing or a single JSON line). Tools: `get_state`, `list_actions`, `act`, `step`, `set_seed`, `run_bot`. A typical loop for Grok Bot, Muse, or any other tool-calling client is `get_state`, choose an action from the observation, `act` or `step`, and repeat until `outcome` is `cleared` or `won`.

Logs from the bridge go to stderr so they do not mix with the protocol on stdout.

## Layout

- `js/main.js` — the game. Human input is unchanged; agent intent is a second stick that stays at rest until `act`.
- `js/rng.js` — seeded gameplay RNG. With no seed, rolls still come from `Math.random()`.
- `js/agent.js` — `window.game`.
- `js/bot.js` — the reference heuristic.
- `js/manifest.js` and `agent.json` — the discovery document.
- `scripts/agent-bridge.mjs` — HTTP, JSON lines, and MCP.
- `scripts/run-bot.mjs` — headless proof that the bot can finish a level.

Dune placement, sand, and audio noise are visual. They stay on `Math.random()` and are not part of a replay. Replay the gameplay stream with `?seed=` plus step mode; a realtime frame rate will not reproduce spawn timing.

## Notes

Two proximity tests used a 3D distance against an object floating above the player. A bolt sits at chest height, so a radius of 1.2 could never reach a chaser whose origin is on the ground, and the portal ring sits higher than its 1.7 entry radius, so the finale could not be finished. Both checks are now on the ground plane. Keyboard and gamepad fire behave as the button always implied, and walking into the ring completes the legend.

Headless mode still creates a WebGL context and still loads the character models, because the simulation lives in the page. It does not present frames, and it skips skeletal animation while keeping the timers that open the portal. Fixed-step mode is 30 Hz. The reference bot is a script, not a model: it is there to prove the API can finish the work an outside agent is supposed to do.
