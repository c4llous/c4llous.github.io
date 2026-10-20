/**
 * Contact relay: browser → this function → Telegram.
 *
 * The bot token only ever lives in server-side environment variables. A token shipped
 * in browser JavaScript can be read by anyone and used to spam, read or reconfigure the bot.
 */

export interface ContactEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** Comma-separated list of allowed Origin headers. Empty = allow any. */
  ALLOWED_ORIGINS?: string;
  /** Override for tests. */
  TELEGRAM_API_BASE?: string;
}

const LIMITS = { name: 80, contact: 120, message: 2000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{7,22}$/;

export function isReachable(contact: string) {
  if (EMAIL.test(contact)) return true;
  return PHONE.test(contact) && (contact.match(/\d/g)?.length ?? 0) >= 7;
}

// Per-instance sliding window. Serverless instances are short-lived, so this only
// blunts bursts; Telegram's own limits are the backstop.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// Strip control characters (keep newlines and tabs), trim, cap length.
const clean = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max)
    : '';

export async function handleContact(request: Request, env: ContactEnv): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method not allowed' });

  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin');
  if (allowed.length && (!origin || !allowed.includes(origin))) {
    return json(403, { ok: false, error: 'origin not allowed' });
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json(503, { ok: false, error: 'channel not configured' });
  }

  if (Number(request.headers.get('content-length') ?? 0) > 10_000) {
    return json(413, { ok: false, error: 'message too large' });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'invalid request' });
  }

  // Honeypot: real people never see this field. Pretend it worked.
  if (clean(body.website, 200)) return json(200, { ok: true });

  const name = clean(body.name, LIMITS.name);
  const contact = clean(body.contact, LIMITS.contact);
  const message = clean(body.message, LIMITS.message);
  const source = body.source === 'terminal' ? 'terminal' : 'form';

  if (!message) return json(400, { ok: false, error: 'message is empty' });
  if (!isReachable(contact)) return json(400, { ok: false, error: 'need a valid email or phone number' });

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';
  if (rateLimited(ip)) return json(429, { ok: false, error: 'too many messages, try again later' });

  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry');
  const text = [
    `📡 New message via ${source === 'terminal' ? './contact.sh' : 'the contact form'}`,
    '',
    `👤 ${name || 'anonymous'}`,
    `↩️ ${contact}`,
    ...(country ? [`🌍 ${country}`] : []),
    `🕐 ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    message,
  ].join('\n');

  const base = env.TELEGRAM_API_BASE || 'https://api.telegram.org';
  try {
    const res = await fetch(`${base}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Plain text on purpose: no parse_mode means visitors can't inject formatting or links.
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return json(502, { ok: false, error: 'relay rejected the message' });
  } catch {
    return json(502, { ok: false, error: 'relay unreachable' });
  }
  return json(200, { ok: true });
}
