import React from "react";

interface Props {
  username: string;
  color?: string | null;
  anim?: string | null;
  className?: string;
}

/**
 * Renders a username with optional custom color and animation class.
 * Animation values: "rainbow" | "pulse" | "glitch" | "shimmer" | "fire" | ""
 */
export default function UsernameDisplay({ username, color, anim, className = "" }: Props) {
  const animClass = anim ? `uname-${anim}` : "";

  const style: React.CSSProperties =
    anim === "shimmer"
      ? // shimmer uses gradient clip — color overrides via currentColor trick
        color ? { color } : {}
      : color
      ? { color }
      : {};

  return (
    <span className={`${animClass} ${className}`} style={style}>
      {username}
    </span>
  );
}
