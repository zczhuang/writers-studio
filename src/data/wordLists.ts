/** Sensory words categorized by sense for "spread" bonuses. */
export const SENSORY_BY_SENSE = {
  sight: [
    'gleaming','shimmering','vivid','glowing','blazing','flickering','sparkling','dazzling',
    'shadowy','murky','luminous','radiant','glittering','hazy','brilliant','dim','pale','deep',
    'towering','looming','rippling','swirling','spiraling','cascading','drifting','tumbling',
    'colorful','crimson','scarlet','golden','silver','bronze','violet','indigo','turquoise',
    'bruised','molten','sapphire','obsidian','ivory','copper','jade','amber',
    'purple','orange','emerald','navy','azure','ebony','onyx','pearl','rust','rusty',
    'shining','silvery','blackened','sun-bleached','moonlit','flame-lit','flame','flames',
    'gilded','smudged','dappled','speckled','striped','frothing','foaming',
  ],
  sound: [
    'roaring','whispering','crackling','humming','thundering','chirping','rustling','booming',
    'howling','clattering','hissing','buzzing','murmuring','rumbling','clinking','echoing',
    'thumping','screeching','jingling','sizzling','snapping','whooshing','crunching','groaning',
    'rattling','pattering','dripping','splashing','gurgling','chiming','rasping','wailing',
  ],
  smell: [
    'fragrant','musty','smoky','earthy','pungent','crisp','stale','damp','spicy',
    'perfumed','acrid','floral','woody','rotten','vanilla','cinnamon','tangy',
    'sweet-smelling','sharp-smelling','briny','mossy','peppery','citrusy',
    'salt','salty','ozone','metallic','aroma','scent','reek','stench','whiff',
    'fresh-cut','pine','cedar','lavender','jasmine','sulfur','sulphur',
  ],
  touch: [
    'rough','smooth','fuzzy','sharp','soft','sticky','silky','gritty',
    'slippery','jagged','velvety','brittle','tender','icy','scorching','coarse',
    'delicate','prickly','feathery','powdery','crumbly','spongy','leathery','clammy',
    'searing','frigid','tepid','warm','cold','glassy','rocky','sandy','muddy',
    'stung','stings','stinging','biting','numb','tingling','sweaty','wet',
  ],
  taste: [
    'bitter','savory','creamy','crunchy','juicy','bland','zesty','rich',
    'sweet','salty','sour','metallic','buttery','honeyed','smoky','peppery',
  ],
};

export const SENSORY = new Set<string>(
  Object.values(SENSORY_BY_SENSE).flat()
);

export function senseOf(word: string): keyof typeof SENSORY_BY_SENSE | null {
  for (const sense of Object.keys(SENSORY_BY_SENSE) as (keyof typeof SENSORY_BY_SENSE)[]) {
    if (SENSORY_BY_SENSE[sense].includes(word)) return sense;
  }
  return null;
}

export const STRONG_VERBS = new Set<string>([
  // Motion (fast)
  'sprinted','dashed','bolted','darted','charged','plunged','soared','crashed','slammed',
  'sprinting','dashing','bolting','darting','charging','plunging','soaring','crashing','slamming',
  'rocketed','plummeted','vaulted','launched','leaped','bounded','flung','hurled',
  'rocketing','plummeting','vaulting','launching','leaping','bounding','flinging','hurling',
  // Motion (slow / careful)
  'crept','crawled','stalked','prowled','lurked','slithered','scurried','scrambled','stumbled',
  'creeping','crawling','stalking','prowling','lurking','slithering','scurrying','scrambling','stumbling',
  'sprawled','sprawling','curled','curling','coiled','coiling','sagged','sagging','slumped','slumping',
  // Impact / explosion
  'blazed','erupted','exploded','shattered','splintered','smashed','snapped',
  'blazing','erupting','exploding','shattering','splintering','smashing','snapping',
  'tore','ripped','sliced','carved','etched','burned','scorched','melted','dissolved',
  'tearing','ripping','slicing','carving','etching','burning','scorching','melting','dissolving',
  // Body / tremble
  'trembled','shuddered','quivered','shivered','flinched','clenched','tensed',
  'trembling','shuddering','quivering','shivering','flinching','clenching','tensing',
  'crouched','cowered','huddled','hunched','loomed','towered','swayed',
  'crouching','cowering','huddling','hunching','looming','towering','swaying',
  // Sound
  'whispered','murmured','hissed','bellowed','roared','shrieked','howled','sobbed','gasped','growled',
  'whispering','murmuring','hissing','bellowing','roaring','shrieking','howling','sobbing','gasping','growling',
  'pounded','thundered','rattled','clattered','crackled','clinked','hummed','chimed','jingled',
  'pounding','thundering','rattling','clattering','crackling','clinking','humming','chiming','jingling',
  // Grip / take
  'devoured','gnawed','clutched','seized','gripped','snatched','grabbed','clawed','grasped','pressed','squeezed',
  'devouring','gnawing','clutching','seizing','gripping','snatching','grabbing','clawing','grasping','pressing','squeezing',
  // Eyes
  'gazed','peered','squinted','glanced','stared','glared','blinked','spotted','glimpsed',
  'gazing','peering','squinting','glancing','staring','glaring','blinking','spotting','glimpsing',
  // Light
  'shimmered','glittered','dazzled','gleamed','sparkled','glowed','flickered',
  'shimmering','glittering','dazzling','gleaming','sparkling','glowing','flickering',
  // Water / weather
  'swirled','cascaded','rippled','surged','flooded','poured','drenched','soaked','dripped','splashed',
  'swirling','cascading','rippling','surging','flooding','pouring','drenching','soaking','dripping','splashing',
  // Transform / appear
  'vanished','emerged','surfaced','materialized','dissolved','crumbled','collapsed','tumbled',
  'vanishing','emerging','surfacing','materializing','dissolving','crumbling','collapsing','tumbling',
  // Misc useful
  'stirred','stirring','cracked','cracking','sliced','slicing','pierced','piercing',
  'whirled','whirling','spun','spinning','twirled','twirling','jerked','jerking',
]);

export const VAGUE = new Set<string>([
  'nice','good','bad','big','small','little','very','really','quite','super',
  'stuff','things','thing','went','said','got','get','looked','seemed',
  'cool','awesome','great','weird','funny','scary','amazing','beautiful',
  'pretty','walked','told','asked','came','moved','felt',
]);

/** Tired clichés to flag as originality deductions. */
export const CLICHES: string[] = [
  'heart pounding','heart was pounding','heart pounded','blood ran cold',
  'as fast as lightning','as quick as lightning','at the end of the day',
  'in the nick of time','dark and stormy night','sent shivers down',
  'felt like forever','as white as a ghost','as quiet as a mouse',
];
