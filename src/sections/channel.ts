import gsap from 'gsap';
import { isReachable, punchline, sendContact } from '../lib/contact';
import { scramble } from '../lib/scramble';
import { SENT_BANNER } from '../lib/banner';

/** The contact form: same relay as ./contact.sh, for people who don't live in terminals. */
export function initChannel(opts: { onRunTerminal: () => void; onSent?: () => void }) {
  const form = document.getElementById('channel') as HTMLFormElement | null;
  const done = document.getElementById('channel-done');
  if (!form || !done) return;
  const state = document.getElementById('channel-state')!;
  const error = document.getElementById('channel-error')!;
  const banner = done.querySelector<HTMLElement>('.channel-done__banner')!;
  const punch = document.getElementById('channel-punch')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const submitLabel = submit.querySelector('span')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setState = (text: string, cls = '') => {
    state.className = `channel__state ${cls}`;
    scramble(state, text, 300);
  };
  const field = (name: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  form.querySelectorAll('input, textarea').forEach((el) =>
    el.addEventListener('input', () => {
      el.closest('.field')?.classList.remove('is-invalid');
      error.textContent = '';
    }),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = field('name').value.trim();
    const contact = field('contact').value.trim();
    const message = field('message').value.trim();
    const website = field('website').value;

    const problems: [string, string][] = [];
    if (!isReachable(contact)) problems.push(['contact', "that's not an email or a phone number. zero trust, remember?"]);
    if (!message) problems.push(['message', 'an empty mission? bold. type something.']);
    if (problems.length) {
      problems.forEach(([n]) => field(n).closest('.field')?.classList.add('is-invalid'));
      error.textContent = problems[0][1];
      field(problems[0][0]).focus();
      return;
    }

    submit.disabled = true;
    submitLabel.textContent = 'Transmitting…';
    setState('TRANSMITTING', 'is-busy');
    error.textContent = '';
    const result = await sendContact({ name, contact, message, source: 'form', website });
    submit.disabled = false;
    submitLabel.textContent = 'Transmit';

    if (!result.ok) {
      setState('FAILED', 'is-error');
      error.textContent =
        result.error === 'channel not configured'
          ? 'the relay is not wired up on this deployment yet — try again later.'
          : `transmission failed (${result.error}). nothing was lost — try again.`;
      return;
    }

    setState('DELIVERED');
    opts.onSent?.();
    gsap.to(form, {
      opacity: 0,
      y: -16,
      duration: reduced ? 0 : 0.35,
      onComplete: () => {
        form.hidden = true;
        done.hidden = false;
        punch.textContent = punchline();
        banner.innerHTML = '';
        SENT_BANNER.forEach((line, i) => {
          const row = document.createElement('span');
          row.style.display = 'block';
          banner.appendChild(row);
          if (reduced) row.textContent = line;
          else setTimeout(() => scramble(row, line, 600), i * 70);
        });
        gsap.fromTo(done, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: reduced ? 0 : 0.8, ease: 'power3.out' });
      },
    });
  });

  document.getElementById('channel-again')?.addEventListener('click', () => {
    form.reset();
    done.hidden = true;
    form.hidden = false;
    setState('READY');
    gsap.fromTo(form, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: reduced ? 0 : 0.6, ease: 'power3.out' });
    field('message').focus();
  });

  document.querySelectorAll<HTMLElement>('[data-action="terminal-contact"]').forEach((b) => b.addEventListener('click', opts.onRunTerminal));
}
