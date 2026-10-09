# Legend of Now – Temple of Z

A browser game of the No Rest Group legend. You are the Stickman. The desert is the land far away, the things that chase you are Zs, and the way out is to go beyond yourself. No build step: open `index.html` (or the hosted build) and play. The same page exposes `window.game`, so an agent can observe the world, act, and advance time without anyone sitting at the screen.

## Play (human)

WASD or the arrow keys move. Q and E (or the left and right arrows) turn. Z throws a bolt that throws a Z away. X or Shift spends **Plus Energy** (the Now-shift): for two seconds the world, including the level clock, runs at quarter speed while you keep most of yours. On-screen buttons and a gamepad do the same thing. Keep walking and the Stickman picks up a little speed. An object in motion stays in motion.

Three levels carry the legend, in order. Far, Far Away: hold 10 coins, because spending leaves you with less, and throw the Zs away. The Path: carry 6 passion marks through the enterprise and its distractions. Beyond Yourself: throw the great Z away and walk through as yourself. Three lives. Touching a Z costs one and throws that Z away. Silver glitter is not a coin. On the first level it spends a coin you were holding. The line under the title is the Plus Energy meter.

Nothing here changes about the controls when you open the game normally. Agent controls are inert until something calls them.

## The story

The legend on the site is a mission, not a cast list. Far away, the world is driven by power, and people are bred into an enterprise that spends them: the more you spend, the less you have. There is another energy, a plus, and it cannot be bought, because it comes from within. Fear is a Z. It pulls you back and down, and it will always exist, so you throw it away anyway. The path to happiness is lost in that distraction. The only happiness is love and passion. You break the distractions, refuse the performance, and rewrite the story. Your name goes on it. Go beyond yourself.

Each level is one movement of that:

- **I. Far, Far Away.** The objective is to hold coins, not to get rich. Glitter is the spend, and taking it removes a coin you were holding. The Zs are the fear in that land. Throwing them away, and keeping moving, is how you leave those rules.
- **II. The Path.** The Slave is what the enterprise does to a person who did whatever the masters asked. Smiley says the way through is love, so the objective is six passion marks, not another pile of coins. Jeffery Bear is the energy that was never for sale: stand with him and Plus Energy returns faster.
- **III. Beyond Yourself.** The Alien eats borrowed force, so Plus Energy dies if you feed it. Anti-Social is the refusal to pretend, and inside that pocket the Zs cannot pull. The boss is one Z. You throw it away knowing it will always exist. The figure at the portal is you. The win is the story becoming yours.

## No Rest Group

