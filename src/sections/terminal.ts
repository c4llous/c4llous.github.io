import { chapters, modules, profile } from '../content';
import { isReachable, punchline, sendContact } from '../lib/contact';
import { asciiPortrait } from '../lib/ascii';
import { scramble } from '../lib/scramble';
import { SENT_BANNER } from '../lib/banner';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROMPT = 'ritesh@ridge:~$';
const RUN_SCRIPT = /^(?:\.\/|(?:ba|z)?sh\s+(?:\.\/)?|source\s+(?:\.\/)?|\.\s+(?:\.\/)?)contact\.sh$/i;

const SCRIPT_SOURCE = [
  '<span class="dim">#!/usr/bin/env bash</span>',
  '<span class="dim"># contact.sh — direct line to Ritesh. lands on his phone.</span>',
  'read -p <span class="amber">"who\'s knocking? "</span> name',
  'read -p <span class="amber">"what\'s the mission? "</span> message',
  'read -p <span class="amber">"email or phone? "</span> reply_to',
  'curl -sX POST /api/contact -d <span class="amber">"$payload"</span>  <span class="dim"># the bot token lives server-side. nice try.</span>',
  'echo <span class="amber">"Ritesh will get back to you. sooner or later."</span>',
];

const FILES: Record<string, string> = {
  'about.txt': 'about',
  'stack.json': 'stack',
  'zero-trust.md': 'zerotrust',
  'path.log': 'path',
  'contact.sh': '',
};

type Out = string[];
interface Ctx {
  args: string[];
  raw: string;
  goTo: (hash: string) => void;
  clear: () => void;
  history: string[];
}

