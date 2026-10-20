const GLYPHS = '!<>-_\\/[]{}=+*^?#%$01ABCDEFXZ';
const running = new WeakMap<HTMLElement, number>();

/** Decrypt-style text reveal: characters resolve from noise, left-biased. */
export function scramble(el: HTMLElement, text: string, duration = 900): Promise<void> {
  const prev = running.get(el);
  if (prev) cancelAnimationFrame(prev);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    return Promise.resolve();
  }
  const chars = [...text];
  const reveal = chars.map((_, i) => (i / chars.length) * duration * 0.6 + Math.random() * duration * 0.4);
  const start = performance.now();
  return new Promise((resolve) => {
    const frame = (now: number) => {
      const t = now - start;
      let out = '';
      let done = true;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ' ' || t >= reveal[i]) out += chars[i];
        else {
          done = false;
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      el.textContent = out;
      if (done) {
        running.delete(el);
        resolve();
      } else running.set(el, requestAnimationFrame(frame));
    };
    running.set(el, requestAnimationFrame(frame));
  });
}

/** Scramble links on hover, keeping their real label. */
export function bindHoverScramble(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    const label = el.textContent ?? '';
    el.addEventListener('mouseenter', () => scramble(el, label, 420));
  });
}
