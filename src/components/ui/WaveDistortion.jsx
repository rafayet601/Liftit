import { useEffect, useRef } from 'react';
import { compileShader, linkProgram, createQuadBuffer, resizeCanvas, cleanupWebGL } from '../../lib/webgl-utils';

const VERT = /* glsl */`
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = /* glsl */`
precision mediump float;

uniform float u_time;
uniform vec2  u_resolution;
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_speed;
uniform vec3  u_color1;
uniform vec3  u_color2;
uniform float u_opacity;

float wave(vec2 uv, float freq, float amp, float t) {
  float w = 0.0;
  w += sin(uv.x * freq * 1.0 + t * 1.0) * amp * 0.5;
  w += sin(uv.x * freq * 2.3 + t * 1.4 + 1.7) * amp * 0.3;
  w += sin(uv.x * freq * 4.1 + t * 0.8 + 3.2) * amp * 0.15;
  w += sin(uv.x * freq * 0.7 + t * 1.8 + 5.1) * amp * 0.25;
  return w;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = uv;
  st.x *= aspect;

  float t = u_time * u_speed;

  float w1 = wave(st, u_frequency, u_amplitude, t);
  float w2 = wave(st + vec2(0.5, 0.3), u_frequency * 0.8, u_amplitude * 0.7, t * 1.2 + 2.0);
  float w3 = wave(st + vec2(1.2, -0.4), u_frequency * 1.3, u_amplitude * 0.5, t * 0.7 + 4.5);

  float combined = w1 + w2 * 0.6 + w3 * 0.3;

  float band1 = smoothstep(0.0, 0.02, abs(uv.y - 0.5 - combined));
  float band2 = smoothstep(0.0, 0.035, abs(uv.y - 0.5 - combined * 0.8 - w2 * 0.3));
  float band3 = smoothstep(0.0, 0.05, abs(uv.y - 0.5 - combined * 0.6 + w3 * 0.2));

  float line1 = 1.0 - band1;
  float line2 = (1.0 - band2) * 0.6;
  float line3 = (1.0 - band3) * 0.35;

  float glow1 = exp(-abs(uv.y - 0.5 - combined) * 12.0) * 0.4;
  float glow2 = exp(-abs(uv.y - 0.5 - combined * 0.8 - w2 * 0.3) * 8.0) * 0.25;

  vec3 col = vec3(0.0);
  col += u_color1 * line1;
  col += mix(u_color1, u_color2, 0.5) * line2;
  col += u_color2 * line3;
  col += u_color1 * glow1;
  col += u_color2 * glow2;

  float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);
  edgeFade *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);

  float pulse = 0.85 + 0.15 * sin(t * 0.5);
  col *= edgeFade * pulse * u_opacity;

  gl_FragColor = vec4(col, length(col) * 0.8);
}
`;

const PRESETS = {
  purple: { color1: [0.545, 0.361, 0.965], color2: [0.655, 0.545, 0.980] },
  steel: { color1: [0.56, 0.69, 0.81], color2: [0.72, 0.80, 0.89] },
  aurora: { color1: [0.545, 0.361, 0.965], color2: [0.56, 0.69, 0.81] },
  gold: { color1: [0.98, 0.75, 0.14], color2: [1.0, 0.83, 0.30] },
};

export default function WaveDistortion({
  preset = 'aurora',
  color1,
  color2,
  amplitude = 0.12,
  frequency = 3.0,
  speed = 0.6,
  opacity = 1.0,
  className,
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let gl, vs, fs, prog, buf, ro, raf;

    /* Hide the canvas if WebGL init / shader compilation fails — an uncleared
       buffer can paint a white wash over the hero card on headless or
       GPU-blocklisted stacks. The styled card behind it stays intact. */
    const bail = () => {
      canvas.style.display = 'none';
    };

    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: true, depth: false, premultipliedAlpha: false });
      if (!gl) return bail();

      vs = compileShader(gl, gl.VERTEX_SHADER, VERT, 'WaveDistortion');
      fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG, 'WaveDistortion');
      if (!vs || !fs) return bail();

      prog = linkProgram(gl, vs, fs, 'WaveDistortion');
      if (!prog) return bail();

      buf = createQuadBuffer(gl);
      if (!buf) return bail();

      const aPos = gl.getAttribLocation(prog, 'a_pos');
      const uTime = gl.getUniformLocation(prog, 'u_time');
      const uRes = gl.getUniformLocation(prog, 'u_resolution');
      const uAmp = gl.getUniformLocation(prog, 'u_amplitude');
      const uFreq = gl.getUniformLocation(prog, 'u_frequency');
      const uSpeed = gl.getUniformLocation(prog, 'u_speed');
      const uCol1 = gl.getUniformLocation(prog, 'u_color1');
      const uCol2 = gl.getUniformLocation(prog, 'u_color2');
      const uOpa = gl.getUniformLocation(prog, 'u_opacity');

      const p = PRESETS[preset] || PRESETS.aurora;
      const c1 = color1 || p.color1;
      const c2 = color2 || p.color2;

      const resize = () => resizeCanvas(gl, canvas);
      resize();

      ro = new ResizeObserver(resize);
      ro.observe(canvas);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const t0 = performance.now();

      const render = () => {
        raf = requestAnimationFrame(render);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(uTime, (performance.now() - t0) / 1000);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uAmp, amplitude);
        gl.uniform1f(uFreq, frequency);
        gl.uniform1f(uSpeed, speed);
        gl.uniform3fv(uCol1, c1);
        gl.uniform3fv(uCol2, c2);
        gl.uniform1f(uOpa, opacity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      render();
    } catch (e) {
      console.warn('[WaveDistortion] WebGL init failed:', e);
      bail();
      return;
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (gl) cleanupWebGL(gl, { buf, vs, fs, prog });
    };
  }, [preset, amplitude, frequency, speed, opacity, color1, color2]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{
        pointerEvents: 'none',
        display: 'block',
        ...style,
      }}
    />
  );
}
