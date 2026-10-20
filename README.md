# ritesh singh — personal site

A cinematic, interactive personal site. Ritesh appears "hidden but identical": his real silhouette, lit like a
film still, with the face in shadow. Around that: an 8-chapter scroll story (Software → … → Security Architecture),
a live Zero Trust connection simulator, a working terminal with `./contact.sh`, and a contact form that sends
straight to Telegram.

Vite + TypeScript, three.js (particles + bloom), raw WebGL (portraits), GSAP ScrollTrigger, Lenis. No framework.

## Run

```bash
npm install
cp .env.example .env.local   # then fill in the Telegram values
npm run dev                  # http://localhost:5173  (add ?noboot to skip the boot sequence)
npm run build                # typecheck + production build → dist/
npm run preview              # serve dist/ (the contact relay works here too)
```

## Contact relay (Telegram)

Messages from `./contact.sh` and the contact form go **browser → `/api/contact` → Telegram**. The bot token
never reaches the browser: a token in client-side JavaScript can be read by anyone and used to spam you, read the
bot's updates or reconfigure it.

| Variable | Where it's used |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your chat id (the bot messages you here) |
| `ALLOWED_ORIGINS` | Optional. Comma-separated origins allowed to call the endpoint, e.g. `https://yourdomain.com` |

Locally they live in `.env.local` (gitignored). In production set them in your host's environment settings.
**Never prefix them with `VITE_`**, which would bundle them into the browser.

The relay (`server/contact.ts`) validates input, requires an email or phone number, sends plain text (no
formatting injection), rate-limits per IP, drops honeypot submissions, and never echoes upstream errors.

## Deploy

**Vercel** (zero config): import the repo, add the environment variables above, deploy. `api/contact.ts` becomes
the serverless function; `dist/` is served statically.

**Elsewhere:** `dist/` is a static site. The relay is a standard `(Request) => Response` handler, so wrapping it
for Netlify Functions or Cloudflare Pages Functions is a few lines that call `handleContact(request, env)`.

After deploying, set `og:image` in `index.html` to the absolute URL of `/og.png`.

## Editing content

All copy lives in **`src/content.ts`**: profile, manifesto, the eight evolution chapters, capability modules and the
marquee. The rule at the top of that file applies: only facts that are actually true — no invented companies,
dates, metrics or certifications.

- **Contact links**: set `profile.links` (LinkedIn / email / GitHub) to show buttons and terminal output.
- **Chapters**: each picks a particle `formation`, generated in `src/scene/formations.ts`.
- **Zero Trust simulator**: scenarios are plain data at the top of `src/sections/zerotrust.ts`.
- **Terminal commands**: `src/sections/terminal.ts` (`./contact.sh`, `neofetch`, `help`, plus a few hidden ones).

## The portraits

`public/ritesh-cutout.png` is the photo with the background removed (macOS Vision subject lifting) and cropped.
`src/scene/Portrait.ts` renders it two ways from soft alpha fields computed at load:

- **shadow** (hero): low-key body, warm rim light that follows the cursor, a cool fill rim opposite, the face sunk
  into shadow and mirrored aviator lenses with a sweeping glint. Hovering the face trips "ACCESS DENIED".
- **thermal** (contact): a low-res heat-sensor look with a mosaic over the face.

The face and lens positions are measured landmarks at the top of `Portrait.ts`. If you swap the photo, update them.
The terminal's `neofetch` builds an ASCII version from the same image.

## How it fits together

| File | Role |
| --- | --- |
| `src/main.ts` | Boot, smooth scroll, HUD, reticle, and the **scene director** that picks the particle formation from the last active section |
| `src/scene/World.ts` | three.js particle system morphing between formations, cursor field, click shockwave, glitch, bloom. Lazy-loaded behind the boot |
| `src/scene/Portrait.ts` | Raw-WebGL hero and thermal portraits |
| `src/sections/*` | Boot, pinned evolution story, Zero Trust simulator, terminal, contact form |
| `server/contact.ts`, `api/contact.ts` | Telegram relay and its Vercel entry point; `vite.config.ts` mounts the same handler for dev/preview |

## Accessibility & fallbacks

- `prefers-reduced-motion`: no boot sequence, no smooth scroll, instant morphs, static lighting.
- No WebGL: the portrait falls back to a darkened, rim-lit image of the cutout.
- No JS: `<noscript>` hides the boot overlay so the static content is readable.
- The boot runs once per browser session; any key or click skips it.
