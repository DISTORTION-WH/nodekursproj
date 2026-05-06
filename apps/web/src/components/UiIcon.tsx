import React from "react";

type IconName =
  | "archive"
  | "bell"
  | "camera"
  | "check"
  | "clock"
  | "crown"
  | "edit"
  | "file"
  | "fileArchive"
  | "fileCode"
  | "fileDisk"
  | "fileImage"
  | "fileSpreadsheet"
  | "fileText"
  | "flag"
  | "globe"
  | "image"
  | "link"
  | "message"
  | "mic"
  | "micOff"
  | "monitor"
  | "phone"
  | "phoneOff"
  | "pin"
  | "poll"
  | "refresh"
  | "save"
  | "settings"
  | "shield"
  | "smilePlus"
  | "trash"
  | "users"
  | "video"
  | "videoOff"
  | "volumeOff"
  | "warning";

type UiIconProps = {
  name: IconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

export default function UiIcon({
  name,
  className,
  size = 16,
  strokeWidth = 1.8,
  style,
}: UiIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={style}
      {...common}
    >
      {name === "archive" && (
        <>
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </>
      )}
      {name === "bell" && (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      )}
      {name === "camera" && (
        <>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </>
      )}
      {name === "check" && <path d="M20 6 9 17l-5-5" />}
      {name === "crown" && (
        <>
          <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
          <path d="M5 19h14" />
        </>
      )}
      {name === "edit" && (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      )}
      {name === "file" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </>
      )}
      {name === "fileArchive" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M10 12h4" />
          <path d="M10 16h4" />
        </>
      )}
      {name === "fileCode" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="m10 13-2 2 2 2" />
          <path d="m14 17 2-2-2-2" />
        </>
      )}
      {name === "fileDisk" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3" />
        </>
      )}
      {name === "fileImage" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </>
      )}
      {name === "fileSpreadsheet" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h8" />
          <path d="M12 9v10" />
        </>
      )}
      {name === "fileText" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h6" />
        </>
      )}
      {name === "flag" && (
        <>
          <path d="M4 22V4" />
          <path d="M4 5c4-2 6 2 10 0 2-.9 4-.8 6 0v10c-2-.8-4-.9-6 0-4 2-6-2-10 0" />
        </>
      )}
      {name === "globe" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 0 20" />
          <path d="M12 2a15.3 15.3 0 0 0 0 20" />
        </>
      )}
      {name === "image" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </>
      )}
      {name === "link" && (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      )}
      {name === "message" && (
        <>
          <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </>
      )}
      {name === "mic" && (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v4" />
          <path d="M8 23h8" />
        </>
      )}
      {name === "micOff" && (
        <>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          <path d="M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
          <path d="M19 10v2a7 7 0 0 1-.11 1.23" />
          <path d="M12 19v4" />
          <path d="M8 23h8" />
          <path d="M2 2l20 20" />
        </>
      )}
      {name === "monitor" && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </>
      )}
      {name === "phone" && (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.57 2.61a2 2 0 0 1-.45 2.11L8 9.67a16 16 0 0 0 6.33 6.33l1.23-1.23a2 2 0 0 1 2.11-.45c.84.25 1.71.45 2.61.57A2 2 0 0 1 22 16.92z" />
      )}
      {name === "phoneOff" && (
        <>
          <path d="M10.68 13.31a16 16 0 0 0 3.01 2.01l1.23-1.23a2 2 0 0 1 2.11-.45c.84.25 1.71.45 2.61.57A2 2 0 0 1 21.36 16v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.48 3.26 2 2 0 0 1 3.47 1.1h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.57 2.61a2 2 0 0 1-.45 2.11L7.36 8.77" />
          <path d="M2 2l20 20" />
        </>
      )}
      {name === "pin" && (
        <>
          <path d="M12 17v5" />
          <path d="M5 17h14" />
          <path d="M16 3l5 5-4 4v5H7v-5L3 8l5-5" />
        </>
      )}
      {name === "poll" && (
        <>
          <path d="M4 19V9" />
          <path d="M12 19V5" />
          <path d="M20 19v-7" />
        </>
      )}
      {name === "refresh" && (
        <>
          <path d="M21 12a9 9 0 0 1-15.33 6.36L3 16" />
          <path d="M3 21v-5h5" />
          <path d="M3 12A9 9 0 0 1 18.33 5.64L21 8" />
          <path d="M21 3v5h-5" />
        </>
      )}
      {name === "save" && (
        <>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M17 21v-8H7v8" />
          <path d="M7 3v5h8" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.38.52.7.9.9.33.17.7.26 1.1.26H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
        </>
      )}
      {name === "shield" && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
      {name === "smilePlus" && (
        <>
          <circle cx="11" cy="11" r="8" />
          <path d="M8 13s1 1.5 3 1.5S14 13 14 13" />
          <path d="M8.5 8.5h.01" />
          <path d="M13.5 8.5h.01" />
          <path d="M19 14v6" />
          <path d="M16 17h6" />
        </>
      )}
      {name === "trash" && (
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </>
      )}
      {name === "users" && (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === "video" && (
        <>
          <path d="m23 7-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </>
      )}
      {name === "videoOff" && (
        <>
          <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 .66 6-4v10" />
          <path d="M16 16.5V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.5" />
          <path d="M2 2l20 20" />
        </>
      )}
      {name === "volumeOff" && (
        <>
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M23 9l-6 6" />
          <path d="M17 9l6 6" />
        </>
      )}
      {name === "warning" && (
        <>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}
