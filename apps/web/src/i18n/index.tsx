import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import ru from "./ru";
import en from "./en";
import type { Translations } from "./ru";

export type Lang = "ru" | "en";

const translations: Record<Lang, Translations> = { ru, en };

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

interface I18nContextValue {
  lang: Lang;
  t: Translations;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "ru",
  t: ru,
  setLang: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

function getSavedLang(): Lang {
  try {
    const saved = localStorage.getItem("app-lang");
    if (saved === "ru" || saved === "en") return saved;
  } catch {}
  return "ru";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getSavedLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("app-lang", l);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, t: translations[lang], setLang }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
