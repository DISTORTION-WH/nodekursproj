/**
 * Translation module using Google Translate (free tier, no API key).
 * Uses the same endpoint as translate.google.com.
 * Auto-detects source language — just specify the target.
 */

// BCP-47 → Google Translate language code
const BCP47_TO_CODE: Record<string, string> = {
  "ru-RU": "ru",
  "en-US": "en",
  "en-GB": "en",
  "de-DE": "de",
  "fr-FR": "fr",
  "es-ES": "es",
  "zh-CN": "zh-CN",
  "ja-JP": "ja",
  "it-IT": "it",
  "pt-BR": "pt",
  "ko-KR": "ko",
  "ar-SA": "ar",
  "pl-PL": "pl",
  "tr-TR": "tr",
  "nl-NL": "nl",
  "uk-UA": "uk",
};

export function toLangCode(bcp47: string): string {
  return BCP47_TO_CODE[bcp47] ?? bcp47.split("-")[0];
}

// In-memory LRU cache (bounded to prevent memory leaks during long calls)
const MAX_CACHE = 500;
const cache = new Map<string, string>();

/**
 * Translate text using Google Translate free API.
 * fromLang: source language BCP-47 or "auto"/"autodetect"/"" for auto-detection
 * toLang: target language BCP-47
 */
export async function translateText(
  text: string,
  fromLang: string,
  toLang: string
): Promise<string> {
  if (!text.trim()) return text;

  const to = toLangCode(toLang);
  const from = (fromLang === "autodetect" || fromLang === "auto" || fromLang === "")
    ? "auto"
    : toLangCode(fromLang);

  // Same language and not auto — skip
  if (from === to && from !== "auto") return text;

  const cacheKey = `${from}|${to}|${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx` +
      `&sl=${from}&tl=${to}&dt=t` +
      `&q=${encodeURIComponent(text)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return text;

    const json = await res.json();
    // Response format: [[["translated text","original text",null,null,10]],null,"detected_lang"]
    const sentences: any[] = json?.[0] ?? [];
    const translated = sentences
      .map((s: any) => s?.[0] ?? "")
      .join("")
      .trim();

    if (!translated) return text;

    // If auto-detected source is same as target, return original
    const detectedLang: string = json?.[2] ?? "";
    if (from === "auto" && detectedLang === to) return text;

    // Evict oldest entries if cache exceeds limit
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(cacheKey, translated);
    return translated;
  } catch {
    return text; // fallback: show original
  }
}
