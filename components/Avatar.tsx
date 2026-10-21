const AVATAR_PALETTES = [
  { background: "#E1F16A", color: "#17352F" },
  { background: "#CDE8FF", color: "#154664" },
  { background: "#FFDFA8", color: "#6A3F08" },
  { background: "#FAD0C6", color: "#7C2D1F" },
  { background: "#C9F2DD", color: "#135C43" },
  { background: "#E7D9FF", color: "#53327C" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function paletteFor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const palette = paletteFor(name);
  return (
    <span
      className={`avatar avatar-${size} ${className}`}
      style={{ background: palette.background, color: palette.color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
