export function LibbyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Open book */}
      <path
        d="M2 19.5C2 19.5 3.5 17 7 17C10.5 17 12 19.5 12 19.5V4.5C12 4.5 10.5 2 7 2C3.5 2 2 4.5 2 4.5V19.5Z"
        fill="#2DB5A0"
        stroke="#2DB5A0"
        strokeWidth="1"
      />
      <path
        d="M22 19.5C22 19.5 20.5 17 17 17C13.5 17 12 19.5 12 19.5V4.5C12 4.5 13.5 2 17 2C20.5 2 22 4.5 22 4.5V19.5Z"
        fill="#2DB5A0"
        stroke="#2DB5A0"
        strokeWidth="1"
      />
      {/* Spine / center line */}
      <path
        d="M12 4.5V19.5"
        stroke="white"
        strokeWidth="0.5"
        strokeOpacity="0.5"
      />
      {/* Bookmark */}
      <path
        d="M15 2V7L16.5 5.5L18 7V2"
        fill="#5D2137"
        stroke="#5D2137"
        strokeWidth="0.5"
      />
      {/* Page curves */}
      <path
        d="M2 19.5C2 19.5 5 21 12 21C19 21 22 19.5 22 19.5"
        stroke="#1A8A78"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}
