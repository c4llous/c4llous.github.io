import * as THREE from 'three';
import type { FormationName } from '../content';

/**
 * Every formation is the same N particles arranged differently.
 * Particle i in one formation flies to particle i in the next, which is
 * what produces the swirling morph between chapters.
 */

export interface Formation {
  pos: Float32Array;
  col: Float32Array;
}

type V3 = [number, number, number];
type Rand = () => number;
type Gen = (r: Rand, k: number) => [V3, V3];

const HOT: V3 = [1.0, 0.24, 0.43];
const CYAN: V3 = [0.13, 0.88, 1.0];
const WHITE: V3 = [1.0, 0.96, 0.97];
const DEEP: V3 = [0.2, 0.08, 0.42];
const FLAME: V3 = [1.0, 0.48, 0.1];
const VIOLET: V3 = [0.55, 0.36, 0.96];

function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

function rotate(p: V3, rx: number, ry: number, rz = 0): V3 {
  let [x, y, z] = p;
  let c = Math.cos(rx), s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry); s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rz); s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

/** Split N particles across weighted parts, each producing [position, color]. */
function compose(n: number, seed: number, parts: { w: number; gen: Gen }[]): Formation {
  const r = mulberry32(seed);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const total = parts.reduce((s, p) => s + p.w, 0);
  let i = 0;
  parts.forEach((part, pi) => {
    const count = pi === parts.length - 1 ? n - i : Math.round((part.w / total) * n);
    for (let k = 0; k < count && i < n; k++, i++) {
      const [p, c] = part.gen(r, k);
      pos.set(p, i * 3);
      col.set(c, i * 3);
    }
  });
  return shuffle(pos, col, n, seed + 7);
}

/** Shuffle particle order so morphs between formations look like a storm, not a slide. */
function shuffle(pos: Float32Array, col: Float32Array, n: number, seed: number): Formation {
  const r = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const p2 = new Float32Array(n * 3);
  const c2 = new Float32Array(n * 3);
  idx.forEach((from, to) => {
    p2.set(pos.subarray(from * 3, from * 3 + 3), to * 3);
    c2.set(col.subarray(from * 3, from * 3 + 3), to * 3);
  });
  return { pos: p2, col: c2 };
}

// ---------- shared part generators ----------

const dustGen = (spread = 1, dim = 0.35): Gen => (r) => [
  [(r() - 0.5) * 26 * spread, (r() - 0.5) * 16 * spread, -12 + r() * 14],
  scale(mix(DEEP, r() < 0.5 ? VIOLET : CYAN, r()), dim + r() * 0.25),
];

function segmentGen(segs: [V3, V3][], color: (r: Rand) => V3, jitter = 0.02): Gen {
  const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  const total = lens.reduce((s, l) => s + l, 0);
  const cdf: number[] = [];
  lens.reduce((acc, l) => (cdf.push((acc + l) / total), acc + l), 0);
  return (r) => {
    // Binary search the length CDF so long segments get proportionally more particles.
    const u = r();
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    const [a, b] = segs[lo];
    const t = r();
    return [
      [
        a[0] + (b[0] - a[0]) * t + (r() - 0.5) * jitter,
        a[1] + (b[1] - a[1]) * t + (r() - 0.5) * jitter,
        a[2] + (b[2] - a[2]) * t + (r() - 0.5) * jitter,
      ],
      color(r),
    ];
  };
}

function edgesOf(geo: THREE.BufferGeometry): [V3, V3][] {
  const e = new THREE.EdgesGeometry(geo);
  const a = e.attributes.position.array as Float32Array;
  const out: [V3, V3][] = [];
  for (let i = 0; i < a.length; i += 6) {
    out.push([[a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]]]);
  }
  e.dispose();
  geo.dispose();
  return out;
}

/** Rasterise a 2D drawing and return filled pixel coords in world units, centred. */
function rasterPoints(w: number, h: number, worldH: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  draw(c);
  const data = c.getImageData(0, 0, w, h).data;
  const s = worldH / h;
  const pts: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push((x - w / 2) * s, (h / 2 - y) * s);
    }
  }
  return { pts, px: s };
}

