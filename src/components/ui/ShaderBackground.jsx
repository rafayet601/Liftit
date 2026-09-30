import { useEffect, useRef, useState } from 'react';
import { compileShader, linkProgram, createQuadBuffer, cleanupWebGL } from '../../lib/webgl-utils';

const VERTEX = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
const FRAGMENT = /* glsl */`
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_hero;
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    float t = u_time;
    vec3 violet = vec3(0.61, 0.39, 1.0);
    vec3 cyan = vec3(0.22, 0.82, 1.0);
    vec3 color = mix(vec3(0.025, 0.025, 0.047), vec3(0.055, 0.036, 0.10), uv.x);
    vec2 p = (uv - vec2(0.76, 0.52)) * vec2(aspect, 1.0);
    float radius = length(p);
    float halo = exp(-radius * radius * 5.0);
    color += mix(violet, cyan, uv.y) * halo * mix(0.05, 0.10, u_hero);
    for (int i = 0; i < 4; i++) {
        float n = float(i);
        float line = 0.43 + 0.13 * sin(uv.x * 5.4 + t * 0.24 + n * 0.48)
                          + 0.055 * cos(uv.x * 12.0 - t * 0.18 + n * 0.7);
        float distance = abs(uv.y - line - n * 0.035);
        float thread = exp(-distance * 220.0);
        float glow = exp(-distance * 26.0);
        float mask = smoothstep(0.04, 0.75, uv.x);
        color += mix(violet, cyan, n / 3.0) * (thread * 0.45 + glow * 0.045) * mask;
    }
    float angle = atan(p.y, p.x);
    float arc = pow(0.5 + 0.5 * cos(angle - t * 0.20), 6.0);
    float ring = exp(-abs(radius - 0.29) * 110.0);
    color += mix(violet, cyan, arc) * ring * (0.10 + arc * 0.35) * u_hero;
    vec2 grid = abs(fract(uv * vec2(24.0 * aspect, 24.0)) - 0.5);
    float mesh = max(smoothstep(0.48, 0.50, grid.x), smoothstep(0.48, 0.50, grid.y));
    color += cyan * mesh * 0.015 * smoothstep(0.2, 0.9, uv.x);
    float vignette = 1.0 - 0.45 * length(uv - 0.5);
    gl_FragColor = vec4(color * vignette, 1.0);
}`;

/** Decorative energy field: bounded resolution, 24 fps hero / 12 fps ambient.
 * Static CSS remains when motion is reduced, WebGL fails or context is lost.
 */
export default function ShaderBackground({ variant = 'ambient', className = '' }) {
    const canvasRef = useRef(null);
    const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const change = () => setReduced(preference.matches);
        preference.addEventListener('change', change);
        return () => preference.removeEventListener('change', change);
    }, []);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let gl, vs, fs, prog, buf, resizeObserver, intersectionObserver, raf, timeLocation;
        let visible = true, disposed = false, last = -Infinity;
        const boot = performance.now();
        const cleanup = () => {
            if (disposed) return;
            disposed = true;
            canvas.style.display = 'none';
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();
            intersectionObserver?.disconnect();
            document.removeEventListener('visibilitychange', sync);
            motion.removeEventListener('change', sync);
            canvas.removeEventListener('webglcontextlost', lost);
            if (gl) cleanupWebGL(gl, { vs, fs, prog, buf });
        };
        const draw = (timestamp) => {
            if (disposed || !visible || document.hidden || motion.matches || !prog) return;
            if (timestamp - last >= 1000 / (variant === 'hero' ? 24 : 12)) {
                last = timestamp;
                gl.useProgram(prog);
                gl.uniform1f(timeLocation, (timestamp - boot) / 1000);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            raf = requestAnimationFrame(draw);
        };
        function sync() {
            cancelAnimationFrame(raf);
            canvas.style.opacity = motion.matches ? '0' : '';
            if (!disposed && visible && !document.hidden && !motion.matches && prog) raf = requestAnimationFrame(draw);
        }
        function lost(event) {
            event.preventDefault();
            canvas.style.display = 'none';
            cleanup();
        }
        try {
            // Avoid creating a GPU context at all for an initial reduced-motion preference.
            if (motion.matches) return;
            gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
            if (!gl) return;
            vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX, 'Energy field');
            fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT, 'Energy field');
            if (!vs || !fs) { cleanup(); return; }
            prog = linkProgram(gl, vs, fs, 'Energy field');
            if (!prog) { cleanup(); return; }
            buf = createQuadBuffer(gl);
            if (!buf) { cleanup(); return; }
            gl.useProgram(prog);
            timeLocation = gl.getUniformLocation(prog, 'u_time');
            const position = gl.getAttribLocation(prog, 'a_position');
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_hero'), variant === 'hero' ? 1 : 0);
            const resize = () => {
                const width = canvas.parentElement.clientWidth, height = canvas.parentElement.clientHeight;
                const scale = Math.min(1, (variant === 'hero' ? 900 : 1100) / Math.max(width, height, 1));
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), canvas.width, canvas.height);
                last = -Infinity;
            };
            resize();
            resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(canvas);
            if (typeof IntersectionObserver !== 'undefined') {
                intersectionObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; sync(); });
                intersectionObserver.observe(canvas);
            }
            document.addEventListener('visibilitychange', sync);
            motion.addEventListener('change', sync);
            canvas.addEventListener('webglcontextlost', lost);
            canvas.style.display = 'block';
            sync();
        } catch {
            canvas.style.display = 'none';
            cleanup();
        }
        return cleanup;
    }, [variant, reduced]);
    return <div aria-hidden="true" className={`shader-field shader-field--${variant} ${className}`}><canvas ref={canvasRef} /></div>;
}
