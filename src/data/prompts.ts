import type { Challenge, Mode } from '../types';

export const SCENES: Challenge[] = [
  {
    id: 'sc1',
    title: 'The Stormy Beach',
    visual: '⛈️ 🌊 🏖️ 🌪️ 🦅',
    prompt:
      'A wild storm is crashing over a rocky beach. Giant waves slam the shore, lightning slices the sky, and the air tastes of salt.',
    questions: [
      'What sounds fill the air — waves, wind, thunder?',
      'What does the air feel and smell like on your skin?',
      'Describe the colors of the stormy sky.',
      'How would it feel to stand right there?',
    ],
    targetWords: [40, 80],
    skill: 'Sensory Layering',
  },
  {
    id: 'sc2',
    title: 'The Cozy Library',
    visual: '📚 🕯️ 🪑 ☕ 🌧️',
    prompt:
      'A small old library on a rainy afternoon. Books crowd every shelf, a fireplace crackles warmly, and someone left a half-finished cup of tea.',
    questions: [
      'What smells fill this room?',
      'What sounds do you hear — the rain, the fire, the pages?',
      'Describe how it feels to hold one of the old books.',
      'What kind of person would love this place?',
    ],
    targetWords: [40, 80],
    skill: 'Atmosphere',
  },
  {
    id: 'sc3',
    title: "The Dragon's Treasure Cave",
    visual: '🐉 💎 🔥 🪨 💰',
    prompt:
      'Deep inside a mountain, a massive dragon sleeps on a glittering pile of gold and jewels. The cave glows orange with firelight.',
    questions: [
      'Describe the dragon — its size, color, texture, smell.',
      'What does the gold and treasure look and feel like?',
      'What sounds echo through the cave?',
      'What would you feel stepping inside?',
    ],
    targetWords: [40, 80],
    skill: 'Character Description',
  },
  {
    id: 'sc4',
    title: 'The Mysterious Door',
    visual: '🌲 🚪 🌿 🌼 🦋',
    prompt:
      'Deep in an ancient forest, a sun-dappled clearing hides a secret: an old wooden door — with no walls around it at all.',
    questions: [
      'What does the light look like filtering through the trees?',
      'What sounds and smells fill the clearing?',
      'Describe every detail of the mysterious door.',
      'What feeling does this place give you?',
    ],
    targetWords: [40, 80],
    skill: 'Setting Description',
  },
  {
    id: 'sc5',
    title: 'The Night Market',
    visual: '🏮 🍜 🎭 🎵 🌙',
    prompt:
      'A glowing night market buzzes with life. Hundreds of lanterns light the stalls, vendors shout, food sizzles, and music drifts through the warm night air.',
    questions: [
      'Describe all the different smells mixing in the air.',
      'What colors and lights fill your vision?',
      'What sounds layer on top of each other?',
      'What would you eat first — and why?',
    ],
    targetWords: [40, 80],
    skill: 'Sensory Layering',
  },
  {
    id: 'sc6',
    title: 'The Coral Reef',
    visual: '🐠 🪸 🐙 🌊 🦈',
    prompt:
      "You're diving through a spectacular coral reef. Colorful fish dart between bright corals, and sunlight ripples down through the deep blue water.",
    questions: [
      'Describe the colors and movement you see.',
      'What does the water feel like all around you?',
      'Describe the sounds — or the silence — underwater.',
      'Pick one creature and describe it in detail.',
    ],
    targetWords: [40, 80],
    skill: 'Visual Description',
  },
  {
    id: 'sc7',
    title: 'The Treehouse at Sunset',
    visual: '🌅 🌳 🏡 🍂 🐦',
    prompt:
      'High in an ancient oak, a wooden treehouse sits as the sun melts into the horizon. The sky blazes orange and pink. Autumn leaves drift slowly past.',
    questions: [
      'Describe the sunset colors — be as specific as you can.',
      'What do the autumn leaves look, feel, and sound like?',
      'What details can you see on the treehouse itself?',
      'What would it feel like to sit up there right now?',
    ],
    targetWords: [40, 80],
    skill: 'Color & Light',
  },
  {
    id: 'sc8',
    title: 'The Night Launch',
    visual: '🚀 🌌 🔥 🌍 ⭐',
    prompt:
      'A rocket blazes off its launchpad into the night sky, trailing a column of white fire and smoke. A crowd below watches in stunned silence.',
    questions: [
      'Describe the fire and smoke from the engines.',
      'What sounds shake the ground and the air?',
      'Describe the crowd — what do their faces and bodies do?',
      'Describe the rocket getting smaller as it climbs.',
    ],
    targetWords: [40, 80],
    skill: 'Action & Movement',
  },
  {
    id: 'sc9',
    title: 'The Frozen Kingdom',
    visual: '🏔️ ❄️ 🦌 🌨️ 🏰',
    prompt:
      'A kingdom locked in deep winter. Snow blankets every rooftop. Icicles hang from the castle towers. A lone reindeer watches from the frozen forest edge.',
    questions: [
      'Describe how the snow looks — its color, texture, and depth.',
      'What sounds fill a snow-covered world?',
      'Describe the feeling of the cold on your face and hands.',
      'What makes this place feel magical rather than just cold?',
    ],
    targetWords: [40, 80],
    skill: 'Winter Atmosphere',
  },
  {
    id: 'sc10',
    title: 'The Giant Aquarium',
    visual: '🦑 🐳 🐡 🌊 💙',
    prompt:
      "You're standing in front of the biggest aquarium tank you've ever seen. A whale glides past slowly, just inches from the glass.",
    questions: [
      'Describe the whale — its size, color, the way it moves.',
      'What does the water and light look like from this side of the glass?',
      'What sounds do you hear inside the aquarium building?',
      'Describe how small you feel standing there.',
    ],
    targetWords: [40, 80],
    skill: 'Scale & Wonder',
  },
];

