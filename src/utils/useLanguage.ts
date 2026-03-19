import { useCallback, useEffect, useState } from 'react';
import { getStoredLanguage, Language, setStoredLanguage, t as translate, TranslationKey } from './i18n';

export const useLanguage = () => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    getStoredLanguage().then(setLanguageState).catch(() => setLanguageState('en'));
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    await setStoredLanguage(next);
  }, []);

  const tt = useCallback((key: TranslationKey, vars?: Record<string, string | number>) => {
    return translate(language, key, vars);
  }, [language]);

  return { language, setLanguage, t: tt };
};
