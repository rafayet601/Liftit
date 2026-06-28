export function compileShader(gl, type, src, label = 'WebGL') {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn(`[${label}] Shader compile error:`, gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
    }
    return s;
}

export function linkProgram(gl, vs, fs, label = 'WebGL') {
    const p = gl.createProgram();
    if (!p) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn(`[${label}] Program link error:`, gl.getProgramInfoLog(p));
        gl.deleteProgram(p);
        return null;
    }
    return p;
}

export function cleanupWebGL(gl, resources) {
    if (resources.buf) gl.deleteBuffer(resources.buf);
    if (resources.vs) gl.deleteShader(resources.vs);
    if (resources.fs) gl.deleteShader(resources.fs);
    if (resources.prog) gl.deleteProgram(resources.prog);
    try {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
    } catch (_) {}
}

export function createQuadBuffer(gl) {
    const buf = gl.createBuffer();
    if (!buf) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );
    return buf;
}

export function resizeCanvas(gl, canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(canvas.offsetWidth * dpr);
    canvas.height = Math.floor(canvas.offsetHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
}