export const STORY_STARTERS: Challenge[] = [
  {
    id: 'st1',
    title: 'The Lighthouse Secret',
    prompt:
      'The old lighthouse had been dark for fifty years. Then, one stormy night, Maya saw a flicker of light from the top window…',
    questions: [
      'What does Maya do next?',
      'Use a strong action verb to show how she moves.',
      'Describe something unexpected she discovers.',
      'End with a surprise or a question that leaves the reader wanting more.',
    ],
    targetWords: [60, 110],
    skill: 'Building Tension',
  },
  {
    id: 'st2',
    title: 'The Floating Room',
    prompt:
      'Sam woke up to find everything in their room floating six inches off the floor — books, shoes, their backpack, and even the sleeping cat…',
    questions: [
      'How does Sam feel? Show it through what their body does — not just words like "scared."',
      'Describe one specific floating object in detail.',
      'What does Sam do to try to understand what happened?',
      'Keep the tone surprising and a little funny.',
    ],
    targetWords: [60, 110],
    skill: 'Voice & Tone',
  },
  {
    id: 'st3',
    title: "The Map That Shouldn't Exist",
    prompt:
      "Ethan found the map tucked inside a library book that hadn't been checked out since 1987. It showed a place that shouldn't exist…",
    questions: [
      'Describe what the map looks like — every detail.',
      'What is the impossible place it shows?',
      'What does Ethan decide to do?',
      'Use a strong verb for how Ethan reacts.',
    ],
    targetWords: [60, 110],
    skill: 'Mystery & Discovery',
  },
  {
    id: 'st4',
    title: 'The Dragon Egg',
    prompt:
      'The dragon egg cracked on a Tuesday morning, right in the middle of breakfast. It had been sitting on the kitchen counter for three weeks, and everyone had agreed it was probably just a very large rock…',
    questions: [
      'Describe the hatching — the sounds, smells, movements.',
      'What does the baby dragon look like?',
      'How do the people at breakfast react? Be specific — what do they do with their hands, their faces?',
      'What happens in the next ten seconds?',
    ],
    targetWords: [60, 110],
    skill: 'Descriptive Action',
  },
  {
    id: 'st5',
    title: 'The Wrong Door',
    prompt:
      "There was a door in the school basement that wasn't on any blueprint. The caretaker had worked there twenty-two years and never noticed it — until the Monday it appeared with a handwritten note taped to it…",
    questions: [
      'What does the note say?',
      'Describe the door itself in careful detail.',
      'Does someone open it? What do they find?',
      'Build suspense — slow down the moment and make the reader hold their breath.',
    ],
    targetWords: [60, 110],
    skill: 'Suspense Writing',
  },
  {
    id: 'st6',
    title: 'The Waiting Robot',
    prompt:
      'The robot sat alone in the rain, waiting. It had been waiting for three hundred years. Today, finally, someone was coming…',
    questions: [
      'Describe the robot — what does it look like after 300 years of rain?',
      'What has it been waiting for all this time?',
      'Describe the person approaching.',
      'Show what the robot feels through its actions — not just the word "happy" or "excited."',
    ],
    targetWords: [60, 110],
    skill: 'Emotion Through Action',
  },
  {
    id: 'st7',
    title: 'The Submarine in the Desert',
    prompt:
      "The submarine surfaced in the middle of a desert. That was the first problem. The second problem was that the hatch wouldn't open from the inside…",
    questions: [
      'Describe how a submarine looks sitting in the middle of sand and rock.',
      'Who is inside? How do they react to what they see through the porthole?',
      'How do they try to solve the problem?',
      'Keep the tone adventurous and a little bit funny.',
    ],
    targetWords: [60, 110],
    skill: 'Humor & Voice',
  },
  {
    id: 'st8',
    title: 'The Painting That Watches',
    prompt:
      "It wasn't until they were halfway through restoring the old painting that they realized the figure in it had changed position since yesterday…",
    questions: [
      'Describe the painting — what is in it? How old does it look?',
      'How do they notice that something has changed?',
      'Build unease without using the words "scared," "frightened," or "terrified."',
      'What do they do next?',
    ],
    targetWords: [60, 110],
    skill: "Show Don't Tell",
  },
];

