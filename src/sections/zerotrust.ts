import gsap from 'gsap';

/**
 * Interactive, simplified Zscaler-style Zero Trust flow.
 * ZIA: user → identity/posture/policy → inline inspection → internet/SaaS.
 * ZPA: user → broker ← App Connector (outbound-only) → private app.
 */

const NS = 'http://www.w3.org/2000/svg';

interface NodeDef {
  id: string;
  x: number;
  y: number;
  w: number;
  label: string;
  sub: string;
  threat?: boolean;
}

const NODES: NodeDef[] = [
  { id: 'user', x: 95, y: 270, w: 112, label: 'USER', sub: 'CLIENT CONNECTOR' },
  { id: 'attacker', x: 95, y: 470, w: 112, label: 'ATTACKER', sub: 'EXTERNAL SCAN', threat: true },
  { id: 'identity', x: 275, y: 270, w: 92, label: 'IDENTITY', sub: 'IdP · SAML' },
  { id: 'posture', x: 395, y: 270, w: 92, label: 'POSTURE', sub: 'DEVICE' },
  { id: 'policy', x: 515, y: 270, w: 92, label: 'POLICY', sub: 'LEAST PRIV.' },
  { id: 'zia', x: 600, y: 130, w: 150, label: 'ZIA', sub: 'INTERNET ACCESS' },
  { id: 'zpa', x: 600, y: 410, w: 150, label: 'ZPA', sub: 'PRIVATE ACCESS' },
  { id: 'conn', x: 790, y: 425, w: 92, label: 'APP CONN.', sub: 'OUTBOUND ONLY' },
  { id: 'rdp', x: 935, y: 365, w: 86, label: 'RDP HOST', sub: ':3389' },
  { id: 'web', x: 935, y: 425, w: 86, label: 'WEB APP', sub: 'INTERNAL' },
  { id: 'erp', x: 935, y: 485, w: 86, label: 'ERP', sub: 'INTERNAL' },
];

const PATHS: Record<string, string> = {
  'user-identity': 'M151,270 L229,270',
  'identity-posture': 'M321,270 L349,270',
  'posture-policy': 'M441,270 L469,270',
  'policy-zia': 'M515,248 C515,200 600,205 600,152',
  'policy-zpa': 'M515,292 C515,340 600,335 600,388',
  'zia-internet': 'M675,130 L846,130',
  'zpa-conn': 'M675,410 C712,410 712,425 744,425',
  'conn-rdp': 'M836,425 C866,425 862,365 892,365',
  'conn-web': 'M836,425 L892,425',
  'conn-erp': 'M836,425 C866,425 862,485 892,485',
  'attacker-dc': 'M151,470 C380,548 610,548 733,505',
};

const CHIPS = [
  { id: 'tls', label: 'TLS', w: 36 },
  { id: 'url', label: 'URL', w: 36 },
  { id: 'fw', label: 'FW', w: 32 },
  { id: 'threat', label: 'THREAT', w: 56 },
];

type Status = 'ok' | 'info' | 'deny';
type Step =
  | { log: string; status: Status; wait?: number }
  | { move: string; deny?: boolean; reverse?: boolean }
  | { node: string; state: 'lit' | 'deny' }
  | { chip: string; state: 'lit' | 'deny' }
  | { burst: string; ok?: boolean }
  | { wall: true }
  | { verdict: 'ALLOW' | 'DENY' | 'BLOCKED' };

interface Scenario {
  id: string;
  title: string;
  sub: string;
  steps: Step[];
}

const handshake = (want: string): Step[] => [
  { node: 'user', state: 'lit' },
  { log: want, status: 'info' },
  { move: 'user-identity' },
  { node: 'identity', state: 'lit' },
];

