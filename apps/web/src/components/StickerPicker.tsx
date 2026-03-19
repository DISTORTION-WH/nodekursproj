import React, { useRef, useEffect } from "react";

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
  onClose: () => void;
}

const STICKER_COUNT = 27;

// In dev stickers are in /public/stickers/ (served by CRA).
// In prod the backend serves them at /stickers/ — but the frontend
// needs an absolute URL pointing to the API host.
const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const stickerUrls: string[] = Array.from({ length: STICKER_COUNT }, (_, i) => {
  const n = i + 1;
  return `${API_BASE}/stickers/${n}.png`;
});

export default function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 z-30 rounded-xl shadow-2xl overflow-hidden"
      style={{
        background: "var(--color-secondary)",
        border: "1px solid var(--color-tertiary)",
        width: 320,
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--color-tertiary)" }}
      >
        <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">
          Стикеры
        </span>
        <button
          onClick={onClose}
          className="text-discord-text-muted hover:text-discord-text-primary text-sm transition"
        >
          ✕
        </button>
      </div>

      {/* Grid */}
      <div
        className="p-2 overflow-y-auto"
        style={{ maxHeight: 280 }}
      >
        <div className="grid grid-cols-5 gap-1">
          {stickerUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => { onSelect(url); onClose(); }}
              className="rounded-lg overflow-hidden hover:bg-discord-input transition p-1 flex items-center justify-center"
              title={`Стикер ${i + 1}`}
            >
              <img
                src={url}
                alt={`sticker-${i + 1}`}
                className="w-12 h-12 object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
