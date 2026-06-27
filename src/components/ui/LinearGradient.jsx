import clsx from 'clsx';

const PRESETS = {
  purple: {
    stops: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
    glow: 'rgba(139,92,246,0.3)',
  },
  steel: {
    stops: ['#8fb0cf', '#a0bed9', '#b7cde2'],
    glow: 'rgba(143,176,207,0.25)',
  },
  aurora: {
    stops: ['#8b5cf6', '#fbbf24', '#8fb0cf', '#c084fc', '#8b5cf6'],
    glow: 'rgba(139,92,246,0.2)',
  },
  gold: {
    stops: ['#fbbf24', '#f59e0b', '#fcd34d'],
    glow: 'rgba(251,191,36,0.3)',
  },
  purpleToSteel: {
    stops: ['#8b5cf6', '#c084fc', '#8fb0cf'],
    glow: 'rgba(192,132,252,0.2)',
  },
  success: {
    stops: ['#4ade80', '#22c55e', '#16a34a'],
    glow: 'rgba(74,222,128,0.25)',
  },
};

export default function LinearGradient({
  preset = 'purple',
  stops,
  angle = 135,
  animated = false,
  glow = false,
  variant = 'strip',
  className,
  style,
}) {
  const p = PRESETS[preset] || PRESETS.purple;
  const colors = stops || p.stops;
  const glowColor = glow === true ? p.glow : glow || 'transparent';

  const gradient = `linear-gradient(${angle}deg, ${colors.join(', ')})`;
  const animSize = colors.length > 3 ? '350% 350%' : '200% 200%';

  const baseStyle = {
    background: gradient,
    backgroundSize: animated ? animSize : undefined,
    ...(glow && { boxShadow: `0 0 20px -4px ${glowColor}, 0 0 40px -8px ${glowColor}` }),
    ...style,
  };

  if (variant === 'strip') {
    return (
      <div
        className={clsx('lg-strip', animated && 'lg-animated', className)}
        style={baseStyle}
      />
    );
  }

  if (variant === 'border') {
    return (
      <div
        className={clsx('lg-border', animated && 'lg-animated', className)}
        style={{
          ...baseStyle,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
        }}
      />
    );
  }

  if (variant === 'fill') {
    return (
      <div
        className={clsx('lg-fill', animated && 'lg-animated', className)}
        style={baseStyle}
      />
    );
  }

  if (variant === 'text') {
    return (
      <span
        className={clsx('lg-text', animated && 'lg-animated', className)}
        style={{
          ...baseStyle,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      />
    );
  }

  if (variant === 'orb') {
    return (
      <div
        className={clsx('lg-orb', animated && 'lg-orb-animated', className)}
        style={{
          background: `radial-gradient(circle, ${colors[0]} 0%, ${colors[1] || colors[0]} 40%, transparent 70%)`,
          ...(glow && { filter: `blur(40px)` }),
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={clsx('lg-strip', animated && 'lg-animated', className)}
      style={baseStyle}
    />
  );
}
