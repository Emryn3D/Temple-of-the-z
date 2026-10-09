// Machine-readable description of the agent API.
// agent.json at the repo root is a copy of MANIFEST (checked in CI).

export const TICK_HZ = 30;
export const FIXED_DT = 1 / 30;

export const ACTIONS = [
  { name: 'start', description: 'Leave the menu and play the current level. On the win screen this returns to the level 1 menu instead of starting.' },
  { name: 'restart', description: 'Reset score and lives, clear latched input, and return to the level 1 menu. The current seed is kept and replayed.' },
  { name: 'pause', description: 'Pause a running game. Time does not advance while paused.' },
  { name: 'resume', description: 'Resume from pause.' },
  { name: 'stop', description: 'Clear latched move and turn.' },
  { name: 'forward', description: 'Latch movement forward, along the facing direction. Leaves strafe and turn unchanged.' },
  { name: 'back', description: 'Latch movement backward. Leaves strafe and turn unchanged.' },
  { name: 'strafe_left', description: 'Latch strafe to the player\'s left.' },
  { name: 'strafe_right', description: 'Latch strafe to the player\'s right.' },
  { name: 'turn_left', description: 'Latch a full-rate left turn. Yaw increases at 2.4 rad/s. Yaw 0 faces -Z; positive yaw turns toward +X.' },
  { name: 'turn_right', description: 'Latch a full-rate right turn. Yaw decreases at 2.4 rad/s.' },
  { name: 'fire', description: 'Throw one bolt along the current heading on the next tick. One-shot; not latched. Bolts travel 16 units/s and throw away a Z within 1.2 units horizontally.' },
  { name: 'now_shift', description: 'Spend Plus Energy (the Now-shift) if the meter is full. One-shot. For 2 seconds of real time the world (including the level clock and bolts) runs at 1/4 speed while the Stickman keeps 90% speed. Then an 8 second cooldown. This is the energy from within; it cannot be bought. The Alien consumes it.' },
  { name: 'plus_energy', description: 'Alias of now_shift. The No Rest name for the same power.' },
  {
    name: 'move',
    description: 'Set any combination of latched axes and optional one-shot fire/shift. Unspecified axes are left as they were. Values are clamped to [-1, 1].',
    args: {
      forward: 'number -1..1. Positive moves forward at full speed (8 units/s).',
      strafe: 'number -1..1. Positive strafes right.',
      turn: 'number -1..1. Positive turns left at up to 2.4 rad/s.',
      fire: 'boolean. Fire once on the next tick.',
      shift: 'boolean. Try Plus Energy (Now-shift) once on the next tick. plus_energy is accepted as the same flag.'
    }
  }
];