function rasterGen(raster: { pts: number[]; px: number }, depth: number, color: (r: Rand) => V3, bend = 0): Gen {
  const count = raster.pts.length / 2;
  return (r) => {
    const i = Math.floor(r() * count) * 2;
    const x = raster.pts[i] + (r() - 0.5) * raster.px;
    const y = raster.pts[i + 1] + (r() - 0.5) * raster.px;
    return [[x, y, (r() - 0.5) * depth - bend * x * x], color(r)];
  };
}

function sphereGen(c: V3, radius: number, color: (r: Rand) => V3, shell = false): Gen {
  return (r) => {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const rr = shell ? radius : radius * Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    return [[c[0] + rr * s * Math.cos(th), c[1] + rr * u, c[2] + rr * s * Math.sin(th)], color(r)];
  };
}

// ---------- formations ----------

function dust(n: number): Formation {
  return compose(n, 11, [{ w: 1, gen: dustGen(1, 0.45) }]);
}

/** Warm sparks rising behind the hero figure (the shader adds the upward drift). */
function embers(n: number): Formation {
  return compose(n, 13, [
    {
      w: 0.78,
      gen: (r) => {
        // Concentrated behind the figure, thinning toward the edges of the frame.
        const x = (r() + r() + r() + r() - 2) * 3.4;
        const k = r();
        const col = k < 0.45 ? FLAME : k < 0.82 ? HOT : VIOLET;
        return [[x, (r() - 0.5) * 9, -6.5 + r() * 6], scale(col, 0.35 + r() * 0.65)];
      },
    },
    { w: 0.22, gen: dustGen(1, 0.18) },
  ]);
}

function code(n: number): Formation {
  const glyph = rasterPoints(900, 360, 3.6, (c) => {
    c.fillStyle = '#fff';
    c.font = '600 300px "Geist Mono", ui-monospace, Menlo, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('</>', 450, 190);
  });
  // A wall of "source code" behind the glyph: indented rows of tokens.
  const r = mulberry32(21);
  const segs: [V3, V3][] = [];
  const rows = 16;
  let indent = 0;
  for (let i = 0; i < rows; i++) {
    const y = 3.0 - i * 0.4;
    indent = Math.max(0, Math.min(4, indent + (r() < 0.35 ? 1 : r() < 0.5 ? -1 : 0)));
    let x = -3.6 + indent * 0.45;
    const tokens = 1 + Math.floor(r() * 5);
    for (let t = 0; t < tokens && x < 3.4; t++) {
      const len = 0.25 + r() * 1.1;
      segs.push([[x, y, -1.6], [Math.min(3.6, x + len), y, -1.6]]);
      x += len + 0.18;
    }
  }
  return compose(n, 21, [
    { w: 0.52, gen: rasterGen(glyph, 0.5, (rr) => mix(HOT, WHITE, rr() * 0.6)) },
    { w: 0.36, gen: segmentGen(segs, (rr) => scale(mix(CYAN, HOT, rr() * 0.3), 0.45 + rr() * 0.25), 0.05) },
    { w: 0.12, gen: dustGen(0.8, 0.3) },
  ]);
}

