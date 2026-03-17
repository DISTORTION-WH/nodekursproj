import https from "https";
import http from "http";

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

class LinkPreviewService {
  private cache = new Map<string, { data: LinkPreview; ts: number }>();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  async getPreview(url: string): Promise<LinkPreview | null> {
    try {
      new URL(url);
    } catch {
      return null;
    }

    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.ts < this.TTL) {
      return cached.data;
    }

    try {
      const html = await this.fetchHtml(url);
      const preview = this.parseOG(url, html);
      this.cache.set(url, { data: preview, ts: Date.now() });
      return preview;
    } catch {
      return null;
    }
  }

  private fetchHtml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LumeBot/1.0)" } }, (res) => {
        // Follow redirect
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchHtml(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > 100_000) req.destroy(); // limit to 100KB
        });
        res.on("end", () => resolve(data));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.setTimeout(5000, () => req.destroy(new Error("timeout")));
    });
  }

  private parseOG(url: string, html: string): LinkPreview {
    const getMeta = (property: string): string | undefined => {
      const match = html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i")
      );
      return match?.[1];
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return {
      url,
      title: getMeta("og:title") || getMeta("twitter:title") || titleMatch?.[1]?.trim(),
      description: getMeta("og:description") || getMeta("twitter:description") || getMeta("description"),
      image: getMeta("og:image") || getMeta("twitter:image"),
      siteName: getMeta("og:site_name"),
    };
  }
}

export default new LinkPreviewService();
