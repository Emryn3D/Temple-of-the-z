// Level data from the No Rest Group legend (norestgroup.com): the land far away,
// the coins you must not spend, the Zs that pull, and the walk beyond yourself.
// Palette keys are sampled across each level's timer (dawn -> noon -> dusk -> night).
export const LEVELS = [
  {
    name: 'I. Far, Far Away',
    story: 'Far away, the world runs on power and spending. Hold 10 coins. What glitters spends them, and then you have less. The Zs are fear pulling you back. Throw the fear away, and keep moving.',
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
    cast: [
      {
        name: 'Coin',
        role: 'guide',
        mascot: 'coin',
        tint: 0xf0c247, emissive: 0x6a4a08,
        pos: [6, 0, -20],
        lines: [
          'Coin: Far from here, everything is driven by power.',
          'Coin: They say every problem comes from spending. The more you spend, the less you have.',
          'Coin: So hold these. Glitter will spend them. The pull on you is fear. Throw that Z away.'
        ]
      },
      {
        name: 'Balloon',
        role: 'lift',
        mascot: 'balloon',
        tint: 0xff4fa3, emissive: 0x661133,
        pos: [-8, 0, -36],
        radius: 4.5,
        lines: [
          'Balloon: There is an energy that cannot be bought. A plus. It comes from within.',
          'Balloon: When your vibration gives you lift, you are already that energy. An object in motion stays in motion.'
        ]
      }
    ]
  },
  {
    name: 'II. The Path',
    story: 'The enterprise says do whatever it takes for them. That path is lost in distraction. The only happiness is love and passion: carry 6 marks through it. The lift you need cannot be bought.',
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
    cast: [
      {
        name: 'The Slave',
        role: 'guide',
        model: 'xbot',
        chains: true,
        tint: 0x8d735c, emissive: 0x2a1c12,
        pos: [6.2, 0, -28],
        lines: [
          'The Slave: Humanity is bred into this. Born into an enterprise.',
          'The Slave: When the masters call, they say do whatever it takes. I did. The chain stayed.',
          'The Slave: Whatever it takes is not for them. Walk past this road.'
        ]
      },
      {
        name: 'Smiley',
        role: 'love',
        mascot: 'smiley',
        tint: 0xf4d444, emissive: 0x665500,
        pos: [-6.2, 0, -52],
        lines: [
          'Smiley: The path to happiness is lost in distraction. These Zs are that distraction.',
          'Smiley: The only happiness is love and passion. Not the enterprise. Not the spend.',
          'Smiley: Carry six hearts. Love is how you get through what they asked of you.'
        ]
      },
      {
        name: 'Jeffery Bear',
        role: 'vibrate',
        mascot: 'bear',
        tint: 0x8a5a32, emissive: 0x3a2414,
        pos: [7.4, 0, -78],
        radius: 5,
        lines: [
          'Jeffery Bear: I am not for sale. Limitless energy. A playful spirit.',
          'Jeffery Bear: I travel the universe and lift the vibration around me. Stay close. This was never bought.'
        ]
      }
    ]
  },
  {
    name: 'III. Beyond Yourself',
    story: 'The Zs will always exist. Throw one away anyway. Do not feed the thing that consumes your force. Then walk through as yourself. It is your movie. Go beyond yourself.',
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
    cast: [
      {
        name: 'Anti-Social',
        role: 'shelter',
        model: 'xbot',
        tint: 0x2a2a30, emissive: 0x101014,
        pos: [-8, 0, -42],
        radius: 5,
        lines: [
          'Anti-Social: They will say you are crazy. Likes or no likes.',
          'Anti-Social: Real. Authentic. Never pretend. Stand here and the fears cannot pull you. It is your movie.'
        ]
      },
      {
        name: 'The Alien',
        role: 'consume',
        mascot: 'alien',
        tint: 0xb7b7c8, emissive: 0x2a3344,
        pos: [14, 0, -72],
        radius: 8,
        talk: 7,
        lines: [
          'The Alien: I consume the force. Whatever was borrowed, I eat.',
          'The Alien: What is inside you I cannot keep. Go around. Do not feed me your Plus Energy.'
        ]
      }
    ],
    boss: {
      name: 'Z',
      mascot: 'z',
      tint: 0xf0c247, emissive: 0x6a4a08,
      scale: 2.35, hp: 3, speed: 2.4,
      pos: [0, 0, -120],
      line: 'Z: I will always exist. I am the weight of your fear. Throw me away anyway.'
    },
    finale: {
      name: 'You',
      mascot: 'stickman',
      tint: 0xfff4c4, emissive: 0x8a6a10,
      line: 'Your name here, in the Legend of Now. Their story ends. Rewrite it. Go. Beyond yourself.'
    }
  }
];