function stack(n: number): Formation {
  const tilt = (p: V3): V3 => rotate(p, 0.55, Math.PI / 4);
  const plane = (y: number, size: number, color: V3, grid: number): Gen => (r) => {
    const onLine = r() < 0.78;
    const half = size / 2;
    let x: number, z: number;
    if (onLine) {
      const t = (r() - 0.5) * size;
      const g = (Math.floor(r() * (grid + 1)) / grid - 0.5) * size;
      [x, z] = r() < 0.5 ? [t, g] : [g, t];
    } else {
      x = (r() - 0.5) * size;
      z = (r() - 0.5) * size;
    }
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    return [tilt([x, y, z]), scale(color, onLine ? 0.9 : 0.3 + edge * 0.2)];
  };
  const cylinder: Gen = (r) => {
    const a = r() * Math.PI * 2;
    const k = r();
    const y = k < 0.3 ? -1.9 : k < 0.6 ? -2.9 : -1.9 - r();
    const rad = 1.55;
    return [tilt([Math.cos(a) * rad, y, Math.sin(a) * rad]), scale(WHITE, k < 0.6 ? 0.85 : 0.45)];
  };
  const streams: Gen = (r) => {
    const cx = [-1.4, 1.4][Math.floor(r() * 2)];
    const cz = [-1.4, 1.4][Math.floor(r() * 2)];
    return [tilt([cx * 0.6, -1.9 + r() * 3.8, cz * 0.6]), scale(HOT, 0.7)];
  };
  return compose(n, 31, [
    { w: 0.22, gen: plane(1.9, 3.4, CYAN, 6) },
    { w: 0.22, gen: plane(0.65, 3.4, HOT, 6) },
    { w: 0.18, gen: plane(-0.6, 3.4, mix(HOT, CYAN, 0.5), 4) },
    { w: 0.22, gen: cylinder },
    { w: 0.08, gen: streams },
    { w: 0.08, gen: dustGen(0.8, 0.3) },
  ]);
}

function lattice(n: number): Formation {
  const segs: [V3, V3][] = [];
  const links: [V3, V3][] = [];
  const sp = 1.45, half = 0.36;
  const centers: V3[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) centers.push([i * sp, j * sp, k * sp]);
  const cube = new THREE.BoxGeometry(half * 2, half * 2, half * 2);
  const ce = edgesOf(cube);
  for (const c of centers) {
    for (const [a, b] of ce) segs.push([[a[0] + c[0], a[1] + c[1], a[2] + c[2]], [b[0] + c[0], b[1] + c[1], b[2] + c[2]]]);
    for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as V3[]) {
      const o: V3 = [c[0] + d[0] * sp, c[1] + d[1] * sp, c[2] + d[2] * sp];
      if (Math.max(...o.map(Math.abs)) <= sp + 0.01) {
        links.push([[c[0] + d[0] * half, c[1] + d[1] * half, c[2] + d[2] * half], [o[0] - d[0] * half, o[1] - d[1] * half, o[2] - d[2] * half]]);
      }
    }
  }
  const tilt = (g: Gen): Gen => (r, k) => {
    const [p, c] = g(r, k);
    return [rotate(p, 0.5, 0.65), c];
  };
  return compose(n, 41, [
    { w: 0.6, gen: tilt(segmentGen(segs, (r) => mix(CYAN, WHITE, r() * 0.5), 0.03)) },
    { w: 0.28, gen: tilt(segmentGen(links, (r) => scale(HOT, 0.6 + r() * 0.3), 0.02)) },
    { w: 0.12, gen: dustGen(0.8, 0.3) },
  ]);
}

function globe(n: number): Formation {
  const R = 2.55;
  const r0 = mulberry32(51);
  const onSphere = (lat: number, lon: number, rad = R): V3 => [
    rad * Math.cos(lat) * Math.cos(lon),
    rad * Math.sin(lat),
    rad * Math.cos(lat) * Math.sin(lon),
  ];
  const arcs: [V3, V3][] = [];
  for (let i = 0; i < 16; i++) {
    const a: [number, number] = [(r0() - 0.5) * 2.4, r0() * Math.PI * 2];
    const b: [number, number] = [(r0() - 0.5) * 2.4, a[1] + (r0() - 0.5) * 2.6];
    const steps = 40;
    let prev = onSphere(...a);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const lift = R * (1 + 0.28 * Math.sin(Math.PI * t));
      const cur = onSphere(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, lift);
      arcs.push([prev, cur]);
      prev = cur;
    }
  }
  const tilt = (p: V3): V3 => rotate(p, 0.35, 0, 0.18);
  return compose(n, 51, [
    {
      w: 0.42,
      gen: (r) => {
        const lonLine = r() < 0.5;
        const lat = lonLine ? (r() - 0.5) * Math.PI : (Math.floor(r() * 9) / 8 - 0.5) * Math.PI * 0.9;
        const lon = lonLine ? Math.floor(r() * 18) * (Math.PI / 9) : r() * Math.PI * 2;
        return [tilt(onSphere(lat, lon)), scale(CYAN, 0.45 + r() * 0.25)];
      },
    },
    { w: 0.14, gen: (r) => [tilt(onSphere(Math.asin(r() * 2 - 1), r() * Math.PI * 2)), scale(WHITE, 0.4 + r() * 0.3)] },
    { w: 0.26, gen: (r, k) => { const [p, c] = segmentGen(arcs, (rr) => mix(HOT, WHITE, rr() * 0.4), 0.015)(r, k); return [tilt(p), c]; } },
    {
      w: 0.1,
      gen: (r) => {
        const a = r() * Math.PI * 2;
        return [rotate([Math.cos(a) * 3.5, (r() - 0.5) * 0.04, Math.sin(a) * 3.5], 1.2, 0, -0.3), scale(HOT, 0.6)];
      },
    },
    { w: 0.08, gen: dustGen(0.8, 0.3) },
  ]);
}

