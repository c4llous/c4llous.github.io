import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapters, type FormationName } from '../content';
import { scramble } from '../lib/scramble';

export interface EvolutionScene {
  active(): boolean;
  formation(): FormationName;
  label(): string;
}

/**
 * Pinned scroll story: SOFTWARE → … → SECURITY ARCHITECTURE, one formation per chapter.
 * It doesn't drive the particles itself: it reports changes and the scene director decides.
 */
export function initEvolution(scrollTo: (y: number) => void, onChange: () => void): EvolutionScene | null {
  const section = document.getElementById('evolution');
  const pin = section?.querySelector<HTMLElement>('.evolution__pin');
  if (!section || !pin) return null;

  const $ = (id: string) => document.getElementById(id)!;
  const idx = $('ch-index');
  const count = $('ch-count');
  const kicker = $('ch-kicker');
  const title = $('ch-title');
  const body = $('ch-body');
  const tags = $('ch-tags');
  const cmd = $('ch-cmd');
  const rail = $('ch-rail');
  $('ch-total').textContent = String(chapters.length).padStart(2, '0');

  const n = chapters.length;
  const items = chapters.map((c, i) => {
    const li = document.createElement('li');
    if (c.next) li.classList.add('is-next');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cursor = c.title;
    b.innerHTML = `<b>${c.index}</b>`;
    b.append(c.title);
    b.addEventListener('click', () => {
      const st = trigger;
      scrollTo(st.start + ((i + 0.5) / n) * (st.end - st.start));
    });
    li.appendChild(b);
    rail.appendChild(li);
    return li;
  });

  let current = -1;
  let typing = 0;

  const typeCmd = async (text: string) => {
    const id = ++typing;
    cmd.textContent = '';
    for (let i = 1; i <= text.length; i++) {
      if (id !== typing) return;
      cmd.textContent = text.slice(0, i);
      await new Promise((r) => setTimeout(r, 18));
    }
  };

  const render = (i: number, animate: boolean) => {
    const c = chapters[i];
    const dir = i > current ? 1 : -1;
    current = i;
    section.classList.toggle('chapter--next', !!c.next);
    count.textContent = c.index;
    kicker.textContent = c.kicker;
    items.forEach((li, k) => {
      li.classList.toggle('is-active', k === i);
      li.classList.toggle('is-done', k < i);
    });
    tags.innerHTML = '';
    c.tags.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      tags.appendChild(li);
    });
    onChange();

    if (!animate) {
      idx.textContent = c.index;
      title.textContent = c.title;
      body.textContent = c.body;
      cmd.textContent = c.command;
      return;
    }
    gsap.fromTo(idx, { yPercent: 30 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
    idx.textContent = c.index;
    scramble(title, c.title, 650);
    gsap.fromTo(body, { opacity: 0, y: 18 * dir }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', onStart: () => void (body.textContent = c.body) });
    gsap.fromTo(tags.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.5, delay: 0.15 });
    typeCmd(c.command);
  };

  render(0, false);

  const trigger = ScrollTrigger.create({
    trigger: section,
    pin,
    start: 'top top',
    end: () => `+=${window.innerHeight * n * 0.75}`,
    invalidateOnRefresh: true,
    onUpdate(self) {
      const i = Math.min(n - 1, Math.floor(self.progress * n));
      if (i !== current) render(i, true);
    },
    onToggle: onChange,
  });

  return {
    active: () => trigger.isActive,
    formation: () => chapters[Math.max(0, current)].formation,
    label: () => `EVOLUTION ${chapters[Math.max(0, current)].index}/${String(n).padStart(2, '0')}`,
  };
}
