export default function Logo({ width = 150, light = false }) {
  const color = light ? '#60a5fa' : '#2563eb'; // Brand sapphire blue
  const darkColor = light ? '#f8fafc' : '#0f172a';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg width={width / 4} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* T-Roof */}
        <path d="M 5 35 L 5 25 L 50 10 L 95 25 L 95 35 L 75 35 L 75 70 L 50 45 L 25 70 L 25 35 Z" fill={color} />
        {/* W-Legs */}
        <path d="M 10 40 L 20 40 L 20 85 L 50 55 L 80 85 L 80 40 L 90 40 L 90 90 L 50 65 L 10 90 Z" fill={light ? '#475569' : '#334155'} />
        {/* Scaffold Bracing X */}
        <path d="M 12 50 L 18 65 M 18 50 L 12 65" stroke={light ? '#64748b' : '#475569'} strokeWidth="2" />
        <path d="M 12 65 L 18 80 M 18 65 L 12 80" stroke={light ? '#64748b' : '#475569'} strokeWidth="2" />
        
        <path d="M 82 50 L 88 65 M 88 50 L 82 65" stroke={light ? '#64748b' : '#475569'} strokeWidth="2" />
        <path d="M 82 65 L 88 80 M 88 65 L 82 80" stroke={light ? '#64748b' : '#475569'} strokeWidth="2" />
      </svg>
      <span style={{ 
        fontFamily: 'var(--font-sans)', 
        fontSize: width / 7.5, 
        fontWeight: '700', 
        color: darkColor,
        letterSpacing: '-0.5px'
      }}>
        Temp<span style={{ color }}>Works</span>
      </span>
    </div>
  );
}
