import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "ar" | "en";

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "app-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "ar";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextType>(() => {
    const setLanguage = (next: AppLanguage) => setLanguageState(next);
    const toggleLanguage = () => setLanguageState(prev => (prev === "ar" ? "en" : "ar"));
    return {
      language,
      setLanguage,
      toggleLanguage,
      isArabic: language === "ar",
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
