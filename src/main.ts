import './styles/main.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { manifesto, marquee, modules, profile, type FormationName } from './content';
import { runBoot } from './sections/boot';
import { initEvolution } from './sections/evolution';
import { initZeroTrust } from './sections/zerotrust';
import { initTerminal } from './sections/terminal';
import { initChannel } from './sections/channel';
import { Portrait } from './scene/Portrait';
import { initCursor, initMagnetic } from './lib/cursor';
import { bindHoverScramble, scramble } from './lib/scramble';
import type { WorldLike } from './types';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
if (reduced) root.classList.add('no-motion');

// ---------- world ----------
// three.js is loaded lazily behind the boot screen. Until it arrives, this proxy
// remembers the latest formation request and replays it once the world is live.
let real: WorldLike | null = null;
let pending: Parameters<WorldLike['morphTo']> | null = null;
const world: WorldLike = {
  morphTo: (...args) => (real ? real.morphTo(...args) : void (pending = args)),
  glitch: (s) => real?.glitch(s),
  shockwave: (x, y) => real?.shockwave(x, y),
  setVelocity: (v) => real?.setVelocity(v),
};

const canvas = document.getElementById('world') as HTMLCanvasElement;
const worldReady: Promise<number> = (webglAvailable() ? import('./scene/World') : Promise.reject(new Error('no webgl')))
  .then(async ({ World }) => {
    const w = new World(canvas, { reducedMotion: reduced });
    await w.init();
    real = w;
    if (pending) w.morphTo(...pending);
    return w.particleCount;
  })
  .catch(() => {
    root.classList.add('no-webgl');
    canvas.remove();
    return 0;
  });

// ---------- portraits ----------
// The hero silhouette and the thermal shot are both rendered from the same real photo.
let heroPortrait: Portrait | null = null;
const portraitsReady = Promise.all([
  Portrait.create(document.getElementById('hero-figure') as HTMLCanvasElement, 'shadow', reduced),
  Portrait.create(document.getElementById('thermal-figure') as HTMLCanvasElement, 'thermal', reduced),
])
  .then(([hero]) => {
    heroPortrait = hero;
    if (!hero) root.classList.add('no-webgl');
    else if (!reduced) hero.reveal = 0;
  })
  .catch(() => root.classList.add('no-webgl'));

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Scene director state (see `direct()` below). Declared early: sections report changes during init.
interface Scene {
  active(): boolean;
  formation(): FormationName;
  label(): string;
  side: 'right' | 'center';
}
let scenes: Scene[] = [];
let appliedKey = '';
let evoScene: Scene | null = null;

// ---------- smooth scroll ----------
const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, smoothWheel: !reduced });
lenis.stop();
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

const hudScroll = document.getElementById('hud-scroll')!;
const hudProgress = document.getElementById('hud-progress')!;
lenis.on('scroll', (e: Lenis) => {
  ScrollTrigger.update();
  world.setVelocity(e.velocity);
  const p = Math.round(e.progress * 100) || 0;
  hudScroll.textContent = `${String(p).padStart(3, '0')}%`;
  hudProgress.style.height = `${p}%`;
});

const scrollToHash = (hash: string) => {
  const target = document.querySelector<HTMLElement>(hash);
  if (target) lenis.scrollTo(target, { duration: reduced ? 0 : 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
};
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  e.preventDefault();
  scrollToHash(a.getAttribute('href')!);
});

// ---------- mobile menu ----------
const menuBtn = document.querySelector<HTMLButtonElement>('.nav__menu')!;
const setMenu = (open: boolean) => {
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'CLOSE' : 'MENU';
  if (open) lenis.stop();
  else if (!document.body.classList.contains('is-booting')) lenis.start();
};
menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
window.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// ---------- static content ----------
const chipList = document.getElementById('hero-chips')!;
profile.focus.forEach((f) => {
  const li = document.createElement('li');
  li.textContent = f;
  chipList.appendChild(li);
});

const marqueeEl = document.getElementById('marquee')!;
[...marquee, ...marquee].forEach((m) => {
  const s = document.createElement('span');
  s.textContent = m;
  marqueeEl.appendChild(s);
});

const KEYWORDS = new Set(['software', 'systems', 'identity', 'zero', 'trust', 'builder']);
const manifestoEl = document.getElementById('manifesto')!;
const words = manifesto.split(' ').map((w) => {
  const s = document.createElement('span');
  s.className = 'w';
  if (KEYWORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))) s.classList.add('k');
  s.textContent = w;
  manifestoEl.append(s, ' ');
  return s;
});