const COMMANDS: Record<string, { desc: string; run: (c: Ctx) => Out }> = {
  help: {
    desc: 'list available commands',
    run: () => [
      '<span class="sig">available commands</span>',
      `  <span class="hot">${'./contact.sh'.padEnd(12)}</span><span class="dim">message Ritesh directly — it lands on his phone</span>`,
      ...Object.entries(COMMANDS)
        .filter(([k]) => !HIDDEN.has(k))
        .map(([k, v]) => `  <span class="ice">${k.padEnd(12)}</span><span class="dim">${v.desc}</span>`),
      '',
      '<span class="dim">↑/↓ history · tab completes · ctrl+c cancels. a few commands are undocumented.</span>',
    ],
  },
  whoami: {
    desc: 'identify the operator',
    run: () => [
      `<span class="sig">${esc(profile.name)}</span>`,
      `${esc(profile.role)} @ ${esc(profile.company)}`,
      `<span class="dim">${esc(profile.headline)}</span>`,
      '<span class="dim">try `neofetch` for the full picture.</span>',
    ],
  },
  about: {
    desc: 'the short version',
    run: () => [
      "I didn't start in security. I started by writing software —",
      'APIs, databases, full-stack apps. Then I followed the systems down:',
      'into infrastructure, networks and identity.',
      '',
      'Today I design and troubleshoot enterprise <span class="sig">Zero Trust</span> environments',
      'with Zscaler — and I still think like a builder.',
    ],
  },
  experience: {
    desc: 'current role',
    run: () => [
      `<span class="amber">▸ now</span>   ${esc(profile.role)} <span class="dim">@</span> <span class="sig">${esc(profile.company)}</span>`,
      '        Zscaler (ZIA / ZPA) · Zero Trust architecture · secure remote access',
      '        application access · RDP connectivity · security policy design',
      '        troubleshooting complex enterprise environments',
      '',
      '<span class="dim">earlier: software engineering → full stack → enterprise systems. run `path`.</span>',
    ],
  },
  path: {
    desc: 'the career evolution',
    run: () =>
      chapters.map(
        (c, i) =>
          `${i === 0 ? ' ' : '↓'} <span class="${c.next ? 'amber' : 'ice'}">${c.index}</span> ${esc(c.title)}${c.next ? ' <span class="amber">[next]</span>' : ''}`,
      ),
  },
  stack: {
    desc: 'loaded modules',
    run: () => modules.map((m) => `<span class="ice">${esc(m.domain.padEnd(13))}</span>${esc(m.name)} <span class="dim">— ${esc(m.stack.join(', '))}</span>`),
  },
  neofetch: { desc: 'system info, operator edition', run: () => [] },
  zerotrust: {
    desc: 'the philosophy, in 4 lines',
    run: () => [
      '<span class="sig">1.</span> never trust the network. not even the internal one.',
      '<span class="sig">2.</span> verify explicitly: identity, device, context — every request.',
      '<span class="sig">3.</span> least privilege: connect users to apps, never to networks.',
      '<span class="sig">4.</span> assume breach: make the attack surface invisible.',
      '',
      '<span class="dim">run `sim` to watch it happen.</span>',
    ],
  },
  sim: {
    desc: 'jump to the live Zero Trust simulation',
    run: (c) => {
      setTimeout(() => c.goTo('#zero-trust'), 350);
      return ['<span class="dim">routing via broker…</span>'];
    },
  },
  contact: {
    desc: 'ways to reach Ritesh',
    run: () => {
      const { linkedin, email, github } = profile.links;
      return [
        'fastest: run <span class="hot">./contact.sh</span> — your message lands straight on his phone.',
        ...(linkedin ? [`<span class="dim">linkedin</span>  <a href="${esc(linkedin)}" target="_blank" rel="noopener">${esc(linkedin)}</a>`] : []),
        ...(email ? [`<span class="dim">email   </span>  <a href="mailto:${esc(email)}">${esc(email)}</a>`] : []),
        ...(github ? [`<span class="dim">github  </span>  <a href="${esc(github)}" target="_blank" rel="noopener">${esc(github)}</a>`] : []),
      ];
    },
  },
  ls: {
    desc: 'list files',
    run: (c) =>
      c.args.some((a) => a.startsWith('-'))
        ? Object.keys(FILES).map((f) =>
            f.endsWith('.sh')
              ? `<span class="dim">-rwxr-xr-x  ritesh</span>  <span class="hot">${f}</span>`
              : `<span class="dim">-rw-r--r--  ritesh</span>  <span class="ice">${f}</span>`,
          )
        : [Object.keys(FILES).map((f) => `<span class="${f.endsWith('.sh') ? 'hot' : 'ice'}">${f}</span>`).join('   ')],
  },
  cat: {
    desc: 'read a file',
    run: (c) => {
      const f = c.args[0]?.replace(/^\.\//, '');
      if (!f) return ['usage: cat &lt;file&gt;'];
      if (f === 'contact.sh') return SCRIPT_SOURCE;
      const cmd = FILES[f];
      if (!cmd) return [`<span class="err">cat: ${esc(f)}: No such file or directory</span>`];
      return COMMANDS[cmd].run(c);
    },
  },
  history: {
    desc: 'command history',
    run: (c) => c.history.map((h, i) => `<span class="dim">${String(i + 1).padStart(4)}</span>  ${esc(h)}`),
  },
  date: { desc: 'system time', run: () => [new Date().toString()] },
  clear: {
    desc: 'clear the screen',
    run: (c) => {
      c.clear();
      return [];
    },
  },
  // ---- undocumented ----
  sudo: {
    desc: '',
    run: (c) => {
      if (c.args.join(' ').toLowerCase() === 'hire ritesh') {
        return [
          '<span class="dim">[sudo] verifying identity… ok</span>',
          '<span class="dim">[sudo] checking device posture… compliant</span>',
          '<span class="dim">[sudo] evaluating policy… least privilege satisfied</span>',
          '<span class="sig">ACCESS GRANTED.</span> now make it official: <span class="hot">./contact.sh</span>',
        ];
      }
      return [`<span class="err">${esc(c.raw)}: denied by policy. this incident will be reported.</span>`, '<span class="dim">(hint: try `sudo hire ritesh`)</span>'];
    },
  },
  ping: { desc: '', run: () => ['PING ritesh (brokered): 56 data bytes', '64 bytes from ritesh: icmp_seq=0 ttl=64 time=0.42 ms', '<span class="sig">operator is online.</span>'] },
  nmap: {
    desc: '',
    run: () => ['Starting scan…', 'All 65535 scanned ports are <span class="sig">closed</span>.', '<span class="dim">no inbound listeners. that is the point.</span>'],
  },
  exit: { desc: '', run: () => ['there is no exit. only least privilege.'] },
  rm: { desc: '', run: () => ['<span class="err">rm: denied by policy. nice try.</span>'] },
  hello: { desc: '', run: () => ['hello, world. <span class="dim">(that is where it all started.)</span>'] },
};
const HIDDEN = new Set(['sudo', 'ping', 'nmap', 'exit', 'rm', 'hello']);

export function initTerminal(goTo: (hash: string) => void) {
  const body = document.getElementById('term-body');
  const out = document.getElementById('term-out');
  const input = document.getElementById('term-input') as HTMLInputElement | null;
  const promptEl = document.querySelector<HTMLElement>('.term__prompt');
  if (!body || !out || !input || !promptEl) return { boot: () => {}, runContact: () => {} };

  const history: string[] = [];
  let hIndex = 0;
  let queue = Promise.resolve();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let busy = false;
  let answer: ((v: string | null) => void) | null = null;

  const emit = (html: string, cls = '') => {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = html || '&nbsp;';
    out.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  };

  const print = (lines: Out, delay = 22) => {
    queue = queue.then(async () => {
      for (const l of lines) {
        emit(l);
        if (!reduced && delay) await sleep(delay);
      }
    });
    return queue;
  };

  const setPrompt = (html: string, asking = false) => {
    promptEl.innerHTML = html;
    promptEl.classList.toggle('is-asking', asking);
  };

  /** Ask a question in the prompt line. Resolves null if the visitor hits ctrl+c. */
  const ask = (question: string) =>
    new Promise<string | null>((resolve) => {
      setPrompt(`<span class="q">?</span> ${question} <span class="dim">›</span>`, true);
      answer = (v) => {
        if (v !== null) emit(`<span class="q">?</span> ${question} <span class="ans">${esc(v) || '<span class="dim">(skipped)</span>'}</span>`);
        resolve(v);
      };
      input.focus({ preventScroll: true });
    });

  // ---------- ./contact.sh ----------
  async function contactScript() {
    busy = true;
    setPrompt('');
    try {
      await queue;
      for (const l of [
        '<span class="hot">contact.sh</span> <span class="dim">— direct line to Ritesh. no forms, no bots, no small talk required.</span>',
        '<span class="dim">three questions. ctrl+c bails out anytime.</span>',
        '',
      ]) {
        emit(l);
        await sleep(reduced ? 0 : 120);
      }

      const name = await ask("who's knocking?");
      if (name === null) return bail();

      let message: string | null;
      for (;;) {
        message = await ask("what's the mission?");
        if (message === null) return bail();
        if (message.trim()) break;
        emit('  <span class="amber">an empty mission? bold. type something.</span>');
      }

      let reach: string | null;
      for (;;) {
        reach = await ask('email or phone?');
        if (reach === null) return bail();
        if (isReachable(reach.trim())) break;
        emit("  <span class=\"amber\">that's not an email or a phone number. zero trust, remember? try again.</span>");
      }

      const short = message.trim().length > 54 ? `${message.trim().slice(0, 54)}…` : message.trim();
      for (const l of [
        '',
        '<span class="dim">┌─ payload ───────────────────────────────</span>',
        `<span class="dim">│</span> from      ${esc(name.trim() || 'anonymous')}`,
        `<span class="dim">│</span> reply-to  ${esc(reach.trim())}`,
        `<span class="dim">│</span> message   ${esc(short)}`,
        '<span class="dim">└─────────────────────────────────────────</span>',
      ])
        emit(l);

      const go = await ask('transmit? [Y/n]');
      if (go === null || /^n/i.test(go.trim())) return bail('aborted. nothing left this machine.');

      const sending = sendContact({ name: name.trim(), contact: reach.trim(), message: message.trim(), source: 'terminal' });
      emit('');
      for (const step of ['wrapping payload in TLS', 'routing through the broker', "knocking on Ritesh's phone"]) {
        const row = emit(`<span class="hot">▸</span> ${step} <span class="dim">${'.'.repeat(Math.max(3, 30 - step.length))}</span> <span class="st"></span>`);
        const st = row.querySelector<HTMLElement>('.st')!;
        if (step.startsWith('knocking')) {
          const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
          let k = 0;
          const timer = setInterval(() => (st.textContent = spin[k++ % spin.length]), 80);
          const result = await sending;
          clearInterval(timer);
          if (!result.ok) {
            st.innerHTML = '<span class="err">failed</span>';
            return failed(result.error);
          }
        } else await sleep(reduced ? 0 : 380);
        st.innerHTML = '<span class="sig">ok</span>';
      }
      await succeeded();
    } finally {
      busy = false;
      answer = null;
      setPrompt(PROMPT);
    }
  }

  function bail(msg = 'connection closed. no data sent.') {
    emit(`<span class="dim">${msg}</span>`);
    emit('');
  }

  async function succeeded() {
    emit('');
    emit('<span class="sig">✓ delivered.</span> somewhere, Ritesh\'s phone just buzzed.');
    emit('');
    for (const line of SENT_BANNER) {
      const row = emit('', 'banner');
      if (reduced) row.textContent = line;
      else {
        scramble(row, line, 520);
        await sleep(70);
      }
    }
    await sleep(reduced ? 0 : 600);
    emit('');
    emit('<b class="big">Ritesh will get back to you — sooner or later.</b>');
    emit(`<span class="dim">${esc(punchline())}</span>`);
    emit('');
    emit('<span class="dim">── session closed · least privilege restored · 0 cookies harmed ──</span>');
    emit('');
  }

  function failed(error: string) {
    emit('');
    emit(`<span class="err">✗ transmission failed: ${esc(error)}.</span>`);
    emit(
      error === 'channel not configured'
        ? '<span class="dim">the relay is not wired up on this deployment yet. try again later.</span>'
        : '<span class="dim">nothing was lost on your side. run <span class="hot">./contact.sh</span> to try again.</span>',
    );
    emit('');
  }

  // ---------- neofetch ----------
  async function neofetch() {
    busy = true;
    try {
      await queue;
      const art = await asciiPortrait('/ritesh-cutout.png', 22).catch(() => [] as string[]);
      const stops = [
        [255, 122, 26],
        [255, 61, 110],
        [139, 92, 246],
      ];
      const tint = (t: number) => {
        const [a, b, u] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], t * 2 - 1];
        return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`;
      };
      const artHtml = art.map((l, i) => `<span style="color:${tint(i / Math.max(1, art.length - 1))}">${esc(l) || ' '}</span>`).join('\n');
      const info: [string, string][] = [
        ['OS', 'RS//OS · zero trust edition'],
        ['Host', profile.company],
        ['Role', profile.role],
        ['Kernel', 'software-engineering'],
        ['Focus', 'Zero Trust · ZIA · ZPA'],
        ['Stack', 'Python · JavaScript · Django'],
        ['Web', 'Angular · React / Next.js'],
        ['ERP', 'ERPNext / Frappe'],
        ['AI', 'LLMs · automation'],
        ['Shell', 'zsh (try ./contact.sh)'],
        ['Uptime', 'always verifying'],
      ];
      const infoHtml = [
        '<span class="hot">ritesh</span>@<span class="hot">ridge</span>',
        '<span class="dim">────────────────</span>',
        ...info.map(([k, v]) => `<span class="ice">${k}</span>  ${esc(v)}`),
        '',
        ['#ff7a1a', '#ff3d6e', '#8b5cf6', '#22e1ff', '#f5f5f7'].map((c) => `<span style="color:${c}">███</span>`).join(''),
      ].join('\n');
      emit(`<div class="neofetch"><pre class="neofetch__art" aria-label="ASCII portrait">${artHtml}</pre><pre class="neofetch__info">${infoHtml}</pre></div>`);
      emit('');
    } finally {
      busy = false;
    }
  }

  // ---------- command loop ----------
  const exec = (raw: string) => {
    const line = raw.trim();
    print([`<span class="p">${PROMPT}</span> <span class="cmd">${esc(line)}</span>`], 0);
    if (!line) return;
    history.push(line);
    hIndex = history.length;
    if (RUN_SCRIPT.test(line)) return void contactScript();
    if (line.toLowerCase() === 'contact.sh') {
      print(['<span class="err">zsh: command not found: contact.sh</span> <span class="dim">— it\'s a script. try <span class="hot">./contact.sh</span></span>']);
      return;
    }
    const [name, ...args] = line.split(/\s+/);
    if (name.toLowerCase() === 'neofetch') return void neofetch();
    const cmd = COMMANDS[name.toLowerCase()];
    if (!cmd) {
      print([`<span class="err">zsh: command not found: ${esc(name)}</span> <span class="dim">— try \`help\`</span>`]);
      return;
    }
    print([...cmd.run({ args, raw: line, goTo, clear: () => (out.innerHTML = ''), history }), '']);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (answer) {
        emit(`<span class="dim">^C</span>`);
        const a = answer;
        answer = null;
        input.value = '';
        a(null);
      } else if (!busy) {
        emit(`<span class="p">${PROMPT}</span> ${esc(input.value)}<span class="dim">^C</span>`);
        input.value = '';
      }
      return;
    }
    if (e.key === 'Enter') {
      const v = input.value;
      if (answer) {
        input.value = '';
        const a = answer;
        answer = null;
        a(v);
      } else if (!busy) {
        input.value = '';
        exec(v);
      }
      return;
    }
    if (answer || busy) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      hIndex = Math.max(0, hIndex - 1);
      input.value = history[hIndex] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIndex = Math.min(history.length, hIndex + 1);
      input.value = history[hIndex] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value.trim().toLowerCase();
      if (v.startsWith('cat ')) {
        const f = Object.keys(FILES).find((k) => k.startsWith(v.slice(4)));
        if (f) input.value = `cat ${f}`;
      } else if ('./contact.sh'.startsWith(v) && v.startsWith('.')) {
        input.value = './contact.sh';
      } else {
        const m = Object.keys(COMMANDS).filter((k) => !HIDDEN.has(k) && k.startsWith(v));
        if (m.length === 1) input.value = m[0];
        else if (m.length > 1) print([m.join('   ')], 0);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.innerHTML = '';
    }
  });
  body.addEventListener('click', () => {
    if (!window.getSelection()?.toString()) input.focus({ preventScroll: true });
  });

  let booted = false;
  const boot = () => {
    if (booted) return;
    booted = true;
    print(
      [
        '<span class="sig">RS//OS</span> <span class="dim">(ttys001) — session brokered inside-out.</span>',
        `<span class="dim">last login: ${new Date().toDateString()} · exposed ports: 0</span>`,
        '',
        'want to reach Ritesh? run <span class="hot">./contact.sh</span>',
        'or type <span class="ice">help</span>, <span class="ice">neofetch</span>, <span class="ice">whoami</span>.',
        '',
      ],
      60,
    );
  };

  return {
    boot,
    /** Types and runs ./contact.sh, e.g. from a "message me" button elsewhere on the page. */
    async runContact() {
      boot();
      await queue;
      if (busy) return input.focus({ preventScroll: true });
      input.value = '';
      for (const ch of './contact.sh') {
        input.value += ch;
        await sleep(reduced ? 0 : 45);
      }
      await sleep(reduced ? 0 : 200);
      input.value = '';
      exec('./contact.sh');
    },
  };
}
