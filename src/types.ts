import type { FormationName } from './content';

/** The slice of the WebGL world the DOM layer talks to (a no-op stub when WebGL is unavailable). */
export interface WorldLike {
  morphTo(name: FormationName, side?: 'right' | 'center', duration?: number): void;
  glitch(strength?: number): void;
  shockwave(clientX: number, clientY: number): void;
  setVelocity(v: number): void;
}
