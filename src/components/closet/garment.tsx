import type { GarmentKind, Product } from "@/lib/closet-data";

// Silhouettes drawn on a 100x150 grid; the hanger hook sits at the top centre so every
// garment hangs from the same point on the rail.
const SHAPES: Record<GarmentKind, string> = {
  tee: "M32 26 L6 42 L14 58 L28 50 L28 134 L72 134 L72 50 L86 58 L94 42 L68 26 C62 34 38 34 32 26 Z",
  hoodie:
    "M34 26 L12 42 L9 116 L23 118 L28 62 L28 130 L72 130 L72 62 L77 118 L91 116 L88 42 L66 26 C60 34 40 34 34 26 Z",
  jacket:
    "M34 26 L11 42 L8 124 L22 126 L28 62 L28 136 L72 136 L72 62 L78 126 L92 124 L89 42 L66 26 C60 34 40 34 34 26 Z",
  vest: "M34 26 C40 36 60 36 66 26 L82 38 L76 64 L77 130 L23 130 L24 64 L18 38 Z",
  pants: "M30 26 H70 L75 146 H55 L50 70 L45 146 H25 Z",
  shorts: "M30 26 H70 L77 96 H54 L50 62 L46 96 H23 Z",
};

const DETAILS: Record<GarmentKind, (trim: string) => React.ReactNode> = {
  tee: (t) => <path d="M32 26 C38 34 62 34 68 26" fill="none" stroke={t} strokeWidth="2.4" />,
  hoodie: (t) => (
    <>
      <path d="M36 26 C34 10 66 10 64 26 C60 36 40 36 36 26 Z" fill={t} opacity="0.55" />
      <path d="M33 98 H67 L71 114 H29 Z" fill={t} opacity="0.5" />
      <path d="M44 34 V52 M56 34 V52" stroke={t} strokeWidth="1.2" />
    </>
  ),
  jacket: (t) => (
    <>
      <path d="M50 30 V136" stroke={t} strokeWidth="2.2" />
      <path d="M36 26 L50 40 L64 26" fill="none" stroke={t} strokeWidth="2.4" />
      <path d="M32 104 H44 M56 104 H68" stroke={t} strokeWidth="1.6" />
    </>
  ),
  vest: (t) => (
    <>
      <path d="M50 32 V130" stroke={t} strokeWidth="2" />
      <path d="M30 96 H44 M56 96 H70" stroke={t} strokeWidth="1.4" />
    </>
  ),
  pants: (t) => (
    <>
      <path d="M30 26 H70 V32 H30 Z" fill={t} opacity="0.6" />
      <path d="M50 32 V70" stroke={t} strokeWidth="1.4" />
      <rect x="31" y="78" width="11" height="14" fill={t} opacity="0.45" />
      <rect x="58" y="78" width="11" height="14" fill={t} opacity="0.45" />
    </>
  ),
  shorts: (t) => (
    <>
      <path d="M30 26 H70 V32 H30 Z" fill={t} opacity="0.6" />
      <path d="M50 32 V62" stroke={t} strokeWidth="1.4" />
    </>
  ),
};

export function Garment({ product, className }: { product: Product; className?: string }) {
  const { kind, color, trim, imageUrl, name } = product;
  const gid = `fold-${product.sku}`;

  return (
    <svg viewBox="0 0 100 150" className={className} role="img" aria-label={name} overflow="visible">
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {imageUrl ? (
        // Real Shopify photo: multiply knocks the white studio backdrop out against the off-white page.
        <image href={imageUrl} x="0" y="14" width="100" height="136" preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} />
      ) : (
        <>
          <path d={SHAPES[kind]} fill={color} />
          {DETAILS[kind](trim)}
          <path d={SHAPES[kind]} fill={`url(#${gid})`} />
        </>
      )}

      {/* hanger */}
      <path d="M50 17 V12 C50 5 59 5 59 11" fill="none" stroke="#9aa0a6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 31 L50 17 L87 31" fill="none" stroke="#b08a5b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
