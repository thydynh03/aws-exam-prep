import { useContext } from 'react';
import { LanguageContext } from './languageContextDef';
import type { LanguageContextType } from './languageContextDef';

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
