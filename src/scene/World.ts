import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import type { FormationName } from '../content';
import { buildFormations, type Formation } from './formations';

const BG = 0x050507;

const particleVert = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColFrom;
  attribute vec3 aColTo;
  attribute float aSeed;

  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uSizeMul;
  uniform float uPixelRatio;
  uniform float uVelocity;
  uniform float uGlitch;
  uniform float uRise;
  uniform vec3 uMouse;
  uniform float uMouseOn;
  uniform vec3 uShock;
  uniform float uShockT;

  varying vec3 vColor;
  varying float vAlpha;

  float easeInOut(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    // Staggered morph: every particle leaves at a slightly different moment.
    float t = clamp(uMix * 1.6 - aSeed * 0.6, 0.0, 1.0);
    float e = easeInOut(t);
    vec3 p = mix(aFrom, aTo, e);

    // Mid-flight turbulence — the storm between formations.
    float storm = sin(e * 3.14159);
    p += storm * vec3(
      sin(aSeed * 91.0 + uTime * 1.3),
      cos(aSeed * 53.0 + uTime * 1.1),
      sin(aSeed * 27.0 + uTime * 0.9)
    ) * (1.2 + aSeed * 1.6);

    // Embers: drift upward and wrap around, fading at both ends of the climb.
    float riseFade = 1.0;
    if (uRise > 0.001) {
      float f = fract(aSeed * 17.31 + uTime * (0.02 + aSeed * 0.045));
      p.y += uRise * (f - 0.5) * 11.0;
      p.x += uRise * sin(uTime * 0.7 + aSeed * 40.0) * 0.2;
      riseFade = mix(1.0, smoothstep(0.0, 0.15, f) * smoothstep(1.0, 0.72, f), uRise);
    }

    // Idle breathing + scroll-velocity agitation.
    float v = clamp(uVelocity, -40.0, 40.0);
    float agitation = 0.022 + min(abs(v) * 0.007, 0.22);
    p += agitation * vec3(sin(uTime * 0.9 + aSeed * 40.0), cos(uTime * 0.8 + aSeed * 31.0), sin(uTime * 0.7 + aSeed * 17.0));
    p.y += v * 0.0025 * (aSeed - 0.5) * 6.0;

    // Cursor repulsion.
    vec2 d = p.xy - uMouse.xy;
    float force = smoothstep(1.05, 0.0, length(d)) * uMouseOn;
    p.xy += normalize(d + 0.0001) * force * 0.38;
    p.z += force * 0.6;

    // Click shockwave.
    vec2 sd = p.xy - uShock.xy;
    float band = exp(-pow((length(sd) - uShockT * 7.0) * 1.6, 2.0)) * exp(-uShockT * 1.4);
    p.xy += normalize(sd + 0.0001) * band * 0.9;
    p.z += band * 1.2;

    // Horizontal glitch slices.
    float slice = floor(p.y * 7.0);
    float tick = floor(uTime * 14.0);
    float g = step(0.86, hash(slice * 13.1 + tick)) * uGlitch;
    p.x += g * (hash(slice + tick * 1.7) - 0.5) * 0.9;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uSizeMul * uPixelRatio * (0.55 + aSeed * 0.9) * (10.0 / -mv.z);

    vec3 col = mix(aColFrom, aColTo, e);
    col += g * vec3(1.0, 0.2, 0.45) * 0.6;
    col += force * vec3(1.0, 0.45, 0.6) * 0.35;
    vColor = col;
    vAlpha = (0.72 + storm * 0.2) * riseFade;
  }
`;

const particleFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
  }
`;

const finalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.001 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * (uAberration + r2 * 0.008);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= 1.0 - r2 * 0.9;                                    // vignette
      col += (rand(vUv * 1000.0 + uTime) - 0.5) * 0.012;         // a whisper of grain against banding
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

