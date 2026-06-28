export function CarArt({ color }: { color: string }) {
  return (
    <svg className="carart" viewBox="0 0 200 90" fill="none">
      <path d="M18 62l8-22c2.5-7 9-11 16.5-11h63c6 0 11.7 2.7 15.2 7.5L148 58l24 5c6 1.3 10 6.6 10 12.7V80a4 4 0 01-4 4h-12" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
      <path d="M18 62h-4a4 4 0 00-4 4v10a4 4 0 004 4h10" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="M58 84h54" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="84" r="13" stroke={color} strokeWidth="4" />
      <circle cx="142" cy="84" r="13" stroke={color} strokeWidth="4" />
      <path d="M40 30l-6 18h54l-12-18z" stroke={color} strokeWidth="3.5" strokeLinejoin="round" opacity=".7" />
    </svg>
  );
}
