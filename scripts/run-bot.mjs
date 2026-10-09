// Run the built-in reference bot in headless Chrome.
// Exit 0 when it clears --levels (default: the whole legend). Prints how far it got.
import { gameUrl, launchBrowser, openGame, startStaticServer } from './session.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

const levels = Number(arg('--levels', '3'));
const seed = arg('--seed', '1');
const maxTicks = Number(arg('--max-ticks', levels > 1 ? '16000' : '7000'));

const server = await startStaticServer();
const browser = await launchBrowser();
let result;
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await openGame(page, gameUrl(server.origin, { agent: true, headless: true, seed }));
  result = await page.evaluate(async ({ levels, maxTicks }) => {
    const mod = await import('./js/bot.js');
    return mod.runBot(window.game, { levels, maxTicks });
  }, { levels, maxTicks });
} finally {
  await browser.close();
  await server.close();
}

const cleared = result.levelsCleared;
console.log(JSON.stringify({
  ok: result.ok,
  reason: result.reason,
  levelsCleared: cleared,
  levelIndex: result.levelIndex,
  ticks: result.ticks,
  simSeconds: result.simSeconds,
  score: result.score,
  lives: result.lives,
  timeLeft: result.timeLeft,
  seed: result.seed,
  status: result.status,
  outcome: result.outcome
}, null, 2));
if (result.log && result.log.length) {
  console.log('trace:');
  for (const line of result.log.slice(-8)) console.log(' ', JSON.stringify(line));
}
if (!result.ok || cleared < levels) {
  console.error(`reference bot did not clear ${levels} level(s) (cleared ${cleared}, reason ${result.reason})`);
  process.exit(1);
}
console.log(`reference bot cleared ${cleared} level(s) in ${result.simSeconds}s of game time (${result.ticks} ticks, score ${result.score}, lives ${result.lives})`);
