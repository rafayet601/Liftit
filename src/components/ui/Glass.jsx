import clsx from 'clsx';
import WaveDistortion from './WaveDistortion';
import LinearGradient from './LinearGradient';

const TINTS = {
  purple: {
    bg: 'rgba(139,92,246,0.04)',
    border: 'rgba(139,92,246,0.2)',
    glow: 'rgba(139,92,246,0.12)',
  },
  steel: {
    bg: 'rgba(143,176,207,0.04)',
    border: 'rgba(143,176,207,0.2)',
    glow: 'rgba(143,176,207,0.1)',
  },
  gold: {
    bg: 'rgba(251,191,36,0.04)',
    border: 'rgba(251,191,36,0.25)',
    glow: 'rgba(251,191,36,0.12)',
  },
  success: {
    bg: 'rgba(74,222,128,0.03)',
    border: 'rgba(74,222,128,0.2)',
    glow: 'rgba(74,222,128,0.1)',
  },
  neutral: {
    bg: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.08)',
    glow: 'transparent',
  },
};

export default function Glass({
  tint = 'neutral',
  blur = 16,
  radius = 16,
  padded = true,
  hover = false,
  glow = false,
  wave = false,
  wavePreset = 'aurora',
  gradientBorder = false,
  gradientPreset = 'purpleToSteel',
  className,
  style,
  children,
  as: As = 'div',
  ...rest
}) {
  const t = TINTS[tint] || TINTS.neutral;

  const glassStyle = {
    background: t.bg,
    backdropFilter: `blur(${blur}px) saturate(120%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(120%)`,
    borderRadius: `${radius}px`,
    border: gradientBorder ? '1px solid transparent' : `1px solid ${t.border}`,
    boxShadow: glow
      ? `0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px ${t.glow} inset, 0 12px 40px -12px rgba(0,0,0,0.5), 0 0 24px -6px ${t.glow}`
      : `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px -12px rgba(0,0,0,0.45)`,
    overflow: 'hidden',
    position: 'relative',
    ...style,
  };

  return (
    <As
      className={clsx(
        'glass-panel',
        hover && 'glass-hover',
        gradientBorder && 'glass-gradient-border',
        wave && 'glass-wave',
        className,
      )}
      style={glassStyle}
      {...rest}
    >
      {wave && (
        <WaveDistortion
          preset={wavePreset}
          amplitude={0.08}
          frequency={2.5}
          speed={0.4}
          opacity={0.5}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            borderRadius: `${radius}px`,
          }}
        />
      )}

      {gradientBorder && (
        <LinearGradient
          preset={gradientPreset}
          variant="border"
          animated
          style={{
            position: 'absolute',
            inset: -1,
            borderRadius: `${radius + 1}px`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        className={clsx(
          'relative',
          padded && 'p-5 md:p-6',
        )}
        style={{ zIndex: 1 }}
      >
        {children}
      </div>
    </As>
  );
}
