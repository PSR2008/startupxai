"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import "./Galaxy.css";

type Vec2 = readonly [number, number];
type Uniform<T> = { value: T };

export interface GalaxyProps extends React.HTMLAttributes<HTMLDivElement> {
  focal?: Vec2;
  rotation?: Vec2;
  starSpeed?: number;
  density?: number;
  hueShift?: number;
  disableAnimation?: boolean;
  speed?: number;
  mouseInteraction?: boolean;
  glowIntensity?: number;
  saturation?: number;
  mouseRepulsion?: boolean;
  repulsionStrength?: number;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  autoCenterRepulsion?: number;
  transparent?: boolean;
  dpr?: number;
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform bool uTransparent;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + vec2(float(x), float(y));
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);

      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      float star = Star(gv - offset - pad, flareSize);
      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;

      col += star * size * base;
    }
  }

  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;
  vec2 mouseNorm = uMouse - vec2(0.5);

  if (uAutoCenterRepulsion > 0.0) {
    float centerDist = length(uv);
    vec2 repulsion = normalize(uv) * (uAutoCenterRepulsion / (centerDist + 0.1));
    uv += repulsion * 0.05;
  } else if (uMouseRepulsion) {
    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
    float mouseDist = length(uv - mousePosUV);
    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
    uv += repulsion * 0.05 * uMouseActiveFactor;
  } else {
    vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
    uv += mouseOffset;
  }

  float autoRotAngle = uTime * uRotationSpeed;
  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
  uv = autoRot * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }

  if (uTransparent) {
    float alpha = length(col);
    alpha = smoothstep(0.0, 0.3, alpha);
    alpha = min(alpha, 1.0);
    gl_FragColor = vec4(col, alpha);
  } else {
    gl_FragColor = vec4(col, 1.0);
  }
}
`;

export default function Galaxy({
  focal = [0.5, 0.5],
  rotation = [1.0, 0.0],
  starSpeed = 0.5,
  density = 1,
  hueShift = 140,
  disableAnimation = false,
  speed = 1.0,
  mouseInteraction = true,
  glowIntensity = 0.3,
  saturation = 0.0,
  mouseRepulsion = true,
  repulsionStrength = 2,
  twinkleIntensity = 0.3,
  rotationSpeed = 0.1,
  autoCenterRepulsion = 0,
  transparent = true,
  dpr,
  className = "",
  ...rest
}: GalaxyProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetMousePos = useRef({ x: 0.5, y: 0.5 });
  const smoothMousePos = useRef({ x: 0.5, y: 0.5 });
  const targetMouseActive = useRef(0);
  const smoothMouseActive = useRef(0);
  const reducedMotionRef = useRef(false);
  const shouldRenderRef = useRef(true);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    shouldRenderRef.current = !document.hidden;

    const renderer = new Renderer({
      dpr: dpr ?? Math.min(window.devicePixelRatio || 1, 1.5),
      alpha: transparent,
      premultipliedAlpha: false,
      antialias: true,
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    canvas.tabIndex = -1;

    if (transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(0, 0, 0, 1);
    }

    const uniforms: {
      uTime: Uniform<number>;
      uResolution: Uniform<[number, number, number]>;
      uFocal: Uniform<Float32Array>;
      uRotation: Uniform<Float32Array>;
      uStarSpeed: Uniform<number>;
      uDensity: Uniform<number>;
      uHueShift: Uniform<number>;
      uSpeed: Uniform<number>;
      uMouse: Uniform<Float32Array>;
      uGlowIntensity: Uniform<number>;
      uSaturation: Uniform<number>;
      uMouseRepulsion: Uniform<boolean>;
      uTwinkleIntensity: Uniform<number>;
      uRotationSpeed: Uniform<number>;
      uRepulsionStrength: Uniform<number>;
      uMouseActiveFactor: Uniform<number>;
      uAutoCenterRepulsion: Uniform<number>;
      uTransparent: Uniform<boolean>;
    } = {
      uTime: { value: 0 },
      uResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      uFocal: { value: new Float32Array(focal) },
      uRotation: { value: new Float32Array(rotation) },
      uStarSpeed: { value: 0 },
      uDensity: { value: density },
      uHueShift: { value: hueShift },
      uSpeed: { value: reducedMotionRef.current ? speed * 0.08 : speed },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uGlowIntensity: { value: glowIntensity },
      uSaturation: { value: saturation },
      uMouseRepulsion: { value: mouseRepulsion },
      uTwinkleIntensity: { value: reducedMotionRef.current ? 0 : twinkleIntensity },
      uRotationSpeed: { value: reducedMotionRef.current ? 0 : rotationSpeed },
      uRepulsionStrength: { value: repulsionStrength },
      uMouseActiveFactor: { value: 0 },
      uAutoCenterRepulsion: { value: autoCenterRepulsion },
      uTransparent: { value: transparent },
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
    container.appendChild(canvas);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1)];
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      targetMousePos.current = {
        x: (event.clientX - rect.left) / Math.max(rect.width, 1),
        y: 1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
      };
      targetMouseActive.current = 1;
    };

    const handlePointerLeave = () => {
      targetMouseActive.current = 0;
    };

    let pointerListenersAttached = false;
    const attachPointerListeners = () => {
      if (pointerListenersAttached || !mouseInteraction || reducedMotionRef.current) return;
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerleave", handlePointerLeave);
      pointerListenersAttached = true;
    };
    const detachPointerListeners = () => {
      if (!pointerListenersAttached) return;
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
      pointerListenersAttached = false;
    };
    attachPointerListeners();

    const onVisibilityChange = () => {
      shouldRenderRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        shouldRenderRef.current = entry.isIntersecting && !document.hidden;
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(container);

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      uniforms.uSpeed.value = event.matches ? speed * 0.08 : speed;
      uniforms.uTwinkleIntensity.value = event.matches ? 0 : twinkleIntensity;
      uniforms.uRotationSpeed.value = event.matches ? 0 : rotationSpeed;
      uniforms.uMouseActiveFactor.value = 0;
      if (event.matches) detachPointerListeners();
      else attachPointerListeners();
    };
    media.addEventListener("change", onMotionChange);

    const render = (time: number) => {
      frameRef.current = requestAnimationFrame(render);
      if (disableAnimation || reducedMotionRef.current) {
        uniforms.uTime.value = 0.001;
        uniforms.uStarSpeed.value = 0;
      } else {
        const seconds = time * 0.001;
        uniforms.uTime.value = seconds;
        uniforms.uStarSpeed.value = (seconds * starSpeed) / 10;
      }

      const lerpFactor = reducedMotionRef.current ? 1 : 0.05;
      smoothMousePos.current.x += (targetMousePos.current.x - smoothMousePos.current.x) * lerpFactor;
      smoothMousePos.current.y += (targetMousePos.current.y - smoothMousePos.current.y) * lerpFactor;
      smoothMouseActive.current += (targetMouseActive.current - smoothMouseActive.current) * lerpFactor;
      uniforms.uMouse.value[0] = smoothMousePos.current.x;
      uniforms.uMouse.value[1] = smoothMousePos.current.y;
      uniforms.uMouseActiveFactor.value = reducedMotionRef.current ? 0 : smoothMouseActive.current;

      if (shouldRenderRef.current) {
        renderer.render({ scene: mesh });
      }
    };
    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      detachPointerListeners();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      media.removeEventListener("change", onMotionChange);
      intersectionObserver.disconnect();
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
    focal,
    rotation,
    starSpeed,
    density,
    hueShift,
    disableAnimation,
    speed,
    mouseInteraction,
    glowIntensity,
    saturation,
    mouseRepulsion,
    repulsionStrength,
    twinkleIntensity,
    rotationSpeed,
    autoCenterRepulsion,
    transparent,
    dpr,
  ]);

  return (
    <div
      ref={containerRef}
      className={`galaxy-container ${className}`}
      aria-hidden="true"
      role="presentation"
      {...rest}
    />
  );
}
