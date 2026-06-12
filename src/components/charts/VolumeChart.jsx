import React from 'react';
import { 
    AreaChart, 
    Area, 
    BarChart, 
    Bar, 
    RadarChart, 
    Radar, 
    PolarGrid, 
    PolarAngleAxis, 
    PolarRadiusAxis,
    LineChart,
    Line,
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Legend
} from 'recharts';
import { useUnit } from '../../contexts/UnitContext';

const chartColors = {
    primary: '#ff6b3a',
    secondary: '#4ade80',
    tertiary: '#8fb0cf',
    accent: '#ffa03d',
    muted: '#52525b'
};

const CustomTooltip = ({ active, payload, label, unit }) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="rounded-xl border border-white/10 bg-zinc-950/95 px-3 py-2.5 shadow-xl backdrop-blur-md">
            {label && (
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    {label}
                </p>
            )}
            <div className="space-y-1">
                {payload.map((entry, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: entry.color || entry.fill }}
                            aria-hidden
                        />
                        <span className="text-zinc-400">{entry.name}</span>
                        <span className="ml-auto font-semibold tabular-nums text-white">
                            {Number(entry.value).toLocaleString()}
                            {unit ? ` ${unit}` : ''}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export function VolumeProgressionChart({ data, dataKey = 'volume', height = 300 }) {
    const { unit } = useUnit();
    
    return (
        <div className="chart-container" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke={chartColors.muted} 
                        tick={{ fill: chartColors.muted, fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false} 
                    />
                    <YAxis 
                        stroke={chartColors.muted} 
                        tick={{ fill: chartColors.muted, fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip content={<CustomTooltip unit={unit} />} />
                    <Area 
                        type="monotone" 
                        dataKey={dataKey} 
                        stroke={chartColors.primary} 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#volumeGradient)" 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function WeeklyVolumeBarChart({ data, height = 300 }) {
    const { unit } = useUnit();
    
    return (
        <div className="chart-container" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke={chartColors.muted} 
                        tick={{ fill: chartColors.muted, fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false} 
                    />
                    <YAxis 
                        stroke={chartColors.muted} 
                        tick={{ fill: chartColors.muted, fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip content={<CustomTooltip unit={unit} />} />
                    <Bar dataKey="actual" fill={chartColors.primary} radius={[4, 4, 0, 0]} name="Actual" />
                    <Bar dataKey="target" fill={chartColors.muted} radius={[4, 4, 0, 0]} name="Target" opacity={0.5} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function StrengthTrendChart({ data, height = 300 }) {
    const { unit } = useUnit();
    
    return (
        <div className="chart-container" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke={chartColors.muted} 
                        tick={{ fill: chartColors.muted, fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false} 
                    />
                    <YAxis 
                        stroke={chartColors.muted} 
                        tick={{ fill: chartColors.muted, fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip unit={unit} />} />
                    <Legend />
                    <Line 
                        type="monotone" 
                        dataKey="bench" 
                        stroke={chartColors.primary} 
                        strokeWidth={2}
                        dot={{ fill: chartColors.primary, strokeWidth: 0, r: 4 }}
                        name="Bench"
                    />
                    <Line 
                        type="monotone" 
                        dataKey="squat" 
                        stroke={chartColors.secondary} 
                        strokeWidth={2}
                        dot={{ fill: chartColors.secondary, strokeWidth: 0, r: 4 }}
                        name="Squat"
                    />
                    <Line 
                        type="monotone" 
                        dataKey="deadlift" 
                        stroke={chartColors.tertiary} 
                        strokeWidth={2}
                        dot={{ fill: chartColors.tertiary, strokeWidth: 0, r: 4 }}
                        name="Deadlift"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function MuscleBalanceRadar({ data, height = 300 }) {
    return (
        <div className="chart-container" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis 
                        dataKey="muscle" 
                        tick={{ fill: '#a1a1aa', fontSize: 11 }} 
                    />
                    <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: '#52525b', fontSize: 10 }}
                    />
                    <Radar 
                        name="Volume" 
                        dataKey="volume" 
                        stroke={chartColors.primary} 
                        fill={chartColors.primary} 
                        fillOpacity={0.3} 
                    />
                    <Radar 
                        name="Target" 
                        dataKey="target" 
                        stroke={chartColors.muted} 
                        fill={chartColors.muted} 
                        fillOpacity={0.1}
                    />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function CircularProgress({ value, maxValue, size = 120, strokeWidth = 8, children }) {
    const percentage = Math.min((value / maxValue) * 100, 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="progress-circle" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle
                    className="progress-circle-bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                />
                <circle
                    className="progress-circle-fill"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                {children || (
                    <>
                        <span className="text-2xl font-bold text-white">{Math.round(percentage)}%</span>
                        <span className="text-xs text-zinc-500">Complete</span>
                    </>
                )}
            </div>
        </div>
    );
}

export function ProgressProgressBar({ value, maxValue, label, showValue = true }) {
    const percentage = Math.min((value / maxValue) * 100, 100);
    
    return (
        <div className="space-y-2">
            {label && (
                <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">{label}</span>
                    {showValue && (
                        <span className="text-zinc-400">
                            {value.toLocaleString()} / {maxValue.toLocaleString()}
                        </span>
                    )}
                </div>
            )}
            <div className="volume-bar">
                <div 
                    className="volume-bar-fill" 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
