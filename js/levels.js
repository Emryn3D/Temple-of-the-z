// Level data: goals, terrain, day/night palettes, cast placements and dialogue.
// Palette keys are sampled across each level's timer (dawn -> noon -> dusk -> night);
// `nightAmount` is how far into that arc the level travels before time runs out.
export const LEVELS = [
  {
    name: 'I. The Dunes of Now',
    story: 'You awaken in the Now: a vast living desert outside the Temple. Recover 10 relic coins to remember your path.',
    palette: {
      dawn:  { fog: 0xf0cf9a, sky: 0xffd9a0 },
      noon:  { fog: 0xceb98f, sky: 0xa8d2ff },
      dusk:  { fog: 0xd89a6a, sky: 0xff9a55 },
      night: { fog: 0x4a4257, sky: 0x1c2238 }
    },
    fogRange: [30, 190],
    nightAmount: 0.55,
    windSpeed: 1.6,
    sandOpacity: 0.45,
    enemyTarget: 10, coinGoal: 10, wisdomGoal: 0, time: 120, terrain: 'dunes',
    npc: {
      name: 'Sera of the Dunes',
      model: 'xbot',
      tint: 0xd9a64f, emissive: 0x442d08,
      pos: [6, 0, -20],
      emote: 'agree',
      lines: [
        'Sera: You are awake, wanderer. The Now is a desert that remembers.',
        'Sera: Gather the relic coins — each one is a moment you lost.',
        'Sera: The black chasers are yesterdays. Do not let them touch you.'
      ]
    }
  },
  {
    name: 'II. Pilgrim Road',
    story: 'The colonnade to the Temple is guarded. Collect 6 wisdom crystals and survive the black chasers.',
    palette: {
      dawn:  { fog: 0xc3cede, sky: 0xd9b890 },
      noon:  { fog: 0xaebdcf, sky: 0x8fb4e8 },
      dusk:  { fog: 0xb88f7a, sky: 0xd97f4d },
      night: { fog: 0x39405a, sky: 0x121a30 }
    },
    fogRange: [25, 170],
    nightAmount: 0.75,
    windSpeed: 2.2,
    sandOpacity: 0.3,
    enemyTarget: 18, coinGoal: 0, wisdomGoal: 6, time: 110, terrain: 'road',
    npc: {
      name: 'Kahl the Pilgrim',
      model: 'soldier',
      tint: 0x7d93b5, emissive: 0x101a2c,
      pos: [6.2, 0, -34],
      emote: null,
      lines: [
        'Kahl: I have walked this road for nine lifetimes, friend.',
        'Kahl: The columns count your steps. The chasers count your doubts.',
        'Kahl: Wisdom burns violet. Carry six shards and the road will end.'
      ]
    }
  },
  {
    name: 'III. Temple Threshold',
    story: 'Night falls at the threshold. Clear the chasers, bring down the Guardian, and walk into the Z portal to finish the legend.',
    palette: {
      dawn:  { fog: 0xb9a98c, sky: 0xc69973 },
      noon:  { fog: 0x96a8bc, sky: 0x7d9cd1 },
      dusk:  { fog: 0x8a6a6e, sky: 0xb35a3e },
      night: { fog: 0x232b40, sky: 0x080d1c }
    },
    fogRange: [22, 150],
    nightAmount: 1.0,
    windSpeed: 3.0,
    sandOpacity: 0.22,
    enemyTarget: 24, coinGoal: 0, wisdomGoal: 0, time: 100, terrain: 'temple',
    npc: null,
    boss: {
      name: 'The Threshold Guardian',
      model: 'soldier',
      tint: 0xd4af37, emissive: 0x3a2c05, metalness: 0.8, roughness: 0.35,
      scale: 1.8, hp: 3, speed: 2.4,
      pos: [0, 0, -120],
      line: 'The Guardian wakes. Three true strikes will open the way.'
    },
    zFigure: {
      name: 'Z',
      model: 'xbot'
    }
  }
];
