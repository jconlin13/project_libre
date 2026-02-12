export function HardcoverIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: 'rotate(-15deg)' }}
    >
      {/* Book spine/back */}
      <rect x="4" y="2" width="3" height="20" rx="1.5" fill="#2D2A6E" />
      {/* Book cover */}
      <rect x="5" y="2" width="15" height="17" rx="2" fill="#5856D6" />
      {/* Book pages (bottom) */}
      <rect x="6" y="18" width="13" height="3" rx="1" fill="#E8E7F8" />
      {/* Spine edge highlight */}
      <rect x="5" y="2" width="1.5" height="17" fill="#4A48C4" />
      {/* Large four-pointed star */}
      <path
        d="M13 7 C13 7, 14.2 9.5, 14.5 10 C14.8 10.5, 17 11, 17 11 C17 11, 14.8 11.5, 14.5 12 C14.2 12.5, 13 15, 13 15 C13 15, 11.8 12.5, 11.5 12 C11.2 11.5, 9 11, 9 11 C9 11, 11.2 10.5, 11.5 10 C11.8 9.5, 13 7, 13 7Z"
        fill="#2D2A6E"
      />
      {/* Small four-pointed star */}
      <path
        d="M16 5 C16 5, 16.5 5.8, 16.6 6 C16.7 6.2, 17.5 6.5, 17.5 6.5 C17.5 6.5, 16.7 6.8, 16.6 7 C16.5 7.2, 16 8, 16 8 C16 8, 15.5 7.2, 15.4 7 C15.3 6.8, 14.5 6.5, 14.5 6.5 C14.5 6.5, 15.3 6.2, 15.4 6 C15.5 5.8, 16 5, 16 5Z"
        fill="#2D2A6E"
      />
    </svg>
  )
}
