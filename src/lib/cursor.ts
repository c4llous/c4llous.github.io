import gsap from 'gsap';

/** Crosshair cursor with live coordinates and contextual labels. Desktop pointers only. */
export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.querySelector<HTMLElement>('.cursor');
  if (!root) return;
  document.documentElement.classList.add('has-cursor');
  const dot = root.querySelector<HTMLElement>('.cursor__dot')!;
  const ring = root.querySelector<HTMLElement>('.cursor__ring')!;
  const label = root.querySelector<HTMLElement>('.cursor__label')!;

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
  const labX = gsap.quickTo(label, 'x', { duration: 0.35, ease: 'power3' });
  const labY = gsap.quickTo(label, 'y', { duration: 0.35, ease: 'power3' });
  let hoverText = '';

  window.addEventListener(
    'pointermove',
    (e) => {
      root.classList.add('is-ready');
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
      labX(e.clientX + 22);
      labY(e.clientY + 14);
      label.textContent = hoverText || `X:${String(Math.round(e.clientX)).padStart(4, '0')} Y:${String(Math.round(e.clientY)).padStart(4, '0')}`;
    },
    { passive: true },
  );
  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  document.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('a, button, [data-cursor], .mod');
    root.classList.toggle('is-hover', !!t);
    hoverText = t?.dataset.cursor ?? (t ? (t.tagName === 'A' ? 'open' : t.classList.contains('mod') ? 'inspect' : 'run') : '');
  });
}

/** Buttons that lean toward the cursor. */
export function initMagnetic() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.35);
      y((e.clientY - r.top - r.height / 2) * 0.45);
    });
    el.addEventListener('pointerleave', () => {
      x(0);
      y(0);
    });
  });
}