function shield(n: number): Formation {
  const W = 520, H = 560, worldH = 5.8;
  const shieldPath = () => {
    const p = new Path2D();
    p.moveTo(260, 30);
    p.lineTo(470, 105);
    p.bezierCurveTo(470, 320, 380, 455, 260, 525);
    p.bezierCurveTo(140, 455, 50, 320, 50, 105);
    p.closePath();
    return p;
  };
  const outline = rasterPoints(W, H, worldH, (c) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 12;
    c.stroke(shieldPath());
    c.lineWidth = 3;
    c.save();
    c.translate(260, 285);
    c.scale(0.86, 0.86);
    c.translate(-260, -285);
    c.stroke(shieldPath());
    c.restore();
  });
  const fill = rasterPoints(W, H, worldH, (c) => {
    c.fillStyle = '#fff';
    c.fill(shieldPath());
  });
  const lock = rasterPoints(W, H, worldH, (c) => {
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    c.lineWidth = 22;
    c.beginPath();
    c.arc(260, 250, 52, Math.PI, 0);
    c.lineTo(312, 280);
    c.moveTo(208, 280);
    c.lineTo(208, 250);
    c.stroke();
    c.beginPath();
    c.roundRect(185, 270, 150, 120, 16);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(260, 318, 17, 0, Math.PI * 2);
    c.fill();
    c.fillRect(252, 322, 16, 40);
  });
  return compose(n, 61, [
    { w: 0.42, gen: rasterGen(outline, 0.25, (r) => mix(HOT, WHITE, r() * 0.5), 0.06) },
    { w: 0.16, gen: rasterGen(fill, 0.8, (r) => scale(mix(DEEP, CYAN, r()), 0.4 + r() * 0.2), 0.06) },
    { w: 0.32, gen: rasterGen(lock, 0.35, (r) => mix(WHITE, CYAN, r() * 0.4), 0.06) },
    { w: 0.1, gen: dustGen(0.8, 0.3) },
  ]);
}

/** Zero Trust: a brokering core, segmented rings, isolated apps — connected only through the core. */
function rings(n: number): Formation {
  const ringDefs = [
    { rad: 1.45, segs: 6, rx: 1.25, rz: 0.1 },
    { rad: 2.3, segs: 9, rx: 1.05, rz: -0.35 },
    { rad: 3.15, segs: 12, rx: 1.35, rz: 0.4 },
  ];
  const nodes: V3[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    nodes.push(rotate([Math.cos(a) * 3.15, 0, Math.sin(a) * 3.15], 1.35, 0, 0.4));
  }
  return compose(n, 71, [
    { w: 0.14, gen: sphereGen([0, 0, 0], 0.62, (r) => mix(HOT, WHITE, 0.3 + r() * 0.7)) },
    {
      w: 0.5,
      gen: (r) => {
        const ring = ringDefs[Math.floor(r() * ringDefs.length)];
        const seg = Math.floor(r() * ring.segs);
        const span = (Math.PI * 2) / ring.segs;
        const a = seg * span + r() * span * 0.8;
        const rad = ring.rad + (r() - 0.5) * 0.06;
        return [rotate([Math.cos(a) * rad, (r() - 0.5) * 0.05, Math.sin(a) * rad], ring.rx, 0, ring.rz), scale(CYAN, 0.55 + r() * 0.35)];
      },
    },
    { w: 0.16, gen: (r) => sphereGen(nodes[Math.floor(r() * nodes.length)], 0.16, () => FLAME)(r, 0) },
    {
      w: 0.12,
      gen: (r) => {
        const nd = nodes[Math.floor(r() * nodes.length)];
        // Dashed spokes: every app is reachable only via the core, never from another app.
        const t = (2 * Math.floor(r() * 7) + r()) / 14;
        return [scale(nd, 0.2 + t * 0.72), scale(HOT, 0.7)];
      },
    },
    { w: 0.08, gen: dustGen(0.8, 0.3) },
  ]);
}

