"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import "./Prism.css";

type AnimationType = "rotate" | "hover" | "3drotate";
type PrismOffset = { x?: number; y?: number };
type Uniform<T> = { value: T };

export interface PrismProps {
  height?: number;
  baseWidth?: number;
  animationType?: AnimationType;
  glow?: number;
  offset?: PrismOffset;
  noise?: number;
  transparent?: boolean;
  scale?: number;
  hueShift?: number;
  colorFrequency?: number;
  hoverStrength?: number;
  inertia?: number;
  bloom?: number;
  suspendWhenOffscreen?: boolean;
  timeScale?: number;
  className?: string;
}

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec2  iResolution;
uniform float iTime;

uniform float uHeight;
uniform float uBaseHalf;
uniform mat3  uRot;
uniform int   uUseBaseWobble;
uniform float uGlow;
uniform vec2  uOffsetPx;
uniform float uNoise;
uniform float uSaturation;
uniform float uScale;
uniform float uHueShift;
uniform float uColorFreq;
uniform float uBloom;
uniform float uCenterShift;
uniform float uInvBaseHalf;
uniform float uInvHeight;
uniform float uMinAxis;
uniform float uPxScale;
uniform float uTimeScale;

vec4 tanh4(vec4 x){
  vec4 e2x = exp(2.0*x);
  return (e2x - 1.0) / (e2x + 1.0);
}

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

float sdOctaAnisoInv(vec3 p){
  vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
  float m = q.x + q.y + q.z - 1.0;
  return m * uMinAxis * 0.5773502691896258;
}

float sdPyramidUpInv(vec3 p){
  float oct = sdOctaAnisoInv(p);
  float halfSpace = -p.y;
  return max(oct, halfSpace);
}

mat3 hueRotation(float a){
  float c = cos(a), s = sin(a);
  mat3 W = mat3(
    0.299, 0.587, 0.114,
    0.299, 0.587, 0.114,
    0.299, 0.587, 0.114
  );
  mat3 U = mat3(
     0.701, -0.587, -0.114,
    -0.299,  0.413, -0.114,
    -0.300, -0.588,  0.886
  );
  mat3 V = mat3(
     0.168, -0.331,  0.500,
     0.328,  0.035, -0.500,
    -0.497,  0.296,  0.201
  );
  return W + U * c + V * s;
}

