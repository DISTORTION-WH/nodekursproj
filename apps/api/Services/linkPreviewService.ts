import https from "https";
import http from "http";
import net from "net";

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

// Block requests to private/loopback/link-local ranges (SSRF prevention)
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  // Reject numeric IPs in private ranges
  if (net.isIP(hostname)) {
    return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
  }
  // Reject localhost and bare hostnames (no dot = internal)
  if (hostname === "localhost" || !hostname.includes(".")) return true;
  return false;
}

class LinkPreviewService {
  private cache = new Map<string, { data: LinkPreview; ts: number }>();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  async getPreview(url: string): Promise<LinkPreview | null> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    // Block private/internal hosts
    if (isPrivateHost(parsed.hostname)) return null;

    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.ts < this.TTL) {
      return cached.data;
    }

    try {
      const html = await this.fetchHtml(url, 0);
      const preview = this.parseOG(url, html);
      this.cache.set(url, { data: preview, ts: Date.now() });
      return preview;
    } catch {
      return null;
    }
  }

  private fetchHtml(url: string, depth: number): Promise<string> {
    // Max 3 redirects
    if (depth > 3) return Promise.reject(new Error("Too many redirects"));

    return new Promise((resolve, reject) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return reject(new Error("Invalid redirect URL"));
      }

      // Block redirect to private host
      if (isPrivateHost(parsed.hostname)) {
        return reject(new Error("Redirect to private host blocked"));
      }

      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LumeBot/1.0)" } }, (res) => {
        // Follow redirect
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Resolve relative Location headers
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          res.destroy();
          this.fetchHtml(next, depth + 1).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
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
      const match =
        html.match(
          new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
        ) ||
        html.match(
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