export const MYSTERY_OBJECTS: Challenge[] = [
  {
    id: 'my1',
    title: 'Mystery Challenge #1',
    answer: 'a candle',
    hint: 'It gives something beautiful and warm. It uses itself up slowly. It has a voice of its own.',
    prompt:
      'It gives something beautiful and warm. It uses itself up slowly. It has a voice of its own — describe it perfectly without naming it.',
    questions: [
      'Describe what it looks like — every detail.',
      'What does it give to the room around it?',
      'What sounds and smells does it create?',
      'What happens when it is finally finished?',
    ],
    targetWords: [30, 65],
    skill: 'Precision Description',
  },
  {
    id: 'my2',
    title: 'Mystery Challenge #2',
    answer: 'a thunderstorm',
    hint: 'It is enormous and powerful. It comes from above. It transforms everything it touches.',
    prompt:
      'It is enormous and powerful. It comes from above. It transforms everything it touches — describe it without naming it.',
    questions: [
      'Describe how it arrives — what are the first warning signs?',
      'What sounds does it make? Be specific.',
      'How does it feel on your skin and in the air before, during, and after?',
      'How does it leave?',
    ],
    targetWords: [30, 65],
    skill: 'Weather & Power',
  },
  {
    id: 'my3',
    title: 'Mystery Challenge #3',
    answer: 'a very old book',
    hint: 'It has been touched by many hands across many years. It holds entire worlds inside it.',
    prompt:
      'It has been touched by many hands across many years. It holds entire worlds inside it — describe it without naming it.',
    questions: [
      'Describe what it looks and feels like on the outside.',
      'What does it smell like?',
      'What sounds does it make?',
      'Describe its age — without using the word "old."',
    ],
    targetWords: [30, 65],
    skill: 'Detailed Observation',
  },
  {
    id: 'my4',
    title: 'Mystery Challenge #4',
    answer: 'the ocean',
    hint: 'It is enormous. It is always moving. It has many moods.',
    prompt:
      'It is enormous. It is always moving. It has many moods — describe it without naming it.',
    questions: [
      'Describe its surface at a specific time of day.',
      'What sounds does it make?',
      'What does it smell like? What does the air taste like near it?',
      'Describe its power — without naming it.',
    ],
    targetWords: [30, 65],
    skill: 'Scale & Power',
  },
  {
    id: 'my5',
    title: 'Mystery Challenge #5',
    answer: 'a sleeping cat',
    hint: 'It is small, warm, and completely unbothered by the world.',
    prompt:
      'It is small, warm, and completely unbothered by the world — describe it without naming it.',
    questions: [
      'Describe its body and how it is positioned.',
      'What sounds does it make?',
      'What does it feel like to gently touch it?',
      'Describe its personality through the way it sleeps.',
    ],
    targetWords: [30, 65],
    skill: 'Character Through Detail',
  },
  {
    id: 'my6',
    title: 'Mystery Challenge #6',
    answer: 'snow',
    hint: 'It transforms everything it touches. It arrives silently.',
    prompt:
      'It transforms everything it touches. It arrives silently — describe it without naming it.',
    questions: [
      'Describe what the world looks like once it has arrived.',
      'What does it sound like underfoot?',
      'What does it feel like in your bare hands?',
      'Describe how it changes the world around it.',
    ],
    targetWords: [30, 65],
    skill: 'Transformation',
  },
  {
    id: 'my7',
    title: 'Mystery Challenge #7',
    answer: 'a birthday cake',
    hint: 'It is made with love. It is beautiful for a moment and then it disappears.',
    prompt:
      'It is made with love. It is beautiful for a moment and then it disappears — describe it without naming it.',
    questions: [
      'Describe how it looks — every layer, color, and decoration.',
      'What does it smell like when it arrives in the room?',
      'Describe the moment it is presented — the sounds, the light, the feeling.',
      'What happens next?',
    ],
    targetWords: [30, 65],
    skill: 'Celebration & Mood',
  },
  {
    id: 'my8',
    title: 'Mystery Challenge #8',
    answer: 'a campfire',
    hint: 'It draws people close. It tells stories in light and shadow.',
    prompt:
      'It draws people close. It tells stories in light and shadow — describe it without naming it.',
    questions: [
      'Describe what it looks like — the colors, the movement, the shape.',
      'What sounds does it make?',
      'What does it feel and smell like from nearby?',
      'Why do people always seem to gather around it?',
    ],
    targetWords: [30, 65],
    skill: 'Warmth & Atmosphere',
  },
];

