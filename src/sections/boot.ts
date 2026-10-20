import gsap from 'gsap';
import { scramble } from '../lib/scramble';

const LINES: [string, string][] = [
  ['Loading kernel', 'software_engineering.ko'],
  ['Mounting identity', 'ritesh.singh'],
  ['Verifying device posture', 'compliant'],
  ['Evaluating access policy', 'least-privilege'],
  ['Brokering connection', 'inside-out'],
  ['Exposed inbound ports', '0'],
  ['Redacting operator face', 'done'],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cinematic boot: a Zero Trust handshake that "authenticates" the visitor,
 * then wipes away to reveal the site. Any key / click fast-forwards.
 */
export async function runBoot(opts: { ready: Promise<number>; skip: boolean }): Promise<void> {
  const boot = document.getElementById('boot')!;
  const logEl = document.getElementById('boot-log')!;
  const bar = document.getElementById('boot-bar')!;
  const pct = document.getElementById('boot-pct')!;
  const granted = document.getElementById('boot-granted')!;
  const inner = boot.querySelector<HTMLElement>('.boot__inner')!;

  if (opts.skip) {
    await Promise.race([opts.ready, sleep(1200)]);
    boot.remove();
    return;
  }

  let fast = false;
  const ff = () => (fast = true);
  window.addEventListener('keydown', ff, { once: true });
  boot.addEventListener('pointerdown', ff, { once: true });

  const pause = (ms: number) => (fast ? Promise.resolve() : sleep(ms));
  const total = LINES.length + 1;
  const setProgress = (i: number) => {
    const p = Math.round((i / total) * 100);
    gsap.to(bar, { width: `${p}%`, duration: fast ? 0.05 : 0.35, ease: 'power2.out' });
    pct.textContent = `${String(p).padStart(3, '0')}%`;
  };

  const writeLine = async (label: string, value: string) => {
    const row = document.createElement('div');
    const dots = '.'.repeat(Math.max(3, 30 - label.length));
    row.innerHTML = `<span class="st">[ .... ]</span> ${label} <span class="dots">${dots}</span> <span class="hl"></span>`;
    logEl.appendChild(row);
    await pause(80 + Math.random() * 110);
    row.querySelector('.st')!.innerHTML = '[<span class="ok"> OK </span>]';
    const hl = row.querySelector<HTMLElement>('.hl')!;
    if (fast) hl.textContent = value;
    else await scramble(hl, value, 200);
  };

  logEl.innerHTML = '<div class="hl">RS//OS — secure boot sequence</div><div>&nbsp;</div>';
  for (let i = 0; i < LINES.length; i++) {
    await writeLine(...LINES[i]);
    setProgress(i + 1);
  }
  const count = await opts.ready;
  await writeLine('Spawning particle field', `${count.toLocaleString()} particles`);
  setProgress(total);
  await pause(150);

  window.removeEventListener('keydown', ff);

  // ACCESS GRANTED → wipe
  const tl = gsap.timeline();
  tl.to(inner, { opacity: 0, y: -20, duration: 0.35, ease: 'power2.in' })
    .add(() => {
      granted.querySelectorAll('span').forEach((s) => scramble(s, s.textContent ?? '', 500));
    })
    .fromTo(granted, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' })
    .to({}, { duration: 0.3 })
    .to(boot, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' });
  await tl.then();
  boot.remove();
}