const modList = document.getElementById('modules-list')!;
modules.forEach((m, i) => {
  const li = document.createElement('li');
  li.className = 'mod';
  li.tabIndex = 0;
  li.innerHTML = `
    <span class="mod__idx">${String(i + 1).padStart(2, '0')}</span>
    <span class="mod__name"></span>
    <span class="mod__dom"></span>
    <div class="mod__detail"><div><p></p><ul></ul></div></div>`;
  li.querySelector('.mod__name')!.textContent = m.name;
  li.querySelector('.mod__dom')!.textContent = m.domain;
  li.querySelector('.mod__detail p')!.textContent = m.detail;
  const ul = li.querySelector('.mod__detail ul')!;
  m.stack.forEach((t) => {
    const x = document.createElement('li');
    x.textContent = t;
    ul.appendChild(x);
  });
  li.addEventListener('mouseenter', () => world.glitch(0.18));
  modList.appendChild(li);
});

const linksEl = document.getElementById('contact-links')!;
const { linkedin, email, github } = profile.links;
const contactLinks: [string, string, string][] = [];
if (linkedin) contactLinks.push(['LinkedIn', linkedin, '↗']);
if (email) contactLinks.push([email, `mailto:${email}`, '@']);
if (github) contactLinks.push(['GitHub', github, '↗']);
contactLinks.forEach(([label, href, icon]) => {
  const a = document.createElement('a');
  a.className = 'btn';
  a.href = href;
  if (!href.startsWith('mailto:')) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  a.dataset.magnetic = '';
  a.innerHTML = '<span></span><i></i>';
  a.querySelector('span')!.textContent = label;
  a.querySelector('i')!.textContent = icon;
  linksEl.appendChild(a);
});
document.getElementById('year')!.textContent = String(new Date().getFullYear());

// ---------- HUD ----------
const hudTime = document.getElementById('hud-time')!;
const hudSection = document.getElementById('hud-section')!;
const tickClock = () => (hudTime.textContent = `${new Date().toISOString().slice(11, 19)} UTC`);
tickClock();
setInterval(tickClock, 1000);
let lastLabel = '';
const setSection = (label: string) => {
  if (label === lastLabel) return;
  lastLabel = label;
  scramble(hudSection, `// ${label}`, 380);
};

// Reticle locked onto the portrait's face, wired to the readout panel.
// Hovering the face trips the access policy — the face stays redacted.
const reticle = document.querySelector<HTMLElement>('.reticle')!;
const reticleLabel = reticle.querySelector<HTMLElement>('.reticle__label')!;
const reticleSub = reticle.querySelector<HTMLElement>('.reticle__sub')!;
const leader = document.querySelector<SVGSVGElement>('.leader')!;
const leaderPath = document.getElementById('leader-path')!;
const leaderDot = document.getElementById('leader-dot')!;
const readoutTitle = document.querySelector<HTMLElement>('.readout__title');
const pointer = { x: -1, y: -1 };
window.addEventListener('pointermove', (e) => Object.assign(pointer, { x: e.clientX, y: e.clientY }), { passive: true });
let denied = false;
const setDenied = (v: boolean) => {
  if (v === denied) return;
  denied = v;
  reticle.classList.toggle('is-denied', v);
  scramble(reticleLabel, v ? 'ACCESS DENIED' : 'IDENTITY: VERIFIED', 260);
  scramble(reticleSub, v ? 'FACE NOT IN YOUR ACCESS POLICY' : 'FACE: REDACTED', 320);
  if (heroPortrait) gsap.to(heroPortrait, { glitch: v ? 0.85 : 0, duration: v ? 0.08 : 0.7 });
  if (v) world.glitch(0.35);
};
gsap.ticker.add(() => {
  const p = heroPortrait;
  const on =
    !!p && p.reveal > 0.98 && window.scrollY < window.innerHeight * 0.5 && window.innerWidth > 820 && !document.body.classList.contains('is-booting');
  reticle.classList.toggle('is-on', on);
  if (!p || !on) {
    leader.classList.remove('is-on');
    setDenied(false);
    return;
  }
  const r = p.faceRect();
  reticle.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
  reticle.style.width = `${r.w}px`;
  reticle.style.height = `${r.h}px`;
  setDenied(pointer.x > r.x && pointer.x < r.x + r.w && pointer.y > r.y && pointer.y < r.y + r.h);
  const t = readoutTitle?.getBoundingClientRect();
  const linked = !!t && t.width > 0 && t.top > 40 && t.bottom < window.innerHeight - 40 && t.left > r.x + r.w + 40;
  leader.classList.toggle('is-on', linked);
  if (linked && t) {
    const x0 = r.x + r.w, y0 = r.y + r.h * 0.5;
    const x1 = t.left - 12, y1 = t.top + t.height / 2;
    leaderPath.setAttribute('d', `M${x0},${y0} L${x0 + 26},${y0} L${x1 - 30},${y1} L${x1},${y1}`);
    leaderDot.setAttribute('cx', String(x1));
    leaderDot.setAttribute('cy', String(y1));
  }
});

// Thermal readout: a body that is very much alive.
const temp = document.getElementById('thermal-temp');
if (temp && !reduced) setInterval(() => (temp.textContent = `${(36.4 + Math.random() * 0.5).toFixed(1)}°C`), 1400);