function neural(n: number): Formation {
  const layers = [4, 6, 7, 6, 3];
  const nodes: V3[][] = layers.map((count, li) => {
    const x = (li - (layers.length - 1) / 2) * 1.4;
    return Array.from({ length: count }, (_, i) => {
      const y = (i - (count - 1) / 2) * 0.82;
      return [x, y, Math.sin(li * 1.3 + i) * 0.4] as V3;
    });
  });
  const edges: [V3, V3][] = [];
  for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push([a, b]);
  const flat = nodes.flat();
  return compose(n, 81, [
    { w: 0.34, gen: (r) => sphereGen(flat[Math.floor(r() * flat.length)], 0.17, (rr) => mix(HOT, WHITE, rr() * 0.6))(r, 0) },
    { w: 0.52, gen: segmentGen(edges, (r) => scale(mix(CYAN, HOT, r()), 0.35 + r() * 0.25), 0.02) },
    { w: 0.14, gen: dustGen(0.8, 0.3) },
  ]);
}

function blueprint(n: number): Formation {
  const outer = edgesOf(new THREE.IcosahedronGeometry(2.5, 0));
  const inner = edgesOf(new THREE.OctahedronGeometry(1.25, 0));
  const grid: [V3, V3][] = [];
  for (let i = -3; i <= 3; i++) {
    grid.push([[i, -3.0, -3], [i, -3.0, 3]]);
    grid.push([[-3, -3.0, i], [3, -3.0, i]]);
  }
  const tilt = (g: Gen): Gen => (r, k) => {
    const [p, c] = g(r, k);
    return [rotate(p, 0.25, 0.4), c];
  };
  return compose(n, 91, [
    { w: 0.36, gen: tilt(segmentGen(outer, (r) => mix(CYAN, WHITE, r() * 0.6), 0.02)) },
    { w: 0.16, gen: tilt(segmentGen(inner, (r) => mix(HOT, WHITE, r() * 0.4), 0.02)) },
    { w: 0.08, gen: tilt(sphereGen([0, 0, 0], 0.32, () => FLAME)) },
    { w: 0.16, gen: tilt(segmentGen(grid, (r) => scale(CYAN, 0.16 + r() * 0.14), 0.01)) },
    { w: 0.24, gen: dustGen(0.8, 0.3) },
  ]);
}

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

/** Builds every formation, yielding between each so the boot animation never stalls. */
export async function buildFormations(n: number): Promise<Record<FormationName, Formation>> {
  const builders: [FormationName, () => Formation][] = [
    ['dust', () => dust(n)],
    ['embers', () => embers(n)],
    ['code', () => code(n)],
    ['stack', () => stack(n)],
    ['lattice', () => lattice(n)],
    ['globe', () => globe(n)],
    ['shield', () => shield(n)],
    ['rings', () => rings(n)],
    ['neural', () => neural(n)],
    ['blueprint', () => blueprint(n)],
  ];
  const out = {} as Record<FormationName, Formation>;
  for (const [name, build] of builders) {
    out[name] = build();
    await yieldToMain();
  }
  return out;
}
