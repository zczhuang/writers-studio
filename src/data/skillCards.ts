import type { JudgeBreakdown } from '../types';

/**
 * Craft Skill Cards — short, kid-friendly lessons that each teach ONE craft
 * technique drawn from a great writer, mapped to one of the five grading
 * dimensions. Cards are browsable in the Craft Library and the writer-memory
 * recommends one at a time, targeting the writer's weakest dimension.
 *
 * Copyright stance (this is a kids' product, so it matters):
 *  - `classic` cards may quote SHORT public-domain excerpts (pre-1929 US, or
 *    works confirmed public-domain) and name the work.
 *  - `contemporary` cards teach the technique in our OWN words with ORIGINAL
 *    examples — never reproducing copyrighted text — and usually omit `work`.
 *  - `verified` is true only where the author↔technique attribution was
 *    fact-checked. Where it could not be confirmed, wording is softened and
 *    `verified` is false.
 */

export type SkillSource = 'classic' | 'contemporary';

/** How the micro-drill is practiced (drives the drill UI; all fall back to free text). */
export type DrillKind = 'imitate' | 'expand' | 'freewrite';

export interface SkillCard {
  id: string;
  title: string;
  /** Which of the five grading dimensions this card builds. */
  dimension: keyof JudgeBreakdown;
  source: SkillSource;
  /** The writer the technique is associated with (or "Many writers" when it's shared craft). */
  author: string;
  /** Public-domain work the excerpt is drawn from; omitted for technique-only contemporary cards. */
  work?: string;
  /** True only when the author↔technique attribution was fact-checked and confirmed. */
  verified: boolean;
  /** Kid-friendly explanation of the technique and where it comes from. No long copyrighted text. */
  mentorNote: string;
  /** A short before→after or public-domain excerpt that models the technique. */
  example: string;
  /** One-line practice challenge. */
  microDrill: string;
  drill: DrillKind;
}

