import React, { useEffect, useState } from "react";
import { getLinkPreview } from "../services/api";
import { LinkPreview as LinkPreviewType } from "../types";

interface Props {
  url: string;
}

export default function LinkPreview({ url }: Props) {
  const [preview, setPreview] = useState<LinkPreviewType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLinkPreview(url)
      .then((res) => {
        if (!cancelled && res.data?.title) setPreview(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading || !preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 bg-discord-secondary border border-discord-tertiary rounded-lg overflow-hidden hover:border-discord-accent/50 transition max-w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="w-full h-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="p-2">
        {preview.siteName && (
          <p className="text-xs text-discord-text-muted mb-0.5 uppercase tracking-wide">{preview.siteName}</p>
        )}
        {preview.title && (
          <p className="text-sm font-semibold text-discord-text-primary line-clamp-2">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-xs text-discord-text-secondary mt-0.5 line-clamp-2">{preview.description}</p>
        )}
      </div>
    </a>
  );
}