The cast and the systems come from [norestgroup.com](https://www.norestgroup.com): the legend comic on `/pages/the-legend-of-now-and-the-temple-of-z` (a PageFly sequence of the owner's slides), the about page, Throw Away Your Zs, and the product descriptions. The slides are text posters, so the figures are drawn in that flat style instead of pasted in as textures.

| On the site | In the game |
| --- | --- |
| Stickman. A yellow line figure. "An object in motion stays in motion." The hero, and the "your name here" at the end. | You play that yellow stick figure. Walking fills a motion bonus, up to +18% speed. A second stick figure, labeled You, waits at the portal. |
| Coin. A gold face. "Where the more you spend, the less you have." | Level I guide, drawn as that coin face. Holding 10 coins is the objective. Glitter spends one of them. |
| The Slave. Humanity bred into an enterprise. "Whatever it takes." | Level II guide, in chains, on the road. |
| Smiley. "Love, in hoodie form." Happiness is love and passion. | Level II. The violet crystals are now passion marks. The objective field is still `wisdom` so older observers keep working. The HUD says Passion. |
| Jeffery Bear. Limitless energy, a playful spirit, journeys the universe elevating vibrations. | Level II. Stand near him and Plus Energy recharges faster. |
| Balloon. "For those days your vibration gives you lift." | Level I. Stand near the balloon and you move a little faster. |
| Anti-Social. Real, authentic, never pretend. For people who get out there, likes or no likes. | Level III. Inside that radius, Zs cannot pull you. |
| The Alien. It consumes the force. | Level III, off the road. Inside that radius Plus Energy ends and will not recharge. It is not a target. |
| Z. The gravitational force of fears, pulling back and down. Throw them away. They will forever exist. | The chasers are Zs and they tug you in. The boss is the great Z: three hits throw it away and open the portal. |
| Plus Energy, an added energy, an energy from within that cannot be bought. The universe is filled with energy. | Plus Energy is the Now-shift. Action `now_shift`, alias `plus_energy`. It is not a pickup. |
| Go. Beyond Yourself. The mission, and the line the legend ends on. | The portal, the win line, and level III's name. |
| All that glitters is not gold. | The silver glitter distractions. |
| NRG. No Rest Group. A portion of proceeds goes to children's mental health, and Jeffery Bear crewnecks to the Boys & Girls Club. | Named in the legend and the product copy. Not a figure or a rule in the game. |
| Prima, ZBasket, GBY as a garment ("the OG"), Sauce Box, NRG Prints. | Product and collection names. The site does not give them a person, an ability, or a place in the legend, so they are not in the world. |
| Sera of the Dunes, Kahl the Pilgrim, the Threshold Guardian. | Removed. They were not on the site. |

What the pages do not support, and so is not in the game: a second weapon, a shop, a faction war with stats, or a way to spend coins below the level goal. The comic says the more you spend the less you have; glitter is that spending, and the coins you need are kept. Digital albums and the sauce page are store promos, not legend.

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

`getState()` is JSON. It carries the level and its story, objective counters, score, lives, time left, the Plus Energy meter (`shift`), and the player pose (`x`, `z`, `yaw`, `heading`, `motion`). `aura` names a cast radius you are standing in. Nearby Zs, pickups (`kind` of `coin`, `wisdom`, or `glitter`), the portal, the guide (`npc`), the whole `cast`, and the boss (when one exists) each include world `x`/`z` plus `dx`, `dz`, `dist`, and `bearing` relative to the player. Bearing is signed radians: positive means the target is to the left, which is the direction of `turn_left`. Yaw `0` faces −Z, toward the temple. Lists are nearest first. `wisdom` is the passion-mark objective.

`outcome` is `null`, `"cleared"`, `"failed"`, or `"won"`. `levelsCleared` is how many levels this run has finished. `drive` is `"realtime"` or `"step"`. `events` since the previous read include `coin`, `wisdom`, `glitter`, `enemy_down`, `hurt`, `boss_hit`, `boss_down`, `now_shift`, `consumed`, `level_cleared`, `level_failed`, and `game_won`.

Movement is on the ground plane. The Stickman walks at 8 units/s, a bit more while `motion` is high or while Balloon's lift is active, and turns at up to 2.4 rad/s. Bolts travel at 16 units/s and hit a Z within 1.2 units horizontally. Plus Energy slows the world (clock and bolts included) to 1/4 for 2 seconds, then cools down for 8. `plus_energy` is the same action as `now_shift`.

### Manifest

`/agent.json` (and `window.game.manifest`) is a machine-readable description of the actions, the observation, and the tool schemas. An MCP client can treat `tools` as its tool list. The copy on disk is generated from `js/manifest.js`:

```bash
node scripts/write-manifest.mjs
```

## Run the reference bot

The bot in `js/bot.js` is a heuristic: it faces threats, kites when they get close, shoots when the bearing is tight, grabs the nearest coin or passion mark it still needs, ignores glitter, and walks into an open portal. It only talks to `window.game`.

```bash
npm install
npm run bot                                         # all 3 levels, seed 1
node scripts/run-bot.mjs --levels 1 --seed 1        # level 1 only
node scripts/run-bot.mjs --levels 3 --seed 2
```

Headless Chrome (or Chromium) has to be on `PATH`. Set `CHROME_PATH` if it lives somewhere else. The script exits 0 when the requested number of levels are cleared.

On seed 1 the reference bot finishes the legend: Far, Far Away, then the Path, then Z and the portal. That run is the default for `npm run bot` and `npm test`.

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
- `js/mascots.js` — procedural Stickman, Coin, Smiley, Jeffery Bear, Balloon, Alien, and Z.
- `js/levels.js` — the three passages and their cast.
- `js/rng.js` — seeded gameplay RNG. With no seed, rolls still come from `Math.random()`.
- `js/agent.js` — `window.game`.
- `js/bot.js` — the reference heuristic.
- `js/manifest.js` and `agent.json` — the discovery document.
- `scripts/agent-bridge.mjs` — HTTP, JSON lines, and MCP.
- `scripts/run-bot.mjs` — headless proof that the bot can finish a level.

Dune placement, sand, and audio noise are visual. They stay on `Math.random()` and are not part of a replay. Replay the gameplay stream with `?seed=` plus step mode; a realtime frame rate will not reproduce spawn timing.

## Notes

Two proximity tests used a 3D distance against an object floating above the player. A bolt sits at chest height, so a radius of 1.2 could never reach a Z whose origin is on the ground, and the portal ring sits higher than its 1.7 entry radius, so the finale could not be finished. Both checks are on the ground plane. Walking into the ring completes the legend.

Headless mode still creates a WebGL context and still loads the character models, because the simulation lives in the page. It does not present frames, and it skips skeletal animation while keeping the timers that open the portal. Fixed-step mode is 30 Hz. The reference bot is a script, not a model: it is there to prove the API can finish the work an outside agent is supposed to do.
