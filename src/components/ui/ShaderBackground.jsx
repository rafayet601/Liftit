import { useEffect, useRef } from 'react';
import { compileShader, linkProgram, createQuadBuffer, resizeCanvas, cleanupWebGL } from '../../lib/webgl-utils';

/**
 * ShaderBackground — full-screen fixed WebGL canvas with an animated
 * domain-warped FBM mesh gradient. Paints slowly morphing deep-purple /
 * steel-blue hues at very low opacity over a near-black base, creating
 * organic depth without competing with foreground content.
 *
 * Falls back gracefully (renders nothing) when WebGL is unavailable.
 */

const VERT_SRC = /* glsl */`
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_SRC = /* glsl */`
precision mediump float;

uniform float u_time;
uniform vec2  u_resolution;

/* ---- compact smooth noise ---- */
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2  shift = vec2(100.0);
  mat2  rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p  = rot * p * 2.1 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  /* aspect-correct UV */
  vec2 st = uv;
  st.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.07;

  /* Domain warp: two layers of fbm drive the lookup of a third */
  vec2 q = vec2(fbm(st + vec2(t * 0.6, t * 0.4)),
                fbm(st + vec2(3.14, 1.57) + vec2(-t * 0.3, t * 0.5)));

  vec2 r = vec2(fbm(st + 3.0 * q + vec2(1.7, 9.2) + vec2(t * 0.15, 0.0)),
                fbm(st + 3.0 * q + vec2(8.3, 2.8) + vec2(0.0, t * 0.2)));

  float f = fbm(st + 3.5 * r);

  /* Colour blend: deep purple <-> steel blue */
  vec3 purple = vec3(0.545, 0.361, 0.965);
  vec3 steel  = vec3(0.56, 0.69, 0.81);
  vec3 mid    = vec3(0.45, 0.25, 0.85);

  vec3 col = mix(purple, mid,   clamp(f * 2.0,       0.0, 1.0));
      col  = mix(col,    steel, clamp(f * 2.0 - 1.0, 0.0, 1.0));

  /* Scale brightness to a very low opacity layer (4-9 %) */
  float brightness = f * 0.10 + 0.02;
  col *= brightness;

  /* Slow pulsing centre glow */
  vec2  centre     = vec2(0.5);
  float dist       = length(uv - centre);
  float glow       = 0.04 * (0.55 + 0.45 * sin(t * 1.3)) * smoothstep(0.75, 0.0, dist);
  col += glow * mix(purple, steel, sin(t * 0.7) * 0.5 + 0.5);

  /* Vignette — darken edges */
  float vign = smoothstep(1.35, 0.35, dist * 1.6);
  col *= vign;

  /* Subtle scan-line-style horizontal banding (very faint) */
  float band = 1.0 - 0.012 * abs(sin(uv.y * u_resolution.y * 0.5));
  col *= band;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl, vert, frag, program, buf, ro, rafId;

    /* If WebGL init or shader compilation fails, hide the canvas. It's an
       alpha:false (opaque) layer at z-index -1, and on headless / GPU-blocklisted
       stacks an uncleared buffer can paint solid white over the carbon body.
       Hiding it lets the dark body show through instead of a white screen. */
    const bail = () => {
      canvas.style.display = 'none';
    };

    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
      if (!gl) {
        console.warn('[ShaderBG] WebGL not supported — background disabled.');
        return bail();
      }

      vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC, 'ShaderBG');
      frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC, 'ShaderBG');
      if (!vert || !frag) return bail();

      program = linkProgram(gl, vert, frag, 'ShaderBG');
      if (!program) return bail();

      buf = createQuadBuffer(gl);
      if (!buf) return bail();

      const posLoc = gl.getAttribLocation(program, 'a_position');
      const timeLoc = gl.getUniformLocation(program, 'u_time');
      const resLoc  = gl.getUniformLocation(program, 'u_resolution');

      const resize = () => resizeCanvas(gl, canvas);
      resize();

      ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const start = performance.now();

      const render = () => {
        rafId = requestAnimationFrame(render);

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(timeLoc, (performance.now() - start) / 1000);
        gl.uniform2f(resLoc,  canvas.width, canvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      render();
    } catch (e) {
      console.warn('[ShaderBG] WebGL init failed:', e);
      bail();
      return;
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      if (gl) cleanupWebGL(gl, { buf, vs: vert, fs: frag, prog: program });
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width:  '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block',
        /* Dark base so the carbon theme holds even when WebGL is unavailable
           (older Android WebViews, GPU blocklists, iOS low-power mode). Without
           it the canvas is non-dark and backdrop-filter blurs glass surfaces
           into unreadable white. */
        background: '#0b0b0c',
      }}
    />
  );
}
