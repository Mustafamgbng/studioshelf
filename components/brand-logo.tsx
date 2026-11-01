/**
 * StudioShelf's original folded-shelf monogram.
 * Two opposing editorial cards suggest an S without relying on a font glyph.
 */
export default function BrandLogo({
  className = '',
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="StudioShelf mark"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="12" fill="var(--brand-logo-bg, #14233b)" />
      <path
        d="M16 8H39V17H22V22H9V15C9 11.134 12.134 8 16 8Z"
        fill="var(--brand-logo-ink, #f8f5ee)"
      />
      <path
        d="M32 40H9V31H26V26H39V33C39 36.866 35.866 40 32 40Z"
        fill="var(--brand-logo-accent, #7793ff)"
      />
    </svg>
  );
}