export const TOOLS = [
  {
    name: 'get_state',
    description: 'Observe Legend of Now – Temple of Z. Returns level, objectives, score, lives, time left, player pose (including Stickman motion), aura, and nearby Zs, pickups, portal, cast, NPC, and boss with positions relative to the player. Reading state drains the event queue.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  },
  {
    name: 'list_actions',
    description: 'List every action the game accepts.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  },
  {
    name: 'act',
    description: 'Apply one action. String names latch a single channel (forward, back, strafe_left, strafe_right, turn_left, turn_right) or fire a one-shot (fire, now_shift) or control the session (start, restart, pause, resume, stop). An object sets move axes: {forward, strafe, turn, fire, shift}. Movement persists until changed; call step() to simulate.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          description: 'Action name (string) or a move object {forward, strafe, turn, fire, shift}.'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'step',
    description: 'Advance the simulation by n fixed timesteps (1/30 s each), independent of the display frame rate. Switches the session into step mode. Optional action is applied first. Returns the new observation.',
    inputSchema: {
      type: 'object',
      properties: {
        n: { type: 'integer', minimum: 0, maximum: 5000, default: 1 },
        action: { description: 'Optional action to apply before stepping. Same shapes as act.' }
      }
    }
  },
  {
    name: 'set_seed',
    description: 'Set the gameplay RNG seed used for relic coins, wisdom crystals, and chaser spawns. The seed is applied the next time a level loads. Pass restart true to reload level 1 immediately.',
    inputSchema: {
      type: 'object',
      required: ['seed'],
      properties: {
        seed: { description: 'Number or string. Same seed replays the same level layout in step mode.' },
        restart: { type: 'boolean', description: 'When true, reset to the level 1 menu so the seed applies now.' }
      }
    }
  },
  {
    name: 'run_bot',
    description: 'Run the built-in heuristic reference bot via the agent API until it clears the requested number of levels, fails, or exhausts maxTicks.',
    inputSchema: {
      type: 'object',
      properties: {
        levels: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
        maxTicks: { type: 'integer', minimum: 1, description: 'Cap on fixed timesteps. Default is chosen by the runner.' },
        seed: { description: 'Optional seed. When set, the game restarts onto that seed before the bot runs.' }
      }
    }
  }
];

export const OBSERVATION = {
  type: 'object',
  description: 'Compact JSON observation returned by get_state and step.',
  properties: {
    version: { type: 'integer', const: 1 },
    drive: { type: 'string', enum: ['realtime', 'step'], description: 'realtime follows the display frame. step advances only when step() is called.' },
    tick: { type: 'integer', description: 'Fixed or realtime frames simulated since this page loaded.' },
    fixedDt: { type: 'number', description: 'Seconds per step() tick. 1/30.' },
    seed: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['loading', 'menu', 'run', 'pause', 'win'] },
    outcome: { type: ['string', 'null'], enum: ['cleared', 'failed', 'won', null], description: 'Set when a level ends. Cleared means the level was completed and the menu is now showing the next one. Stays until the next start or restart.' },
    levelsCleared: { type: 'integer', description: 'How many levels have been completed this run. 3 means the legend is finished.' },
    level: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: '0-based index of the level currently loaded.' },
        count: { type: 'integer' },
        name: { type: 'string' },
        story: { type: 'string' },
        terrain: { type: 'string' }
      }
    },
    objectives: {
      type: 'object',
      properties: {
        coins: { type: 'object', properties: { have: { type: 'integer' }, goal: { type: 'integer' }, done: { type: 'boolean' } } },
        wisdom: { type: 'object', properties: { have: { type: 'integer' }, goal: { type: 'integer' }, done: { type: 'boolean' } } },
        enemies: { type: 'object', properties: { spawned: { type: 'integer' }, target: { type: 'integer' }, alive: { type: 'integer' }, remaining: { type: 'integer' }, done: { type: 'boolean' } } },
        boss: { description: 'Null until Z, the gravitational fear, is on the field.' },
        portalOpen: { type: 'boolean' },
        ready: { type: 'boolean', description: 'True when the level completion conditions are already met.' }
      }
    },
    score: { type: 'integer' },
    lives: { type: 'integer' },
    timeLeft: { type: 'number', description: 'Seconds left on the level clock. Drains with world time, so Now-shift slows it.' },
    shift: {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
        meter: { type: 'number', description: '0..1. Full and not active means Now-shift is ready.' },
        cooldown: { type: 'number', description: 'Seconds of cooldown remaining.' }
      }
    },
    player: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        z: { type: 'number' },
        yaw: { type: 'number', description: 'Radians. 0 faces -Z. Positive turn_left increases yaw toward +X.' },
        heading: { type: 'object', properties: { x: { type: 'number' }, z: { type: 'number' } } },
        motion: { type: 'number', description: '0..1. Stickman inertia. An object in motion stays in motion: walk speed rises by up to 18% as this fills, and falls when you stop.' }
      }
    },
    aura: { type: ['string', 'null'], description: 'Space-separated aura names while inside a cast radius: Lift (Balloon), Vibration (Jeffery Bear), Shelter (Anti-Social), Consumed (the Alien).' },
    nearby: {
      type: 'object',
      description: 'Entities include world x,z and player-relative dx, dz, dist, and bearing. Bearing is signed radians; positive means the target is to the left (turn_left). Lists are sorted nearest first. Zs are living only. Pickups are uncollected.',
      properties: {
        enemies: { type: 'array', description: 'Each living Z. name is Z.' },
        pickups: { type: 'array', description: 'kind is coin, wisdom (a passion mark: love), or glitter. Glitter is not a goal. On the coin level it spends one held coin. Later it is only a distraction and a score loss.' },
        portal: { type: 'object' },
        npc: { description: 'The level guide. Coin, The Slave, or null. The full cast is nearby.cast.' },
        cast: { type: 'array', description: 'Every branded figure on the level: name, role (guide, lift, love, vibrate, shelter, consume), and pose.' },
        boss: {}
      }
    },
    subtitle: { type: 'string' },
    events: { type: 'array', description: 'Events since the previous get_state: coin, wisdom, glitter, enemy_down, hurt, boss_hit, boss_down, now_shift, consumed, level_cleared, level_failed, game_won.' },
    loadError: { type: ['string', 'null'] }
  }
};