export const SKILL_CARDS: SkillCard[] = [
  {
    id: 'voice-vernacular-twain',
    title: 'Talk Like Your Character',
    dimension: 'voice',
    source: 'classic',
    author: 'Mark Twain',
    work: 'The Adventures of Huckleberry Finn (1884)',
    verified: true,
    mentorNote:
      "Mark Twain wrote Huckleberry Finn in Huck's own messy, country-kid way of talking — not 'proper' English. Because of HOW Huck talks, you instantly know exactly who he is. Your narrator's voice can do the same job.",
    example:
      "Original: 'I went to the store.' → In a pirate's voice: 'Arr, I went lurchin' down to that there shop, grumblin' the whole soggy way.'",
    microDrill:
      "Rewrite one plain sentence ('I went to the store') in a specific character's voice — a grumpy pirate, a hyper little kid — using their slang and rhythm.",
    drill: 'imitate',
  },
  {
    id: 'structure-anaphora-dickens',
    title: 'The Drumbeat Word',
    dimension: 'structure',
    source: 'classic',
    author: 'Charles Dickens',
    work: 'Bleak House (1853)',
    verified: true,
    mentorNote:
      "At the start of Bleak House, Charles Dickens repeats one word — 'Fog' — over and over, fog here, fog there, fog everywhere, until you can barely see. Repeating one word like a drumbeat makes a single feeling flood the whole page.",
    example:
      'Fog up the river. Fog down the river. Fog creeping into the cabins. Fog in the eyes of the old skipper. (Charles Dickens, Bleak House, 1853 — public domain)',
    microDrill:
      'Pick a feeling-word (rain, noise, dust, cold) and write 4 short lines that each START with it, spreading it across your scene.',
    drill: 'imitate',
  },
  {
    id: 'imagery-strong-verbs-london',
    title: 'Muscle Verbs',
    dimension: 'imagery',
    source: 'classic',
    author: 'Jack London',
    work: 'The Call of the Wild (1903)',
    verified: true,
    mentorNote:
      "In The Call of the Wild, Jack London never says a dog just 'moved.' It 'sprang,' it 'shook,' it 'plunged.' And he repeats one sense — cold — so many times you start shivering. Strong, exact verbs put the reader inside the body of the scene.",
    example:
      "Weak: 'The dog went through the snow and was cold.' → Strong: 'The dog plunged through the snow; the cold bit deep, the cold gnawed, the cold would not let go.'",
    microDrill:
      "Take a sentence with a weak verb (was, went, looked) and swap in one strong, specific verb — then add a sensory word you'll repeat in the next line.",
    drill: 'imitate',
  },
  {
    id: 'voice-suspense-poe',
    title: 'Short. Sharp. Scared.',
    dimension: 'voice',
    source: 'classic',
    author: 'Edgar Allan Poe',
    work: 'The Tell-Tale Heart (1843)',
    verified: true,
    mentorNote:
      "In The Tell-Tale Heart, Edgar Allan Poe's narrator keeps insisting 'I'm NOT mad!' — which makes you sure he is. And his sentences get short. And fast. And nervous. Clipped sentences make a reader's pulse race.",
    example: 'I am perfectly calm. Nothing happened here. Nothing at all. I am calm. Listen. I am calm.',
    microDrill:
      'Write 3 sentences where a narrator nervously swears nothing is wrong — make each sentence SHORTER than the one before.',
    drill: 'imitate',
  },
  {
    id: 'imagery-show-detail-doyle',
    title: "The Detective's Eye",
    dimension: 'imagery',
    source: 'classic',
    author: 'Arthur Conan Doyle',
    work: 'The Sherlock Holmes stories',
    verified: true,
    mentorNote:
      "Sherlock Holmes, by Arthur Conan Doyle, never says 'this man is a sailor.' He notices a tattoo, a sun-tan, the roll in the walk — and lets YOU figure it out. Tiny exact details convince a reader far more than a big flat claim. (All Holmes stories entered the public domain in 2023.)",
    example:
      "Telling: 'She was nervous.' → Showing: 'She gnawed a thumbnail, jiggled one heel against the chair leg, and kept glancing at the door.'",
    microDrill:
      "Instead of writing 'she was nervous,' name 3 tiny specific things she does and let the reader conclude it.",
    drill: 'imitate',
  },
  {
    id: 'structure-cliffhanger-verne',
    title: 'Cut on the Cliff',
    dimension: 'structure',
    source: 'classic',
    author: 'Jules Verne',
    work: 'Journey to the Center of the Earth (1864)',
    verified: true,
    mentorNote:
      'Jules Verne ends a chapter of Journey to the Center of the Earth right as the sea drags the raft toward a black abyss — and STOPS. Now you HAVE to read on. Cut your scene at the scariest second, not after everything is safe again.',
    example: 'The rope creaked once. Then, with a sound like a snapping bone, it gave way — (stop here)',
    microDrill:
      'Write the last 2 sentences of a scene that end on a sudden danger or an open question — then stop before you answer it.',
    drill: 'imitate',
  },
  {
    id: 'structure-rule-of-three-grimm',
    title: 'The Power of Three',
    dimension: 'structure',
    source: 'classic',
    author: 'The Brothers Grimm',
    work: "Grimm's Fairy Tales (from 1812)",
    verified: true,
    mentorNote:
      'The Brothers Grimm fairy tales love threes: three bears, three tasks, three tries. The third one is always the big payoff. Patterns of three feel complete and satisfying — and the build-up makes readers lean in.',
    example: 'The first knock, no answer. The second knock, a creak inside. The third knock — the door swung open on its own.',
    microDrill:
      'Write a story beat in three steps where the first two build up or fail and the THIRD is the surprise or the win.',
    drill: 'imitate',
  },
  {
    id: 'originality-hooks-openings',
    title: 'First-Line Doors',
    dimension: 'originality',
    source: 'classic',
    author: 'Herman Melville',
    work: 'Moby-Dick (1851)',
    verified: true,
    mentorNote:
      "Great books grab you in one sentence. Herman Melville opens Moby-Dick with 'Call me Ishmael' — three words and you NEED to know who he is. A first line is a door; make the reader want to walk through it.",
    example:
      "Blunt fact: 'The cat was on fire, and no one seemed surprised.' / Bold claim: 'I have never once told the truth.' / Mystery: 'The thirteenth step was not there yesterday.'",
    microDrill:
      'Write 3 different first lines for your story: one a blunt fact, one a bold claim, one a tiny mystery. Keep the one that makes YOU most curious.',
    drill: 'freewrite',
  },
  {
    id: 'imagery-show-dont-tell-chekhov',
    title: 'Show the Glint, Not the Moon',
    dimension: 'imagery',
    source: 'classic',
    author: 'Anton Chekhov',
    verified: true,
    mentorNote:
      "Anton Chekhov (whose work is public domain) said: don't tell me the moon is shining — show me the glint of light on broken glass. Don't write 'he was nervous'; show his knee bouncing and his pencil chewed to splinters. Let the reader feel it for themselves.",
    example: "Telling: 'She was angry.' → Showing: 'She set the cup down so hard the tea jumped over the rim.'",
    microDrill:
      "Take one 'telling' feeling sentence ('She was angry') and rewrite it as an action or detail that SHOWS it.",
    drill: 'imitate',
  },
  {
    id: 'vocabulary-adverb-hunt-king',
    title: 'Hunt the -ly Words',
    dimension: 'vocabulary',
    source: 'contemporary',
    author: 'Stephen King',
    verified: true,
    mentorNote:
      "Stephen King says adverbs — those -ly words like 'quickly' and 'loudly' — are weeds in your writing. Instead of 'said loudly,' one strong verb, 'shouted,' does the whole job. Strong verbs are the engine of a sentence. (We teach his idea in our own words.)",
    example: "Weak: 'She ran quickly and shut the door loudly.' → Strong: 'She sprinted and slammed the door.'",
    microDrill:
      'Find every -ly adverb in a paragraph, delete it, and replace the verb with one stronger verb that already carries the meaning.',
    drill: 'imitate',
  },
  {
    id: 'imagery-sensory-list-bradbury',
    title: 'The Five-Sense Sweep',
    dimension: 'imagery',
    source: 'contemporary',
    author: 'Ray Bradbury',
    verified: true,
    mentorNote:
      "Ray Bradbury jump-started stories by scribbling lists of vivid nouns. You can too: before you describe a place, quickly list what you'd SEE, HEAR, SMELL, FEEL, and TASTE there — then sprinkle the best three in, so readers feel they're standing inside it.",
    example:
      "See: flickering neon. Hear: sizzling oil. Smell: burnt sugar. Feel: sticky heat. Taste: salt on the air. → 'Neon flickered over the stall while oil sizzled and the air went sticky with burnt sugar.'",
    microDrill:
      'Pick your scene\'s setting and list one detail for each of the 5 senses, then use at least 3 of them in a sentence.',
    drill: 'expand',
  },
  {
    id: 'originality-gobblefunk-dahl',
    title: 'Invent a Word',
    dimension: 'originality',
    source: 'contemporary',
    author: 'Roald Dahl',
    verified: true,
    mentorNote:
      'Roald Dahl invented hundreds of words by playing two games: BLEND two real words into one, or SWAP the first sounds of two words. Coin a word nobody\'s ever read and your writing is instantly one-of-a-kind. (Make up your OWN — don\'t borrow Dahl\'s.)',
    example: "Blend: gulp + gigantic = a 'gulpantic' swallow. Sound-swap: 'a brilliant day' → 'a drilliant bay.'",
    microDrill: 'Blend two real words into one brand-new word (or swap their first sounds) and use it in a sentence.',
    drill: 'imitate',
  },
  {
    id: 'structure-vary-length-provost',
    title: 'Make It Sing',
    dimension: 'structure',
    source: 'contemporary',
    author: 'Gary Provost',
    verified: true,
    mentorNote:
      'Gary Provost showed that if every sentence is the same length, writing sounds like a robot beeping. Mix a short, punchy sentence with a long, flowing one and the prose turns into music. Use a short sentence to hit hard. Then let a longer one breathe and build.',
    example:
      "It was over. The room sat silent in the gray afternoon light. And somewhere far below the window, a single car alarm wailed on and on, as if it hadn't heard the news.",
    microDrill: 'Write 3 sentences in a row on purpose: one about 4 words, one medium, one long (15+ words).',
    drill: 'imitate',
  },
  {
    id: 'originality-fresh-simile',
    title: 'Kill the Tired Simile',
    dimension: 'originality',
    source: 'contemporary',
    author: 'Many writers',
    verified: false,
    mentorNote:
      "A simile everyone's heard — 'quiet as a mouse,' 'cold as ice' — is invisible; readers skim right past it. Invent a comparison nobody's used, and even better, make it fit your story's world. This is a technique many writers teach, not one person's invention.",
    example:
      "Cliche: 'quiet as a mouse.' → Fresh: 'quiet as a phone with the ringer off.' In a bakery scene: 'he puffed up like an over-proofed loaf.'",
    microDrill: 'Take a cliche simile and rewrite it with a fresh, surprising comparison of your own.',
    drill: 'imitate',
  },
];

const BY_ID: Record<string, SkillCard> = Object.fromEntries(SKILL_CARDS.map((c) => [c.id, c]));

export function getSkillCard(id: string): SkillCard | undefined {
  return BY_ID[id];
}

export function getCardsForDimension(dimension: keyof JudgeBreakdown): SkillCard[] {
  return SKILL_CARDS.filter((c) => c.dimension === dimension);
}