void main(){
  vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

  float z = 5.0;
  float d = 0.0;

  vec3 p;
  vec4 o = vec4(0.0);

  float centerShift = uCenterShift;
  float cf = uColorFreq;

  mat2 wob = mat2(1.0);
  if (uUseBaseWobble == 1) {
    float t = iTime * uTimeScale;
    float c0 = cos(t + 0.0);
    float c1 = cos(t + 33.0);
    float c2 = cos(t + 11.0);
    wob = mat2(c0, c1, c2, c0);
  }

  const int STEPS = 100;
  for (int i = 0; i < STEPS; i++) {
    p = vec3(f, z);
    p.xz = p.xz * wob;
    p = uRot * p;
    vec3 q = p;
    q.y += centerShift;
    d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
    z -= d;
    o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
  }

  o = tanh4(o * o * (uGlow * uBloom) / 1e5);

  vec3 col = o.rgb;
  float n = rand(gl_FragCoord.xy + vec2(iTime));
  col += (n - 0.5) * uNoise;
  col = clamp(col, 0.0, 1.0);

  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

  if(abs(uHueShift) > 0.0001){
    col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
  }

  gl_FragColor = vec4(col, o.a);
}
`;

export default function Prism({
  height = 3.5,
  baseWidth = 5.5,
  animationType: _animationType = "rotate",
  glow = 1,
  offset = { x: 0, y: 0 },
  noise = 0.5,
  transparent = true,
  scale = 3.6,
  hueShift = 0,
  colorFrequency = 1,
  hoverStrength: _hoverStrength = 2,
  inertia: _inertia = 0.05,
  bloom = 1,
  suspendWhenOffscreen: _suspendWhenOffscreen = false,
  timeScale: _timeScale = 0.5,
  className = "",
}: PrismProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mobileMedia = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const isMobile = mobileMedia.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.25);

    const H = Math.max(0.001, height);
    const baseHalf = Math.max(0.001, baseWidth) * 0.5;
    const offsetX = offset?.x ?? 0;
    const offsetY = offset?.y ?? 0;
    const saturation = transparent ? 1.5 : 1;
    const prismScale = Math.max(0.001, scale);
    const colorFreq = Math.max(0, colorFrequency || 1);

    const renderer = new Renderer({
      dpr,
      alpha: transparent,
      antialias: false,
      powerPreference: "low-power",
    } as ConstructorParameters<typeof Renderer>[0] & { powerPreference: WebGLPowerPreference });
    const gl = renderer.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    if (transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.disable(gl.BLEND);
    }

    const canvas = gl.canvas;
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    canvas.tabIndex = -1;
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    const iResolution = new Float32Array(2);
    const offsetPx = new Float32Array(2);
    const rot = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    const uniforms: {
      iResolution: Uniform<Float32Array>;
      iTime: Uniform<number>;
      uHeight: Uniform<number>;
      uBaseHalf: Uniform<number>;
      uUseBaseWobble: Uniform<number>;
      uRot: Uniform<Float32Array>;
      uGlow: Uniform<number>;
      uOffsetPx: Uniform<Float32Array>;
      uNoise: Uniform<number>;
      uSaturation: Uniform<number>;
      uScale: Uniform<number>;
      uHueShift: Uniform<number>;
      uColorFreq: Uniform<number>;
      uBloom: Uniform<number>;
      uCenterShift: Uniform<number>;
      uInvBaseHalf: Uniform<number>;
      uInvHeight: Uniform<number>;
      uMinAxis: Uniform<number>;
      uPxScale: Uniform<number>;
      uTimeScale: Uniform<number>;
    } = {
      iResolution: { value: iResolution },
      iTime: { value: 4.25 },
      uHeight: { value: H },
      uBaseHalf: { value: baseHalf },
      uUseBaseWobble: { value: 0 },
      uRot: { value: rot },
      uGlow: { value: Math.max(0, glow) },
      uOffsetPx: { value: offsetPx },
      uNoise: { value: Math.max(0, noise) },
      uSaturation: { value: saturation },
      uScale: { value: prismScale },
      uHueShift: { value: hueShift || 0 },
      uColorFreq: { value: colorFreq },
      uBloom: { value: Math.max(0, bloom || 1) },
      uCenterShift: { value: H * 0.25 },
      uInvBaseHalf: { value: 1 / baseHalf },
      uInvHeight: { value: 1 / H },
      uMinAxis: { value: Math.min(baseHalf, H) },
      uPxScale: { value: 1 },
      uTimeScale: { value: 0 },
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const renderStaticFrame = () => {
      uniforms.iTime.value = 4.25;
      uniforms.uUseBaseWobble.value = 0;
      uniforms.uTimeScale.value = 0;
      uniforms.uRot.value = rot;
      renderer.render({ scene: mesh });
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width || 1, rect.height || 1);
      iResolution[0] = gl.drawingBufferWidth;
      iResolution[1] = gl.drawingBufferHeight;
      offsetPx[0] = offsetX * dpr;
      offsetPx[1] = offsetY * dpr;
      uniforms.uPxScale.value = 1 / ((gl.drawingBufferHeight || 1) * 0.1 * prismScale);
      renderStaticFrame();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    renderStaticFrame();

    return () => {
      resizeObserver.disconnect();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
      program.remove();
      geometry.remove();
      const maybeDestroy = renderer as Renderer & { destroy?: () => void };
      maybeDestroy.destroy?.();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    height,
    baseWidth,
    glow,
    offset?.x,
    offset?.y,
    noise,
    transparent,
    scale,
    hueShift,
    colorFrequency,
    bloom,
  ]);

  return (
    <div
      ref={containerRef}
      className={`prism-container ${className}`}
      aria-hidden="true"
      role="presentation"
    />
  );
}

export function AuthenticatedPrismBackground() {
  const pathname = usePathname();

  if (pathname?.startsWith("/payment")) {
    return null;
  }

  return (
    <div className="sx-app-prism-background" aria-hidden="true" role="presentation">
      <div className="sx-app-prism-surface">
        <Prism
          animationType="rotate"
          height={3.3}
          baseWidth={5.8}
          scale={4.8}
          hueShift={-0.22}
          colorFrequency={0.8}
          noise={0.14}
          glow={0.5}
          bloom={0.55}
          offset={{ x: 180, y: -60 }}
          transparent
          timeScale={0.12}
        />
      </div>
    </div>
  );
}