export const MANIFEST = {
  name: 'temple-of-the-z',
  title: 'Legend of Now – Temple of Z',
  version: '1',
  description: 'Agent interface for the browser game Legend of Now – Temple of Z, aligned with the No Rest Group legend. The player is the Stickman. Fears are Zs. Plus Energy is the time power. Observe a compact world state, latch movement and combat actions, and advance a fixed timestep so a bot can play with no screen. Human keyboard, touch, and gamepad play is unchanged when agent and headless flags are off.',
  tickHz: TICK_HZ,
  fixedDt: FIXED_DT,
  browserGlobal: 'window.game',
  flags: {
    agent: 'Start in step mode. The simulation advances only via window.game.step(n). Rendering still runs so a person can watch.',
    headless: 'Step mode, plus skip drawing, shadows, bloom, and cosmetic particle updates. Character animation is reduced to gameplay timers. Use this for a bot with no screen.',
    seed: 'Seed coin, passion-mark, glitter, and Z-spawn randomness. Example: ?seed=1. Replay requires step mode (frame timing in realtime mode changes the spawn rolls).',
    bot: 'After load, run the built-in reference bot. Optional &levels=1 and &maxTicks=7000.'
  },
  methods: {
    ready: 'Promise resolved when models are loaded and the menu is up.',
    getState: 'Return the observation. Drains events.',
    listActions: 'Return the action catalog.',
    act: 'Apply a string action or a move object. Returns {ok, error?}.',
    step: 'step(n) simulates n ticks of fixedDt seconds and returns the observation. Switches to step mode.',
    setSeed: 'setSeed(seed, {restart}). Seed applies on the next level load.',
    setDrive: 'setDrive("realtime" | "step") gives the frame clock control again or takes it back.',
    manifest: 'This document.'
  },
  http: {
    manifest: 'GET /agent.json',
    state: 'GET /api/state',
    actions: 'GET /api/actions',
    act: 'POST /api/act  JSON string, {"action":"forward"}, or {"forward":1,"turn":0.2,"fire":true}',
    step: 'POST /api/step  {"n":10,"action":{"forward":1}}',
    seed: 'POST /api/seed  {"seed":1,"restart":true}',
    bot: 'POST /api/bot  {"levels":1,"maxTicks":7000}'
  },
  stdio: 'JSON lines on stdin: {"id":1,"method":"getState|act|step|listActions|setSeed|manifest|runBot","params":{}}. One JSON response line per request.',
  mcp: 'stdio JSON-RPC 2.0 (Content-Length framing or a single JSON line). tools/list returns the tools array. tools/call name is get_state, list_actions, act, step, set_seed, or run_bot.',
  actions: ACTIONS,
  tools: TOOLS,
  observation: OBSERVATION,
  coordinates: 'World XZ plane, Y is up and unused for movement. The Stickman starts at (0, 0) facing -Z (toward the temple). Pickup radius is about 1 on the ground. Touching a Z costs a life and throws that Z away. Zs tug the Stickman inward inside 5.2 units (Anti-Social cancels the tug). Three lives. Running out of lives or time fails the level. Wisdom objectives are passion marks. Glitter is not an objective.',
  levels: [
    { index: 0, name: 'I. Far, Far Away', coins: 10, wisdom: 0, enemies: 10, guide: 'Coin', time: 120 },
    { index: 1, name: 'II. The Path', coins: 0, wisdom: 6, enemies: 18, guide: 'The Slave', time: 110 },
    { index: 2, name: 'III. Beyond Yourself', coins: 0, wisdom: 0, enemies: 24, boss: 'Z', bossHp: 3, portal: true, time: 100 }
  ]
};
