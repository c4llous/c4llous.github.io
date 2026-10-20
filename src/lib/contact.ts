/** Client side of the secure channel. The relay (server/contact.ts) holds the Telegram secrets. */

export interface ContactPayload {
  name: string;
  contact: string;
  message: string;
  source: 'terminal' | 'form';
  /** Honeypot — always empty for humans. */
  website?: string;
}

export type ContactResult = { ok: true } | { ok: false; error: string };

// Mirrors the server's check so people get instant feedback; the server still enforces it.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{7,22}$/;
export const isReachable = (v: string) => EMAIL.test(v) || (PHONE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7);

export async function sendContact(payload: ContactPayload): Promise<ContactResult> {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error ?? `relay returned ${res.status}` };
  } catch {
    return { ok: false, error: 'network unreachable' };
  }
}

const PUNCHLINES = [
  "Usually sooner. Unless he's mid-incident — then later, with a better story.",
  'Statistically sooner. Emotionally, he is already typing.',
  'Your message passed identity, posture and policy. Final approval: Ritesh.',
  'No auto-reply. No ticket number. Just a human who actually reads these.',
  'He reads every message. The interesting ones jump the queue. Yours looked interesting.',
];

export const punchline = () => PUNCHLINES[Math.floor(Math.random() * PUNCHLINES.length)];
