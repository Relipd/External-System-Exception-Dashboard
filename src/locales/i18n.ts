import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';
import ja from './ja.json';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },
};

export function initI18n(lang: 'zh' | 'en' | 'ja') {
  i18n.use(initReactI18next).init({
    resources,
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export default i18n;
