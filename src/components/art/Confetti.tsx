import type { CSSProperties } from 'react';
import { seededRandom } from './random';

const random = seededRandom(20261004);
const PIECES = Array.from({ length: 40 }, () => ({
  left: random() * 100,
  dx: (random() - 0.5) * 220,
  rot: 360 + random() * 540,
  delay: random() * 700,
  duration: 2200 + random() * 1600,
  round: random() > 0.7,
  scale: 0.7 + random() * 0.6,
}));

const DEFAULT_COLORS = ['#F7D88D', '#F0694C', '#7C62F5', '#12A39A', '#FFFFFF', '#3478DB'];

/** A one-shot burst of falling paper confetti. Hidden for reduced-motion users. */
export function Confetti({ colors = DEFAULT_COLORS }: { colors?: string[] }) {
  return (
    <div className="ws-confetti" aria-hidden="true">
      {PIECES.map((piece, index) => (
        <i
          key={index}
          className={piece.round ? 'is-round' : undefined}
          style={{
            left: `${piece.left}%`,
            background: colors[index % colors.length],
            scale: String(piece.scale),
            '--dx': `${piece.dx.toFixed(0)}px`,
            '--rot': `${piece.rot.toFixed(0)}deg`,
            '--delay': `${piece.delay.toFixed(0)}ms`,
            '--dur': `${piece.duration.toFixed(0)}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
