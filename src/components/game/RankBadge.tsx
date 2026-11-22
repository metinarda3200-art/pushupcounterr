import { useId } from "react";

import type { TierId } from "@/lib/game";
import { cn } from "@/lib/utils";

const GLOW: Record<TierId, string> = {
  bronz: "var(--tier-bronz)",
  gumus: "var(--tier-gumus)",
  altin: "var(--tier-altin)",
  platin: "var(--tier-platin)",
  elmas: "var(--tier-elmas)",
  sampiyon: "var(--tier-sampiyon)",
};

/** Hexagonal rank emblem; each tier adds detail (chevrons → star → gem → crown). */
export function RankBadge({
  tier,
  division,
  size = 64,
  glow = false,
  className,
}: {
  tier: TierId;
  division?: string | null;
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const color = GLOW[tier];
  const winged = tier === "platin" || tier === "elmas" || tier === "sampiyon";

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0", glow && "animate-glow", className)}
      style={{ ["--glow" as string]: color }}
      role="img"
      aria-label={`${tier} rank`}
    >
      <defs>
        <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: color }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.35 }} />
        </linearGradient>
        <linearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {winged && (
        <g style={{ fill: color }} opacity="0.85">
          <path d="M22 50 L2 40 L10 58 L0 66 L16 70 L12 82 L28 74 Z" />
          <path d="M98 50 L118 40 L110 58 L120 66 L104 70 L108 82 L92 74 Z" />
        </g>
      )}

      <path d="M60 6 L104 31 L104 83 L60 110 L16 83 L16 31 Z" fill={`url(#${gid}-fill)`} />
      <path d="M60 6 L104 31 L104 83 L60 110 L16 83 L16 31 Z" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" />
      <path d="M60 16 L95 36 L95 78 L60 99 L25 78 L25 36 Z" fill="#0b0a09" fillOpacity="0.35" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M60 6 L104 31 L104 58 L16 58 L16 31 Z" fill={`url(#${gid}-shine)`} />

      <g fill="#fff" stroke="none">
        {tier === "bronz" && <path d="M40 66 L60 52 L80 66 L80 74 L60 60 L40 74 Z" />}
        {tier === "gumus" && (
          <>
            <path d="M40 58 L60 44 L80 58 L80 66 L60 52 L40 66 Z" />
            <path d="M40 74 L60 60 L80 74 L80 82 L60 68 L40 82 Z" />
          </>
        )}
        {tier === "altin" && (
          <>
            <path d="M42 50 L60 38 L78 50 L78 57 L60 45 L42 57 Z" />
            <path d="M42 64 L60 52 L78 64 L78 71 L60 59 L42 71 Z" />
            <path d="M42 78 L60 66 L78 78 L78 85 L60 73 L42 85 Z" />
          </>
        )}
        {tier === "platin" && (
          <path d="M60 36 L66 54 L85 54 L70 65 L76 84 L60 72 L44 84 L50 65 L35 54 L54 54 Z" />
        )}
        {tier === "elmas" && (
          <>
            <path d="M44 50 L52 40 L68 40 L76 50 L60 84 Z" />
            <path d="M44 50 L76 50 L60 84 Z" fillOpacity="0.6" />
          </>
        )}
        {tier === "sampiyon" && (
          <>
            <path d="M38 76 L36 46 L50 60 L60 40 L70 60 L84 46 L82 76 Z" />
            <rect x="38" y="79" width="44" height="6" rx="2" />
          </>
        )}
      </g>

      {division && (
        <text
          x="60"
          y="104"
          textAnchor="middle"
          fontFamily="Anton, Impact, sans-serif"
          fontSize="13"
          fill="#fff"
          opacity="0.9"
        >
          {division}
        </text>
      )}
    </svg>
  );
}