const SCENARIOS: Scenario[] = [
  {
    id: 'rdp',
    title: 'RDP to a private server',
    sub: 'ZPA · app access',
    steps: [
      ...handshake('Client Connector: request rdp-host.corp:3389'),
      { log: 'Identity verified via IdP (SAML) — group: IT-Ops', status: 'ok' },
      { move: 'identity-posture' },
      { node: 'posture', state: 'lit' },
      { log: 'Device posture: managed, compliant', status: 'ok' },
      { move: 'posture-policy' },
      { node: 'policy', state: 'lit' },
      { log: "Access policy → app segment 'rdp-servers': ALLOW", status: 'ok' },
      { move: 'policy-zpa' },
      { node: 'zpa', state: 'lit' },
      { log: 'ZPA Public Service Edge brokers the session', status: 'info' },
      { log: 'App Connector already dialled out — zero inbound ports', status: 'info' },
      { move: 'zpa-conn' },
      { node: 'conn', state: 'lit' },
      { log: 'Inside-out tunnels stitched: user ↔ App Connector', status: 'ok' },
      { move: 'conn-rdp' },
      { node: 'rdp', state: 'lit' },
      { burst: 'rdp', ok: true },
      { log: 'Session established. User reached the app — never the network.', status: 'ok' },
      { verdict: 'ALLOW' },
    ],
  },
  {
    id: 'saas',
    title: 'Browse web & SaaS',
    sub: 'ZIA · inline inspection',
    steps: [
      ...handshake('Client Connector forwards web traffic to ZIA'),
      { log: 'Identity verified — policy follows the user, anywhere', status: 'ok' },
      { move: 'identity-posture' },
      { node: 'posture', state: 'lit' },
      { log: 'Device posture: managed', status: 'ok' },
      { move: 'posture-policy' },
      { node: 'policy', state: 'lit' },
      { log: 'URL & cloud app policy: category permitted', status: 'ok' },
      { move: 'policy-zia' },
      { node: 'zia', state: 'lit' },
      { chip: 'tls', state: 'lit' },
      { log: 'TLS inspection: decrypted, inspected, re-encrypted', status: 'ok', wait: 260 },
      { chip: 'url', state: 'lit' },
      { log: 'URL filtering: business category', status: 'ok', wait: 260 },
      { chip: 'fw', state: 'lit' },
      { log: 'Cloud firewall: allowed', status: 'ok', wait: 260 },
      { chip: 'threat', state: 'lit' },
      { log: 'Threat scan: clean', status: 'ok', wait: 260 },
      { move: 'zia-internet' },
      { node: 'internet', state: 'lit' },
      { burst: 'internet', ok: true },
      { log: 'Delivered — inspected, logged, allowed.', status: 'ok' },
      { verdict: 'ALLOW' },
    ],
  },
  {
    id: 'malware',
    title: 'Malicious download',
    sub: 'ZIA · threat prevention',
    steps: [
      ...handshake('User requests a file from an external site'),
      { log: 'Identity verified', status: 'ok' },
      { move: 'identity-posture' },
      { node: 'posture', state: 'lit' },
      { move: 'posture-policy' },
      { node: 'policy', state: 'lit' },
      { log: 'URL policy: category permitted', status: 'ok' },
      { move: 'policy-zia' },
      { node: 'zia', state: 'lit' },
      { move: 'zia-internet' },
      { node: 'internet', state: 'lit' },
      { log: 'Response inbound — inspecting payload', status: 'info' },
      { move: 'zia-internet', reverse: true, deny: true },
      { chip: 'tls', state: 'lit' },
      { log: 'TLS inspection: payload decrypted', status: 'ok', wait: 260 },
      { chip: 'url', state: 'lit' },
      { chip: 'fw', state: 'lit' },
      { chip: 'threat', state: 'deny' },
      { log: 'Threat engine verdict: MALICIOUS', status: 'deny' },
      { node: 'zia', state: 'deny' },
      { burst: 'zia' },
      { log: 'Blocked inline — the file never reached the endpoint.', status: 'deny' },
      { verdict: 'BLOCKED' },
    ],
  },
  {
    id: 'unmanaged',
    title: 'Unmanaged device',
    sub: 'posture check fails',
    steps: [
      ...handshake('Request: erp.corp from a personal laptop'),
      { log: 'Identity verified — credentials are valid', status: 'ok' },
      { move: 'identity-posture', deny: true },
      { node: 'posture', state: 'deny' },
      { log: 'Device posture: unmanaged — FAILED', status: 'deny' },
      { burst: 'posture' },
      { log: 'Access denied. Right password, wrong device. The app stays invisible.', status: 'deny' },
      { verdict: 'DENY' },
    ],
  },
  {
    id: 'attacker',
    title: 'External attacker scan',
    sub: 'no attack surface',
    steps: [
      { node: 'attacker', state: 'deny' },
      { log: 'Attacker scanning for exposed services…', status: 'info' },
      { move: 'attacker-dc', deny: true },
      { wall: true },
      { burst: 'wall' },
      { log: '0 inbound listeners. App Connectors only dial out.', status: 'deny' },
      { log: 'Nothing exposed, nothing to find, nothing to attack.', status: 'deny' },
      { verdict: 'BLOCKED' },
    ],
  },
];

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function initZeroTrust(onEvent?: (kind: 'allow' | 'deny') => void) {
  const host = document.getElementById('zt-diagram');
  const list = document.getElementById('zt-scenarios');
  const log = document.getElementById('zt-log');
  const verdictEl = document.getElementById('zt-verdict');
  if (!host || !list || !log || !verdictEl) return { autoplay: () => {} };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = el('svg', { viewBox: '0 0 1000 560', class: 'ztd', role: 'img', 'aria-label': 'Zero Trust connection diagram' }, host);

  // Zones
  el('rect', { x: 200, y: 40, width: 500, height: 440, rx: 16, class: 'zone' }, svg);
  const zl = el('text', { x: 222, y: 68, class: 'lbl-dim' }, svg);
  zl.textContent = 'ZERO TRUST EXCHANGE';
  el('rect', { x: 735, y: 300, width: 255, height: 240, rx: 14, class: 'zone zone--dc' }, svg);
  const dl = el('text', { x: 752, y: 326, class: 'lbl-dim' }, svg);
  dl.textContent = 'PRIVATE APPS · DC / CLOUD';

  // Wires
  const wires: Record<string, SVGPathElement> = {};
  for (const [id, d] of Object.entries(PATHS)) {
    wires[id] = el('path', { d, class: 'wire' }, svg);
  }
  // App Connector's persistent outbound connection to the broker.
  el('path', { d: 'M744,437 C712,437 712,422 675,422', class: 'tunnel' }, svg);

  // Inspection chips (part of ZIA)
  const chips: Record<string, SVGGElement> = {};
  let cx = 518;
  for (const c of CHIPS) {
    const g = el('g', { class: 'chip' }, svg);
    el('rect', { x: cx, y: 76, width: c.w, height: 18, rx: 4 }, g);
    const t = el('text', { x: cx + c.w / 2, y: 89, 'text-anchor': 'middle' }, g);
    t.textContent = c.label;
    chips[c.id] = g;
    cx += c.w + 6;
  }

  // Nodes
  const nodes: Record<string, SVGGElement> = {};
  for (const n of NODES) {
    const g = el('g', { class: `node${n.threat ? ' node--threat' : ''}` }, svg);
    el('rect', { x: n.x - n.w / 2, y: n.y - 22, width: n.w, height: 44, rx: 8 }, g);
    const a = el('text', { x: n.x, y: n.y - 2, 'text-anchor': 'middle', class: 'lbl-strong' }, g);
    a.textContent = n.label;
    const b = el('text', { x: n.x, y: n.y + 13, 'text-anchor': 'middle', class: 'lbl-dim' }, g);
    b.textContent = n.sub;
    nodes[n.id] = g;
  }
  const inet = el('g', { class: 'node' }, svg);
  el('circle', { cx: 882, cy: 130, r: 36, class: 'body' }, inet);
  const it = el('text', { x: 882, y: 127, 'text-anchor': 'middle', class: 'lbl-strong' }, inet);
  it.textContent = 'WEB';
  const it2 = el('text', { x: 882, y: 142, 'text-anchor': 'middle', class: 'lbl-dim' }, inet);
  it2.textContent = '& SaaS';
  nodes.internet = inet;

  const wall = el('line', { x1: 735, y1: 470, x2: 735, y2: 540, class: 'wall' }, svg);
  const packet = el('circle', { r: 6, class: 'packet', cx: 0, cy: 0, opacity: 0 }, svg);

  const centers: Record<string, [number, number]> = { internet: [882, 130], wall: [735, 505] };
  NODES.forEach((n) => (centers[n.id] = [n.x, n.y]));

  // ---------- runner ----------
  let run = 0;

  const reset = () => {
    Object.values(nodes).forEach((g) => g.classList.remove('is-lit', 'is-deny'));
    Object.values(chips).forEach((g) => g.classList.remove('is-lit', 'is-deny'));
    Object.values(wires).forEach((w) => w.classList.remove('is-lit', 'is-deny'));
    svg.querySelectorAll('.burst').forEach((b) => b.remove());
    gsap.killTweensOf(packet);
    gsap.set(wall, { opacity: 0 });
    gsap.set(packet, { opacity: 0 });
    log.innerHTML = '';
    setVerdict('RUNNING', 'run');
  };

  const setVerdict = (text: string, cls: string) => {
    verdictEl.textContent = text;
    verdictEl.className = `verdict ${cls}`;
  };

  const addLog = (text: string, status: Status) => {
    const li = document.createElement('li');
    li.className = status;
    const d = new Date();
    const ts = `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    li.innerHTML = `<span class="ts">${ts}</span><span class="st">${status === 'ok' ? 'OK' : status === 'deny' ? 'DENY' : 'INFO'}</span><span></span>`;
    (li.lastChild as HTMLElement).textContent = text;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    gsap.from(li, { opacity: 0, x: -8, duration: 0.3 });
  };

  const move = (id: string, deny = false, reverse = false) =>
    new Promise<void>((resolve) => {
      const path = wires[id];
      const len = path.getTotalLength();
      path.classList.add(deny ? 'is-deny' : 'is-lit');
      packet.classList.toggle('is-deny', deny);
      gsap.set(packet, { opacity: 1 });
      const state = { t: reverse ? 1 : 0 };
      gsap.to(state, {
        t: reverse ? 0 : 1,
        duration: reduced ? 0.01 : Math.max(0.35, len / 260),
        ease: 'power1.inOut',
        onUpdate: () => {
          const p = path.getPointAtLength(state.t * len);
          packet.setAttribute('cx', String(p.x));
          packet.setAttribute('cy', String(p.y));
          follow(p.x);
        },
        onComplete: () => resolve(),
      });
    });

  // On narrow screens the diagram scrolls sideways; keep the packet in view.
  const follow = (svgX: number) => {
    if (host.scrollWidth <= host.clientWidth + 4) return;
    const px = (svgX / 1000) * svg.getBoundingClientRect().width;
    host.scrollLeft += (px - host.clientWidth / 2 - host.scrollLeft) * 0.15;
  };

  const burst = (at: string, ok = false) => {
    const [x, y] = centers[at];
    const c = el('circle', { cx: x, cy: y, r: 8, class: `burst${ok ? ' ok' : ''}` }, svg);
    gsap.fromTo(c, { attr: { r: 8 }, opacity: 1 }, { attr: { r: 60 }, opacity: 0, duration: 0.9, ease: 'power2.out', onComplete: () => c.remove() });
    onEvent?.(ok ? 'allow' : 'deny');
  };

  async function play(s: Scenario) {
    const id = ++run;
    list!.querySelectorAll('.zt__btn').forEach((b) => b.classList.toggle('is-active', (b as HTMLElement).dataset.id === s.id));
    reset();
    for (const step of s.steps) {
      if (id !== run) return;
      if ('log' in step) {
        addLog(step.log, step.status);
        await wait(reduced ? 0 : (step.wait ?? 420));
      } else if ('move' in step) {
        await move(step.move, step.deny, step.reverse);
      } else if ('node' in step) {
        nodes[step.node]?.classList.add(step.state === 'lit' ? 'is-lit' : 'is-deny');
      } else if ('chip' in step) {
        chips[step.chip]?.classList.add(step.state === 'lit' ? 'is-lit' : 'is-deny');
      } else if ('burst' in step) {
        burst(step.burst, step.ok);
      } else if ('wall' in step) {
        gsap.to(wall, { opacity: 1, duration: 0.15, repeat: 3, yoyo: true });
        await wait(300);
        gsap.set(wall, { opacity: 1 });
      } else if ('verdict' in step) {
        setVerdict(step.verdict, step.verdict === 'ALLOW' ? 'allow' : 'deny');
        gsap.to(packet, { opacity: 0, duration: 0.6 });
      }
    }
  }

  // ---------- scenario buttons ----------
  const head = document.createElement('p');
  head.textContent = 'SCENARIOS';
  list.appendChild(head);
  for (const s of SCENARIOS) {
    const b = document.createElement('button');
    b.className = 'zt__btn';
    b.dataset.id = s.id;
    b.dataset.cursor = 'simulate';
    b.innerHTML = `<b></b><span></span>`;
    b.querySelector('b')!.textContent = s.title;
    b.querySelector('span')!.textContent = s.sub;
    b.addEventListener('click', () => play(s));
    list.appendChild(b);
  }

  let autoplayed = false;
  return {
    autoplay() {
      if (autoplayed) return;
      autoplayed = true;
      play(SCENARIOS[0]);
    },
  };
}