// Click anywhere empty → shockwave through the particle field.
window.addEventListener('pointerdown', (e) => {
  if (document.body.classList.contains('is-booting')) return;
  if ((e.target as HTMLElement).closest('a, button, input, textarea, form, .term, .zt__panel, .mod')) return;
  world.shockwave(e.clientX, e.clientY);
});

// ---------- interactive sections ----------
const zt = initZeroTrust((kind) => world.glitch(kind === 'deny' ? 0.6 : 0.2));
const terminal = initTerminal(scrollToHash);
const evolution = initEvolution((y) => lenis.scrollTo(y, { duration: 1.2 }), () => direct());
initChannel({
  onRunTerminal: () => {
    scrollToHash('#terminal');
    setTimeout(() => terminal.runContact(), reduced ? 0 : 1300);
  },
  onSent: () => world.glitch(0.5),
});
initCursor();
initMagnetic();
bindHoverScramble();

// Hide hero pieces until the boot hands over.
if (!reduced) {
  gsap.set('.hero__giant span', { yPercent: 18, opacity: 0 });
  gsap.set('.reveal-boot', { opacity: 0, y: 24 });
}

let skipBoot = reduced || new URLSearchParams(location.search).has('noboot');
try {
  skipBoot ||= sessionStorage.getItem('rs-booted') === '1';
} catch {
  /* storage unavailable — show the boot */
}

const ready = Promise.all([worldReady, portraitsReady]).then(([count]) => count);
runBoot({ ready, skip: skipBoot }).then(() => {
  try {
    sessionStorage.setItem('rs-booted', '1');
  } catch {
    /* ignore */
  }
  document.body.classList.remove('is-booting');
  lenis.start();
  revealHero();
  bindScrollScenes();
});

function revealHero() {
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero__giant span', { yPercent: 0, opacity: 1, duration: 1.8 }, 0)
    .to('.reveal-boot', { opacity: 1, y: 0, duration: 1.1, stagger: 0.07 }, 0.5);
  // A scanner beam paints him in from the top.
  if (heroPortrait) tl.to(heroPortrait, { reveal: 1, duration: 2.1, ease: 'power2.inOut' }, 0.15);
}

// ---------- scene director ----------
// One place decides what the particles show: the last active section in page order.
// Deriving it from state (not from enter/leave callbacks) keeps fast jumps and
// scroll restoration from leaving a stale formation behind.

function direct() {
  const scene = [...scenes].reverse().find((s) => s.active());
  if (!scene) return;
  setSection(scene.label());
  const key = `${scene.formation()}|${scene.side}`;
  if (key === appliedKey) return;
  appliedKey = key;
  world.morphTo(scene.formation(), scene.side, scene === evoScene ? 1.9 : 2.2);
}

function bindScrollScenes() {
  scenes = [...document.querySelectorAll<HTMLElement>('main > section')].flatMap((el): Scene[] => {
    if (el.id === 'evolution') {
      if (!evolution) return [];
      evoScene = { ...evolution, side: 'right' };
      return [evoScene];
    }
    if (!el.dataset.formation) return [];
    const st = ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onToggle: direct });
    return [
      {
        active: () => st.isActive,
        formation: () => el.dataset.formation as FormationName,
        label: () => el.dataset.label ?? '',
        side: (el.dataset.side as 'right' | 'center') ?? 'right',
      },
    ];
  });
  ScrollTrigger.addEventListener('refresh', direct);

  // Nav highlighting.
  document.querySelectorAll<HTMLAnchorElement>('.nav__links a').forEach((a) => {
    const target = document.querySelector<HTMLElement>(a.getAttribute('href')!);
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });

  // Manifesto: words light up as you read.
  if (reduced) {
    gsap.set(words, { opacity: 1 });
    words.forEach((w) => w.classList.add('lit'));
  } else {
    gsap.to(words, {
      opacity: 1,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: {
        trigger: manifestoEl,
        start: 'top 78%',
        end: 'bottom 50%',
        scrub: 0.6,
        onUpdate: (self) => {
          const lit = self.progress * words.length;
          words.forEach((w, i) => w.classList.toggle('lit', i < lit));
        },
      },
    });
  }

  // Generic reveals.
  if (!reduced) {
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out' }),
    });
    ScrollTrigger.batch('.mod', {
      start: 'top 92%',
      once: true,
      onEnter: (els) => gsap.from(els, { opacity: 0, y: 40, duration: 0.9, stagger: 0.06, ease: 'power3.out' }),
    });
  }

  ScrollTrigger.create({ trigger: '#zero-trust .zt__panel', start: 'top 70%', once: true, onEnter: () => zt.autoplay() });
  ScrollTrigger.create({ trigger: '#term', start: 'top 75%', once: true, onEnter: () => terminal.boot() });

  ScrollTrigger.refresh();
  direct();
}
