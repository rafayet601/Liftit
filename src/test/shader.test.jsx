import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import ShaderBackground from '../components/ui/ShaderBackground';

let frames, nextFrame, context, media;
function frame(time) {
    const callbacks = [...frames.values()]; frames.clear();
    act(() => callbacks.forEach(callback => callback(time)));
}
beforeEach(() => {
    frames = new Map(); nextFrame = 0;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.set(++nextFrame, callback); return nextFrame; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
    media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    context = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8 };
    for (const method of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'bindBuffer', 'bufferData', 'useProgram', 'enableVertexAttribArray', 'vertexAttribPointer', 'uniform1f', 'uniform2f', 'viewport', 'drawArrays', 'deleteBuffer', 'deleteShader', 'deleteProgram', 'getExtension']) context[method] = vi.fn();
    context.createShader = vi.fn(() => ({})); context.createProgram = vi.fn(() => ({})); context.createBuffer = vi.fn(() => ({}));
    context.getShaderParameter = vi.fn(() => true); context.getProgramParameter = vi.fn(() => true); context.getAttribLocation = vi.fn(() => 0); context.getUniformLocation = vi.fn(() => ({}));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Shader lifecycle', () => {
    it('survives StrictMode remounts, caps frames, and cancels work on unmount', () => {
        const view = render(<React.StrictMode><ShaderBackground variant="hero" /></React.StrictMode>);
        expect(context.getExtension).not.toHaveBeenCalled();
        expect(frames.size).toBe(1);
        frame(100); frame(110); frame(120); frame(150);
        expect(context.drawArrays).toHaveBeenCalledTimes(2);
        view.unmount();
        expect(frames.size).toBe(0);
        expect(context.deleteProgram).toHaveBeenCalledTimes(2);
    });
    it('uses a static fallback without starting WebGL for reduced motion', () => {
        media.matches = true;
        render(<ShaderBackground />);
        expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
        expect(frames.size).toBe(0);
    });
    it('hides a failed shader canvas, preserving the CSS fallback', () => {
        context.getShaderParameter.mockReturnValue(false);
        context.getShaderInfoLog = vi.fn(() => 'compile failed');
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = render(<ShaderBackground />);
        expect(view.container.querySelector('canvas')).toHaveStyle({ display: 'none' });
        expect(frames.size).toBe(0);
    });
    it('pauses while the document is hidden and resumes when visible', () => {
        render(<ShaderBackground />);
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        expect(frames.size).toBe(0);
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        expect(frames.size).toBe(1);
    });
});
