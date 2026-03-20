/**
 * DeepL Translation Service
 *
 * Server-side translation using the DeepL API.
 * Exposed as a REST endpoint and also callable internally.
 */

import * as deepl from "deepl-node";

const DEEPL_API_KEY = process.env.DEEPL_API_KEY || "";

let translator: deepl.Translator | null = null;

function getTranslator(): deepl.Translator | null {
  if (!DEEPL_API_KEY) {
    console.error("[DEEPL] No DEEPL_API_KEY set");
    return null;
  }
  if (!translator) {
    translator = new deepl.Translator(DEEPL_API_KEY);
  }
  return translator;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

const MAX_CACHE = 1000;
const cache = new Map<string, string>();

// ─── BCP-47 → DeepL language codes ──────────────────────────────────────────

const BCP47_TO_DEEPL_SOURCE: Record<string, deepl.SourceLanguageCode> = {
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
  "tr-TR": "tr",
  "uk-UA": "uk",
  "nl-NL": "nl",
  "pl-PL": "pl",
};

const BCP47_TO_DEEPL_TARGET: Record<string, deepl.TargetLanguageCode> = {
  "ru-RU": "ru",
  "en-US": "en-US",
  "en-GB": "en-GB",
  "de-DE": "de",
  "fr-FR": "fr",
  "es-ES": "es",
  "zh-CN": "zh-HANS",
  "ja-JP": "ja",
  "it-IT": "it",
  "pt-BR": "pt-BR",
  "ko-KR": "ko",
  "tr-TR": "tr",
  "uk-UA": "uk",
  "nl-NL": "nl",
  "pl-PL": "pl",
};

function toDeepLSource(bcp47: string): deepl.SourceLanguageCode {
  return BCP47_TO_DEEPL_SOURCE[bcp47] ?? (bcp47.split("-")[0] as deepl.SourceLanguageCode);
}

function toDeepLTarget(bcp47: string): deepl.TargetLanguageCode {
  return BCP47_TO_DEEPL_TARGET[bcp47] ?? (bcp47 as deepl.TargetLanguageCode);
}

/**
 * Same-language check using base language codes
 */
function isSameLang(from: string, to: string): boolean {
  const fromBase = from.split("-")[0].toLowerCase();
  const toBase = to.split("-")[0].toLowerCase();
  return fromBase === toBase;
}

/**
 * Translate text via DeepL API.
 *
 * @param text     Text to translate
 * @param fromLang Source language BCP-47
 * @param toLang   Target language BCP-47
 * @returns        Translated text, or original on error
 */
export async function translateText(
  text: string,
  fromLang: string,
  toLang: string
): Promise<string> {
  if (!text.trim()) return text;
  if (isSameLang(fromLang, toLang)) return text;

  const cacheKey = `${fromLang}|${toLang}|${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const t = getTranslator();
  if (!t) return text; // No API key — return original

  try {
    const sourceLang = toDeepLSource(fromLang);
    const targetLang = toDeepLTarget(toLang);

    const result = await t.translateText(text, sourceLang, targetLang);
    const translated = result.text.trim();

    if (!translated) return text;

    // Cache management
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(cacheKey, translated);

    return translated;
  } catch (err) {
    console.error("[DEEPL] Translation error:", err);
    return text; // Fallback: return original
  }
}
