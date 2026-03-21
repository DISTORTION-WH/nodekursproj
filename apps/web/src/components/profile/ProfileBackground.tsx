import React from "react";

interface Props {
  profileBg?: string | null;
  /** Height of the banner strip in px (default 120) */
  height?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Renders a profile banner strip.
 * profileBg can be:
 *  - empty / null   → default gradient
 *  - a CSS gradient string, e.g. "linear-gradient(135deg,#5865f2,#eb459e)"
 *  - a URL          → used as background-image
 */
export default function ProfileBackground({ profileBg, height = 120, className = "", children }: Props) {
  const isUrl = profileBg ? /^https?:\/\/|^\//.test(profileBg) : false;
  const isGradient = profileBg ? /gradient/.test(profileBg) : false;

  let style: React.CSSProperties = { height };

  if (!profileBg) {
    style.background = "linear-gradient(135deg, #5865f2 0%, #3ba0d1 50%, #eb459e 100%)";
  } else if (isUrl) {
    style.backgroundImage = `url(${profileBg})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (isGradient) {
    style.background = profileBg;
  } else {
    // treat as a CSS color or anything else
    style.background = profileBg;
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-t-xl ${className}`} style={style}>
      {children}
    </div>
  );
}
