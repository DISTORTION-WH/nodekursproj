import React from "react";

interface Props {
  username: string;
  color?: string | null;
  anim?: string | null;
  badge?: string | null;
  className?: string;
}

/**
 * Renders a username with optional custom color, animation, and badge emoji.
 * Animation values: "rainbow" | "pulse" | "glitch" | "shimmer" | "fire" | ""
 */
export default function UsernameDisplay({ username, color, anim, badge, className = "" }: Props) {
  const animClass = anim ? `uname-${anim}` : "";

  const style: React.CSSProperties =
    anim === "shimmer"
      ? color ? { color } : {}
      : color
      ? { color }
      : {};

  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className={`${animClass} ${className} truncate`} style={style}>
        {username}
      </span>
      {badge && (
        <span className="shrink-0 text-[0.9em] leading-none" aria-label="badge">
          {badge}
        </span>
      )}
    </span>
  );
}
