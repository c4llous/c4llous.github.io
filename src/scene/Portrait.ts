/**
 * "Hidden but identical": Ritesh's real silhouette, lit like a film still.
 * The outline is exactly him; the face sinks into shadow and only the sunglasses catch light.
 *
 * Raw WebGL (no three.js) so it can render the moment the boot screen lifts.
 */

export type PortraitMode = 'shadow' | 'thermal';

// Landmarks in public/ritesh-cutout.png (375×818), measured from the photo.
const FACE = { cx: 140, cy: 88, rx: 44, ry: 58 };
const LENS_L = { cx: 117, cy: 85, rx: 13.5, ry: 10 };
const LENS_R = { cx: 143, cy: 78.5, rx: 12, ry: 8.5 };
const LENS_TILT = -0.26;
/** Transparent margin (px) so glows can spill past the silhouette. */
const PAD = 90;

const COLORS = {
  uHot: '#ff3d6e',
  uFlame: '#ff7a1a',
  uViolet: '#8b5cf6',
  uCyan: '#22e1ff',
};

interface Prepared {
  w: number;
  h: number;
  image: HTMLCanvasElement;
  /** RGBA: R = alpha blurred ~2px, G = ~7px, B = ~26px. */
  blur: Uint8Array;
}

let prepared: Promise<Prepared> | null = null;

/** Decode the cutout once and derive the soft alpha fields every effect is built from. */
export function preparePortrait(src: string): Promise<Prepared> {
  prepared ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  }).then((img) => {
    const w = img.naturalWidth + PAD * 2;
    const h = img.naturalHeight + PAD * 2;
    const image = document.createElement('canvas');
    image.width = w;
    image.height = h;
    const c = image.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(img, PAD, PAD);
    const px = c.getImageData(0, 0, w, h).data;
    const alpha = new Float32Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3] / 255;
    const s = gaussianish(alpha, w, h, 2);
    const m = gaussianish(alpha, w, h, 7);
    const l = gaussianish(alpha, w, h, 26);
    const blur = new Uint8Array(w * h * 4);
    for (let i = 0; i < alpha.length; i++) {
      blur[i * 4] = s[i] * 255;
      blur[i * 4 + 1] = m[i] * 255;
      blur[i * 4 + 2] = Math.min(1, l[i] * 1.6) * 255;
      blur[i * 4 + 3] = 255;
    }
    return { w, h, image, blur };
  });
  return prepared;
}

