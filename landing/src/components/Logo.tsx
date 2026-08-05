/**
 * FieldQuote abstract line logo
 * Geometric lines forming an interconnected FQ tech circuit
 */
export default function Logo({ color = 'currentColor', size = 28 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size * 6.5}
      height={size}
      viewBox="0 0 240 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FieldQuote logo"
    >
      {/* Precision tech lines for F and Q */}
      <path d="M4 28V4H22" stroke={color} strokeWidth="3" strokeLinecap="square" />
      <path d="M4 16H18" stroke={color} strokeWidth="3" strokeLinecap="square" />
      
      <circle cx="42" cy="16" r="12" stroke={color} strokeWidth="3" fill="none" />
      <line x1="48" y1="24" x2="56" y2="32" stroke={color} strokeWidth="3" strokeLinecap="square" />
      <line x1="32" y1="16" x2="22" y2="16" stroke={color} strokeWidth="3" strokeLinecap="square" opacity="0.5" />

      {/* Wordmark */}
      <text
        x="68"
        y="24"
        fill={color}
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize="22"
        letterSpacing="0.02em"
      >
        FIELDQUOTE
      </text>
    </svg>
  );
}
