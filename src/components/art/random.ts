/** Small deterministic PRNG so decorative layouts are identical on every render. */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SVG-safe id fragment from React's useId output. */
export function svgId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** A rosette edge: `bumps` rounded scallops between radius `inner` and `outer`. */
export function scallopPath(cx: number, cy: number, outer: number, inner: number, bumps: number): string {
  const parts: string[] = [];
  for (let index = 0; index < bumps; index += 1) {
    const a0 = (index / bumps) * Math.PI * 2;
    const a1 = ((index + 0.5) / bumps) * Math.PI * 2;
    const a2 = ((index + 1) / bumps) * Math.PI * 2;
    const start = `${(cx + inner * Math.cos(a0)).toFixed(2)} ${(cy + inner * Math.sin(a0)).toFixed(2)}`;
    const control = `${(cx + outer * Math.cos(a1)).toFixed(2)} ${(cy + outer * Math.sin(a1)).toFixed(2)}`;
    const end = `${(cx + inner * Math.cos(a2)).toFixed(2)} ${(cy + inner * Math.sin(a2)).toFixed(2)}`;
    if (index === 0) parts.push(`M${start}`);
    parts.push(`Q${control} ${end}`);
  }
  return `${parts.join(' ')}Z`;
}

/** Points for an n-pointed star polygon. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const coords: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    coords.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return coords.join(' ');
}

/** A four-point sparkle centred on (x, y). */
export function sparklePath(x: number, y: number, size: number): string {
  const s = size;
  const k = size * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}
