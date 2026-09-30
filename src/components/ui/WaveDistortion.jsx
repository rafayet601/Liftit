/** Decorative colour wash with no animation loop or GPU requirement. */
export default function WaveDistortion({ preset = 'purple', opacity = 0.4, style, className }) {
  const color = preset === 'steel' ? '143,176,207' : preset === 'gold' ? '251,191,36' : '139,92,246';
  return <div aria-hidden="true" className={className} style={{ pointerEvents: 'none', background: `radial-gradient(ellipse at 80% 30%, rgba(${color},0.14), transparent 70%)`, opacity, ...style }} />;
}