export const UPGRADES: Challenge[] = [
  {
    id: 'up1',
    title: 'Upgrade This Sentence',
    original: 'The dog ran across the yard.',
    hint: 'How exactly did it run? What kind of dog? What did the yard look, smell, or feel like?',
    prompt:
      'Rewrite the boring sentence to make it vivid. How exactly did it run? What kind of dog? What did the yard look, smell, or feel like?',
    targetWords: [15, 40],
    skill: 'Vivid Verbs',
  },
  {
    id: 'up2',
    title: 'Upgrade This Sentence',
    original: 'She was scared.',
    hint: 'SHOW her fear — what does her body do? What does she see, hear, or feel?',
    prompt:
      'Rewrite the boring sentence — show her fear instead of telling. What does her body do? What does she see, hear, or feel?',
    targetWords: [15, 40],
    skill: "Show Don't Tell",
  },
  {
    id: 'up3',
    title: 'Upgrade This Sentence',
    original: 'It was a big storm.',
    hint: 'How big? What did it look, sound, and feel like? What did it do?',
    prompt:
      'Rewrite the boring sentence. How big? What did it look, sound, and feel like? What did it do?',
    targetWords: [15, 40],
    skill: 'Strong Adjectives',
  },
  {
    id: 'up4',
    title: 'Upgrade This Sentence',
    original: 'The food was good.',
    hint: 'What food? What made it good? Use taste and smell words.',
    prompt:
      'Rewrite the boring sentence. What food? What made it good? Use taste and smell words.',
    targetWords: [15, 40],
    skill: 'Sensory Detail',
  },
  {
    id: 'up5',
    title: 'Upgrade This Sentence',
    original: 'He walked into the room.',
    hint: 'How did he walk? What was the room like? What was the mood?',
    prompt:
      'Rewrite the boring sentence. How did he walk? What was the room like? What was the mood?',
    targetWords: [15, 40],
    skill: 'Mood & Movement',
  },
  {
    id: 'up6',
    title: 'Upgrade This Sentence',
    original: 'The tree was old.',
    hint: 'Show its age through details — bark, roots, size, what lives in it.',
    prompt:
      'Rewrite the boring sentence. Show its age through details — bark, roots, size, what lives in it.',
    targetWords: [15, 40],
    skill: 'Showing Not Telling',
  },
  {
    id: 'up7',
    title: 'Upgrade This Sentence',
    original: 'The music was nice.',
    hint: 'What instrument? What did it sound like? What feeling did it create?',
    prompt:
      'Rewrite the boring sentence. What instrument? What did it sound like? What feeling did it create?',
    targetWords: [15, 40],
    skill: 'Sound Description',
  },
  {
    id: 'up8',
    title: 'Upgrade This Sentence',
    original: 'The night was dark.',
    hint: 'What kind of dark? What could you barely see? What sounds filled it?',
    prompt:
      'Rewrite the boring sentence. What kind of dark? What could you barely see? What sounds filled it?',
    targetWords: [15, 40],
    skill: 'Atmosphere',
  },
];

export const POOLS: Record<Mode, Challenge[]> = {
  scene: SCENES,
  story: STORY_STARTERS,
  mystery: MYSTERY_OBJECTS,
  upgrade: UPGRADES,
};

export const MODE_META: Record<
  Mode,
  { label: string; tagline: string; icon: 'Eye' | 'BookOpen' | 'Wand' | 'Pen'; skill: string }
> = {
  scene: { label: 'Scene', tagline: 'Bring a place to life with vivid, sensory detail.', icon: 'Eye', skill: 'Descriptive Writing' },
  story: { label: 'Story', tagline: 'A story has begun. Only you can finish it.', icon: 'BookOpen', skill: 'Creative Writing' },
  mystery: { label: 'Mystery', tagline: 'Describe something without naming it. Can the reader guess?', icon: 'Wand', skill: 'Precision Writing' },
  upgrade: { label: 'Upgrade', tagline: 'Take a boring sentence and make it AMAZING.', icon: 'Pen', skill: 'Word Power' },
};

export function getChallenge(mode: Mode, id: string): Challenge | undefined {
  return POOLS[mode].find((c) => c.id === id);
}