interface Layout {
  size: number;
  /** Amplitude of a side-to-side sway, for flat formations that read badly edge-on. */
  sway: number;
  /** 0..1 — how strongly particles drift upward (embers). */
  rise: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  spin: number;
}

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private finalPass: ShaderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private group = new THREE.Group();
  private points!: THREE.Points;
  private material!: THREE.ShaderMaterial;
  private formations!: Record<FormationName, Formation>;
  private current: FormationName = 'dust';
  private side: 'right' | 'center' = 'right';
  private mixTween: gsap.core.Tween | null = null;
  private timer = new THREE.Timer();
  private mouseNdc = new THREE.Vector2(0, 0);
  private mouseSmooth = new THREE.Vector2(0, 0);
  private mouseActive = false;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private spin = 0;
  private sway = 0;
  private layout: Layout = { size: 1, sway: 0, rise: 0, x: 0, y: 0, scale: 1, opacity: 1, spin: 0 };
  private velocity = 0;
  private running = true;
  private count: number;
  private isSmall: boolean;
  private reducedMotion: boolean;

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    this.reducedMotion = opts.reducedMotion;
    this.isSmall = window.innerWidth < 820 || matchMedia('(pointer: coarse)').matches;
    this.count = this.isSmall ? 14000 : 26000;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(BG, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isSmall ? 1.5 : 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    this.scene.add(this.group);

    if (!this.isSmall) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.45, 0.14);
      this.composer.addPass(this.bloom);
      this.finalPass = new ShaderPass(finalShader);
      this.composer.addPass(this.finalPass);
      this.composer.addPass(new OutputPass());
    }

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('pointerleave', () => (this.mouseActive = false));
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) this.timer.update();
    });
  }

  get particleCount() {
    return this.count;
  }

  async init() {
    // The `</>` formation is rasterised from Geist Mono. The font CSS loads without blocking
    // render, so wait (briefly) for it.
    await Promise.race([fontsReady().then(() => document.fonts.load('600 100px "Geist Mono"')), wait(1500)]).catch(() => {});
    this.formations = await buildFormations(this.count);
    this.buildPoints();
    this.renderer.setAnimationLoop(this.tick);
  }

  private buildPoints() {
    const n = this.count;
    const geo = new THREE.BufferGeometry();
    const start = this.formations.dust;
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(start.pos), 3));
    geo.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(start.pos), 3));
    geo.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(start.pos), 3));
    geo.setAttribute('aColFrom', new THREE.BufferAttribute(new Float32Array(start.col), 3));
    geo.setAttribute('aColTo', new THREE.BufferAttribute(new Float32Array(start.col), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMix: { value: 1 },
        uTime: { value: 0 },
        uSize: { value: this.isSmall ? 3.2 : 2.6 },
        uSizeMul: { value: 1 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uOpacity: { value: 1 },
        uVelocity: { value: 0 },
        uGlitch: { value: 0 },
        uRise: { value: 0 },
        uMouse: { value: new THREE.Vector3(99, 99, 0) },
        uMouseOn: { value: 0 },
        uShock: { value: new THREE.Vector3(99, 99, 0) },
        uShockT: { value: 10 },
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  /** Visible width of the z=0 plane, in world units. */
  private viewWidth() {
    const h = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return h * this.camera.aspect;
  }

  private layoutFor(name: FormationName, side: 'right' | 'center'): Layout {
    const wide = this.camera.aspect > 1.05;
    const vw = this.viewWidth();
    const x = side === 'right' && wide ? Math.min(vw * 0.24, 4.6) : 0;
    const base: Layout = { size: 1, sway: 0, rise: 0, x, y: 0, scale: 1, opacity: 1, spin: 0.12 };
    if (name === 'embers') return { ...base, x: wide ? Math.min(vw * 0.08, 1.6) : 0, spin: 0, rise: 1, size: 1.25, opacity: 0.9 };
    if (name === 'dust') return { ...base, x: 0, spin: 0.02, opacity: 0.7 };
    // Centered formations sit behind dense UI, so they recede into the background.
    if (side === 'center') return { ...base, x: 0, scale: 1.35, opacity: 0.32, spin: 0.06 };
    const flat = name === 'code' || name === 'shield' || name === 'neural';
    const shape = flat ? { ...base, spin: 0, sway: 0.5 } : base;
    if (!wide) return { ...shape, scale: 0.72, y: 1.1, opacity: 0.55 };
    return shape;
  }

  morphTo(name: FormationName, side: 'right' | 'center' = 'right', duration = 2.2) {
    if (!this.formations) return;
    this.side = side;
    const layout = this.layoutFor(name, side);
    if (name === this.current) {
      this.applyLayout(layout, duration * 0.6);
      return;
    }
    const geo = this.points.geometry;
    const from = geo.getAttribute('aFrom') as THREE.BufferAttribute;
    const to = geo.getAttribute('aTo') as THREE.BufferAttribute;
    const cFrom = geo.getAttribute('aColFrom') as THREE.BufferAttribute;
    const cTo = geo.getAttribute('aColTo') as THREE.BufferAttribute;
    const seeds = geo.getAttribute('aSeed').array as Float32Array;
    const m = this.material.uniforms.uMix.value as number;

    // Snapshot where every particle is right now so interrupted morphs don't jump.
    const fa = from.array as Float32Array, ta = to.array as Float32Array;
    const fc = cFrom.array as Float32Array, tc = cTo.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const t = Math.min(1, Math.max(0, m * 1.6 - seeds[i] * 0.6));
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        fa[j] = fa[j] + (ta[j] - fa[j]) * e;
        fc[j] = fc[j] + (tc[j] - fc[j]) * e;
      }
    }
    const target = this.formations[name];
    ta.set(target.pos);
    tc.set(target.col);
    from.needsUpdate = to.needsUpdate = cFrom.needsUpdate = cTo.needsUpdate = true;

    this.current = name;
    this.material.uniforms.uMix.value = 0;
    this.mixTween?.kill();
    this.mixTween = gsap.to(this.material.uniforms.uMix, {
      value: 1,
      duration: this.reducedMotion ? 0.01 : duration,
      ease: 'power1.inOut',
    });
    this.glitch(0.5);
    this.applyLayout(layout, duration);
  }

  private applyLayout(l: Layout, duration: number) {
    const d = this.reducedMotion ? 0.01 : duration;
    if (l.spin === 0) {
      const rest = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
      gsap.to(this, { spin: rest, duration: d, ease: 'power2.inOut' });
    }
    this.layout = { ...l };
    const u = this.material.uniforms;
    gsap.to(this, { sway: l.sway, duration: d, ease: 'power2.inOut' });
    gsap.to(this.group.position, { x: l.x, y: l.y, duration: d, ease: 'power3.inOut' });
    gsap.to(this.group.scale, { x: l.scale, y: l.scale, z: l.scale, duration: d, ease: 'power3.inOut' });
    gsap.to(u.uOpacity, { value: l.opacity, duration: d });
    gsap.to(u.uSizeMul, { value: l.size, duration: d });
    gsap.to(u.uRise, { value: this.reducedMotion ? 0 : l.rise, duration: d });
  }

  glitch(strength = 1) {
    if (this.reducedMotion || !this.material) return;
    gsap.fromTo(this.material.uniforms.uGlitch, { value: strength }, { value: 0, duration: 0.45, ease: 'steps(6)' });
  }

  shockwave(clientX: number, clientY: number) {
    if (!this.material) return;
    const p = this.screenToLocal(clientX, clientY);
    if (!p) return;
    this.material.uniforms.uShock.value.copy(p);
    this.material.uniforms.uShockT.value = 0;
    this.glitch(0.35);
  }

  setVelocity(v: number) {
    this.velocity = THREE.MathUtils.clamp(v, -60, 60);
  }

  private screenToLocal(clientX: number, clientY: number) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    return this.points.worldToLocal(hit);
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.mouseActive = true;
    this.mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  };

  private onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w, h);
    if (this.formations) this.applyLayout(this.layoutFor(this.current, this.side), 0.6);
  };

  private tick = () => {
    if (!this.running) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uShockT.value = Math.min(u.uShockT.value + dt, 10);
    // Lenis only reports velocity on scroll events, so let it bleed off between them.
    this.velocity *= Math.exp(-dt * 5);
    u.uVelocity.value += (this.velocity - u.uVelocity.value) * 0.1;

    // Smoothed cursor → local-space repulsion point.
    this.mouseSmooth.lerp(this.mouseNdc, 0.08);
    const targetOn = this.mouseActive && !this.reducedMotion ? 1 : 0;
    u.uMouseOn.value += (targetOn - u.uMouseOn.value) * 0.06;
    if (this.mouseActive) {
      this.raycaster.setFromCamera(this.mouseNdc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.plane, hit)) u.uMouse.value.copy(this.points.worldToLocal(hit));
    }

    if (!this.reducedMotion) this.spin += dt * this.layout.spin;
    this.group.rotation.y = this.spin + Math.sin(t * 0.35) * this.sway + this.mouseSmooth.x * 0.32;
    this.group.rotation.x = -this.mouseSmooth.y * 0.12;

    // Gentle camera drift.
    this.camera.position.x = Math.sin(t * 0.1) * 0.25;
    this.camera.position.y = Math.cos(t * 0.13) * 0.15;
    this.camera.lookAt(0, 0, 0);

    if (this.composer && this.finalPass) {
      this.finalPass.uniforms.uTime.value = t;
      this.finalPass.uniforms.uAberration.value = 0.0008 + Math.min(Math.abs(u.uVelocity.value) * 0.00025, 0.006);
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fontsReady() {
  const link = document.getElementById('fonts-css') as HTMLLinkElement | null;
  if (!link || link.media === 'all') return Promise.resolve();
  return new Promise<void>((resolve) => link.addEventListener('load', () => resolve(), { once: true }));
}
