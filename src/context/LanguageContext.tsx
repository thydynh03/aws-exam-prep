import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../core/storage';
import { LanguageContext } from './languageContextDef';
import type { Language } from '../core/translations';
import { TRANSLATIONS } from '../core/translations';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => storage.getLanguage());

  useEffect(() => {
    storage.setLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'vi' ? 'en' : 'vi'));
  };

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
  };

  const t = useMemo(() => TRANSLATIONS[language], [language]);

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
