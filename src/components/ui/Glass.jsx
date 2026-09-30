import clsx from 'clsx';

/** Shared, opaque surfaces keep training data legible on every platform. */
export default function Glass({
  tint = 'neutral', blur: _blur, radius = 16, padded = true,
  hover = false, glow: _glow, wave: _wave, wavePreset: _wavePreset,
  gradientBorder: _gradientBorder, gradientPreset: _gradientPreset,
  className, style, children, as: As = 'div', ...rest
}) {
  return (
    <As className={clsx('training-panel', `training-panel-${tint}`, padded && 'p-5 md:p-6', hover && 'training-panel-hover', className)}
      style={{ borderRadius: radius, ...style }} {...rest}>
      {children}
    </As>
  );
}
