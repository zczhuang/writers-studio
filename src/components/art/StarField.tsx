import { useMemo, type CSSProperties } from 'react';
import { seededRandom, sparklePath } from './random';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkle: boolean;
  delay: number;
}

function makeStars(seed: number, count: number, minX: number, maxSize: number): Star[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: minX + random() * (99 - minX),
    y: 1 + random() * 97,
    size: 1 + random() * maxSize,
    opacity: 0.3 + random() * 0.6,
    twinkle: random() > 0.62,
    delay: random() * 3.6,
  }));
}

interface Props {
  seed?: number;
  count?: number;
  sparkles?: number;
  /** Keep gold sparkles to the right of this x-percentage so they stay clear of copy. */
  sparkleFrom?: number;
  className?: string;
}

/**
 * A decorative night sky. Stars are fixed-size and placed by percentage, so the
 * field looks the same in a wide hero, a tall sidebar, or a full-screen stage.
 */
export function StarField({ seed = 3, count = 42, sparkles = 4, sparkleFrom = 58, className = '' }: Props) {
  const stars = useMemo(() => makeStars(seed, count, 0, 2.2), [seed, count]);
  const glints = useMemo(() => makeStars(seed * 7 + 1, sparkles, sparkleFrom, 6), [seed, sparkles, sparkleFrom]);
  return (
    <div className={`ws-stars ${className}`} aria-hidden="true">
      {stars.map((star, index) => (
        <i
          key={index}
          className={`ws-star ${star.twinkle ? 'ws-star-twinkle' : ''}`}
          style={{
            left: `${star.x.toFixed(2)}%`,
            top: `${star.y.toFixed(2)}%`,
            width: `${star.size.toFixed(1)}px`,
            height: `${star.size.toFixed(1)}px`,
            opacity: star.opacity,
            animationDelay: star.twinkle ? `${star.delay.toFixed(2)}s` : undefined,
          }}
        />
      ))}
      {glints.map((glint, index) => {
        const size = 9 + glint.size * 1.6;
        return (
          <svg
            key={`g-${index}`}
            className="ws-glint ws-star-twinkle"
            viewBox="-10 -10 20 20"
            focusable="false"
            style={{
              left: `${glint.x.toFixed(2)}%`,
              top: `${glint.y.toFixed(2)}%`,
              width: `${size.toFixed(1)}px`,
              height: `${size.toFixed(1)}px`,
              animationDelay: `${(glint.delay + 0.8).toFixed(2)}s`,
            } as CSSProperties}
          >
            <path d={sparklePath(0, 0, 10)} fill="#F7D88D" />
          </svg>
        );
      })}
    </div>
  );
}
