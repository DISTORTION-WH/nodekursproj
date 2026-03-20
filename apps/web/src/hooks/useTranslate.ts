/**
 * Translation module — uses the backend DeepL endpoint.
 * Falls back to returning original text on failure.
 */

import api from "../services/api";

// BCP-47 → base language code (for same-language check)
const BCP47_TO_CODE: Record<string, string> = {
  "ru-RU": "ru",
  "en-US": "en",
  "en-GB": "en",
  "de-DE": "de",
  "fr-FR": "fr",
  "es-ES": "es",
  "zh-CN": "zh",
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
 * Translate text via the backend DeepL API endpoint.
 * fromLang: source language BCP-47
 * toLang: target language BCP-47
 */
export async function translateText(
  text: string,
  fromLang: string,
  toLang: string
): Promise<string> {
  if (!text.trim()) return text;

  const from = toLangCode(fromLang);
  const to = toLangCode(toLang);

  // Same language — skip
  if (from === to) return text;

  const cacheKey = `${fromLang}|${toLang}|${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const res = await api.post("/api/translate", {
      text,
      from: fromLang,
      to: toLang,
    });

    const translated: string = res.data?.translated || text;

    if (!translated || translated === text) return text;

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