/** Three box-blur passes per axis ≈ a gaussian. Plain JS, so it works where canvas filters don't. */
function gaussianish(src: Float32Array, w: number, h: number, r: number) {
  const a = src.slice();
  const b = new Float32Array(src.length);
  const inv = 1 / (2 * r + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc * inv;
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += b[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc * inv;
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImg;
uniform sampler2D uBlur;
uniform vec2 uTexel;
uniform vec2 uLight;
uniform float uTime;
uniform float uReveal;
uniform float uGlitch;
uniform float uMode;
uniform vec4 uFace;
uniform vec4 uLensL;
uniform vec4 uLensR;
uniform float uTilt;
uniform vec3 uHot;
uniform vec3 uFlame;
uniform vec3 uViolet;
uniform vec3 uCyan;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Soft ellipse mask; everything in texture pixels.
float ellipse(vec2 px, vec4 e, float tilt) {
  vec2 d = px - e.xy;
  float c = cos(tilt), s = sin(tilt);
  d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  return 1.0 - smoothstep(0.78, 1.0, length(d / e.zw));
}

// Aviator lens: a rounded-rectangle mask plus lens-local coordinates for the reflection.
vec3 lensAt(vec2 px, vec4 e, float tilt) {
  vec2 d = px - e.xy;
  float c = cos(tilt), s = sin(tilt);
  d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / e.zw;
  float r = pow(pow(abs(d.x), 3.0) + pow(abs(d.y), 3.0), 1.0 / 3.0);
  return vec3(d, 1.0 - smoothstep(0.8, 1.0, r));
}

vec3 thermal(float t) {
  t = clamp(t, 0.0, 1.0) * 6.0;
  if (t < 1.0) return mix(vec3(0.02, 0.01, 0.06), vec3(0.16, 0.04, 0.37), t);
  if (t < 2.0) return mix(vec3(0.16, 0.04, 0.37), vec3(0.54, 0.11, 0.62), t - 1.0);
  if (t < 3.0) return mix(vec3(0.54, 0.11, 0.62), vec3(0.93, 0.2, 0.43), t - 2.0);
  if (t < 4.0) return mix(vec3(0.93, 0.2, 0.43), vec3(1.0, 0.48, 0.1), t - 3.0);
  if (t < 5.0) return mix(vec3(1.0, 0.48, 0.1), vec3(1.0, 0.84, 0.3), t - 4.0);
  return mix(vec3(1.0, 0.84, 0.3), vec3(1.0, 0.98, 0.92), t - 5.0);
}

void main() {
  vec2 uv = vUv;

  // Glitch: shove horizontal slices sideways.
  float slice = floor(uv.y * 90.0);
  float tick = floor(uTime * 24.0);
  float g = step(0.72, hash(vec2(slice, tick))) * uGlitch;
  uv.x += (hash(vec2(slice * 1.7, tick)) - 0.5) * 0.07 * g;

  // Intro: a scanner beam paints the figure in from the top.
  float edge = mix(-0.06, 1.06, uReveal);
  float shown = smoothstep(edge + 0.012, edge - 0.012, uv.y);

  vec2 px = uv / uTexel;
  vec3 lensA = lensAt(px, uLensL, uTilt);
  vec3 lensB = lensAt(px, uLensR, uTilt);
  vec3 lensLocal = lensA.z > lensB.z ? lensA : lensB;
  float lens = lensLocal.z;
  vec3 col;
  float alpha;
  vec3 bl;

  if (uMode < 0.5) {
    vec4 img = texture2D(uImg, uv);
    float a = img.a;
    bl = texture2D(uBlur, uv).rgb;
    vec2 L = uLight;
    // Key rim on the edge facing the light (the cursor), a cooler fill rim opposite it.
    float keyThin = clamp(a - texture2D(uBlur, uv + L * uTexel * 4.0).r, 0.0, 1.0);
    float keyWide = clamp(bl.g - texture2D(uBlur, uv + L * uTexel * 15.0).g, 0.0, 1.0) * a;
    float fill = clamp(a - texture2D(uBlur, uv - L * uTexel * 5.0).r, 0.0, 1.0);
    float lum = dot(img.rgb, vec3(0.299, 0.587, 0.114));
    float face = ellipse(px, uFace, 0.0);
    // Low-key body: enough of the real photo to read clothes and gear; the face sinks into shadow.
    vec3 body = vec3(0.014, 0.011, 0.022) + img.rgb * pow(lum, 1.35) * 0.2 * (1.0 - face * 0.9);
    vec3 key = mix(uFlame, uHot, smoothstep(0.12, 0.8, uv.y));
    vec3 inner = body + key * (keyThin * 2.6 + keyWide * 0.9) + uCyan * fill * 1.25;

    // Sunglasses: the only part of the face that shows — a reflection and a sweeping glint.
    vec2 ax = uLensR.xy - uLensL.xy;
    float span = length(ax);
    ax /= span;
    vec2 rel = px - uLensL.xy;
    float along = dot(rel, ax) / span;
    float across = dot(rel, vec2(-ax.y, ax.x)) / span;
    float sweep = fract(uTime / 5.0) * 2.8 - 0.9;
    float glint = exp(-pow((along + across * 0.9 - sweep) * 6.0, 2.0));
    // Mirrored lenses: dark glass reflecting the warm backlight up top, a cool horizon line below.
    float ly = lensLocal.y;
    vec3 lensCol = vec3(0.02, 0.016, 0.03)
      + mix(uHot, uFlame, 0.35) * smoothstep(0.3, -0.95, ly) * 0.6
      + uCyan * exp(-pow((ly - 0.22) * 9.0, 2.0)) * 0.45
      + vec3(1.0) * glint * 1.3;
    inner = mix(inner, lensCol, lens * a);

    float halo = bl.b * (1.0 - a);
    col = inner * a + mix(uViolet, key, 0.55) * halo * 0.6;
    alpha = a;
  } else {
    // Thermal: a low-res sensor. Skin and the body core read hot, the lenses read cold.
    // Low-res sensor everywhere; a coarse mosaic over the face keeps it redacted.
    vec2 cell = uTexel * (ellipse(px, uFace, 0.0) > 0.25 ? 11.0 : 3.0);
    vec2 q = (floor(uv / cell) + 0.5) * cell;
    vec4 img = texture2D(uImg, q);
    float a = img.a;
    bl = texture2D(uBlur, q).rgb;
    float lum = dot(img.rgb, vec3(0.299, 0.587, 0.114));
    float skin = clamp((img.r - img.b) * 2.4, 0.0, 1.0) * smoothstep(0.2, 0.55, lum);
    float heat = 0.14 + 0.48 * skin + 0.38 * smoothstep(0.35, 1.0, bl.b) + 0.06 * lum;
    heat *= 1.0 - lens * 0.7;
    heat += (hash(q * 731.0 + tick) - 0.5) * 0.05;
    float halo = bl.b * (1.0 - a);
    col = thermal(heat) * a + thermal(0.3) * halo * 0.55;
    alpha = a;
  }

  float beam = exp(-pow((uv.y - edge) * 110.0, 2.0)) * step(0.001, uReveal) * step(uReveal, 0.999);
  col += mix(uHot, vec3(1.0, 0.85, 0.5), uMode) * beam * smoothstep(0.0, 0.15, bl.b) * 2.0;
  gl_FragColor = vec4(col * shown, alpha * shown);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export class Portrait {
  reveal = 1;
  glitch = 0;
  private gl: WebGLRenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private light = { x: 0.8, y: -0.4 };
  private pointer: { x: number; y: number } | null = null;
  private running = false;
  private raf = 0;
  private start = performance.now();

  static async create(canvas: HTMLCanvasElement, mode: PortraitMode, reduced: boolean) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const data = await preparePortrait('/ritesh-cutout.png');
    return new Portrait(canvas, gl, data, mode, reduced);
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    private data: Prepared,
    mode: PortraitMode,
    private reduced: boolean,
  ) {
    this.gl = gl;
    const prog = gl.createProgram()!;
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit: number, upload: () => void) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      upload();
    };
    texture(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.image));
    texture(1, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, data.w, data.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data.blur));

    for (const name of ['uImg', 'uBlur', 'uTexel', 'uLight', 'uTime', 'uReveal', 'uGlitch', 'uMode', 'uFace', 'uLensL', 'uLensR', 'uTilt', ...Object.keys(COLORS)]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    const e = (o: { cx: number; cy: number; rx: number; ry: number }) => [o.cx + PAD, o.cy + PAD, o.rx, o.ry] as const;
    gl.uniform1i(this.u.uImg, 0);
    gl.uniform1i(this.u.uBlur, 1);
    gl.uniform2f(this.u.uTexel, 1 / data.w, 1 / data.h);
    gl.uniform1f(this.u.uMode, mode === 'thermal' ? 1 : 0);
    gl.uniform4f(this.u.uFace, ...e(FACE));
    gl.uniform4f(this.u.uLensL, ...e(LENS_L));
    gl.uniform4f(this.u.uLensR, ...e(LENS_R));
    gl.uniform1f(this.u.uTilt, LENS_TILT);
    for (const [k, v] of Object.entries(COLORS)) gl.uniform3fv(this.u[k], hex(v));

    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? this.play() : this.pause())).observe(canvas);
    window.addEventListener('pointermove', (ev) => ev.pointerType !== 'touch' && (this.pointer = { x: ev.clientX, y: ev.clientY }), { passive: true });
    document.addEventListener('pointerleave', () => (this.pointer = null));
    this.resize();
  }

  /** The face's box in viewport coordinates — for the HUD reticle and the "access denied" hover. */
  faceRect() {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width / this.data.w;
    const sy = r.height / this.data.h;
    return {
      x: r.left + (FACE.cx + PAD - FACE.rx * 1.15) * sx,
      y: r.top + (FACE.cy + PAD - FACE.ry * 1.25) * sy,
      w: FACE.rx * 2.3 * sx,
      h: FACE.ry * 2.5 * sy,
    };
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (!this.running) this.draw();
  }

  private play() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private draw() {
    const gl = this.gl;
    const t = this.reduced ? 2.5 : (performance.now() - this.start) / 1000;

    // The light follows the cursor; without one it slowly orbits the figure.
    let tx: number, ty: number;
    if (this.pointer) {
      const r = this.canvas.getBoundingClientRect();
      tx = this.pointer.x - (r.left + r.width / 2);
      ty = this.pointer.y - (r.top + r.height * 0.32);
    } else {
      tx = Math.cos(t * 0.45);
      ty = Math.sin(t * 0.45) * 0.6 - 0.3;
    }
    const len = Math.hypot(tx, ty) || 1;
    this.light.x += (tx / len - this.light.x) * 0.08;
    this.light.y += (ty / len - this.light.y) * 0.08;
    const ll = Math.hypot(this.light.x, this.light.y) || 1;

    gl.uniform2f(this.u.uLight, this.light.x / ll, this.light.y / ll);
    gl.uniform1f(this.u.uTime, t);
    gl.uniform1f(this.u.uReveal, this.reveal);
    gl.uniform1f(this.u.uGlitch, this.glitch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
