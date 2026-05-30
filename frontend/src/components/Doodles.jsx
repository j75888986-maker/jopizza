// Cute SVG illustrations & decorative shapes for Looma
export const Blob = ({ className = "", color = "#98D8C8" }) => (
  <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
    <path fill={color} d="M44.7,-67.9C57.8,-58.8,68.3,-46.1,73.9,-31.7C79.5,-17.3,80.2,-1.1,76.7,13.7C73.2,28.5,65.6,42,54.6,52.9C43.5,63.9,29,72.4,12.6,75.7C-3.7,79,-21.9,77.1,-37.4,69.7C-52.9,62.3,-65.7,49.4,-72.7,33.9C-79.7,18.3,-80.9,0.1,-76.2,-15.6C-71.5,-31.4,-60.8,-44.6,-47.6,-54C-34.4,-63.4,-18.7,-69,-2.3,-65.8C14.2,-62.6,31.6,-77,44.7,-67.9Z" transform="translate(100 100)" />
  </svg>
);

export const Squiggle = ({ className = "", color = "#FF6B6B" }) => (
  <svg viewBox="0 0 200 30" className={className} aria-hidden="true">
    <path d="M5 15 Q 25 0, 50 15 T 100 15 T 150 15 T 195 15" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export const Star = ({ className = "", color = "#F4D068" }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <path d="M20 2 L24 16 L38 16 L27 24 L31 38 L20 30 L9 38 L13 24 L2 16 L16 16 Z" fill={color} stroke="#121124" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const Heart = ({ className = "", color = "#FF6B6B" }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <path d="M20 35 L4 18 C -2 10, 8 0, 15 6 L 20 11 L 25 6 C 32 0, 42 10, 36 18 Z" fill={color} stroke="#121124" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

export const Sparkle = ({ className = "", color = "#1D1A3F" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 2 L13.5 9 L20 12 L13.5 15 L12 22 L10.5 15 L4 12 L10.5 9 Z" fill={color}/>
  </svg>
);

export const Dot = ({ className = "", color = "#F4D068" }) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
    <circle cx="10" cy="10" r="8" fill={color} stroke="#121124" strokeWidth="2"/>
  </svg>
);

export const Cloud = ({ className = "", color = "#98D8C8" }) => (
  <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
    <path d="M16 32 C 6 32, 4 18, 14 16 C 14 6, 28 4, 32 12 C 38 6, 52 10, 52 20 C 60 20, 62 32, 52 32 Z" fill={color} stroke="#121124" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

export const Bolt = ({ className = "", color = "#F4D068" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M14 2 L4 14 L11 14 L10 22 L20 10 L13 10 Z" fill={color} stroke="#121124" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

export const SmileyPlay = ({ className = "" }) => (
  <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <circle cx="50" cy="50" r="42" fill="#FF6B6B" stroke="#121124" strokeWidth="3"/>
    <path d="M42 38 L42 62 L62 50 Z" fill="#FFFBF0" stroke="#121124" strokeWidth="2.5" strokeLinejoin="round"/>
  </svg>
);
