import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import en from "@familyquest/shared/i18n/en";
import tr from "@familyquest/shared/i18n/tr";

const deviceLanguage = getLocales()[0]?.languageCode === "tr" ? "tr" : "en";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr } },
  lng: deviceLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
