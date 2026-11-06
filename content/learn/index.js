import en from './en';
import ar from './ar';
import ur from './ur';
import fr from './fr';
import es from './es';
import tr from './tr';

/**
 * Long-form Learn content, one module per language.
 *
 * The UI chrome (card titles, subtitles, headings of the screen) stays in
 * translations/*.js — it is short and shared with every other screen. Only the
 * article bodies live here, because they are ~36 sections of prose that would
 * bloat the flat dictionary every screen loads at startup.
 *
 * Adding a language:
 *   1. copy `en.js` to `<code>.js` and translate `heading`, `body`, `arabicTrans`
 *      (leave `arabic` exactly as it is — that is the Qur'an/hadith text),
 *   2. import it below and add it to `CONTENT`.
 *
 * A language that is not listed falls back to English per topic, so a partially
 * translated file is safe: missing topics simply render in English.
 */
const CONTENT = {
  en,
  ar,
  ur,
  fr,
  es,
  tr,
};

/**
 * Sections for one Learn topic in the requested language.
 * @param {string} topicId  e.g. 'conditions'
 * @param {string} locale   i18next language code (en, ar, fr, es, tr, ur)
 * @returns {Array<{heading: string, body: string, arabic?: string, arabicTrans?: string}>}
 */
export const getLearnSections = (topicId, locale) => {
  if (!topicId) return [];
  const pack = CONTENT[locale] || CONTENT.en;
  const sections = pack?.[topicId];
  if (Array.isArray(sections) && sections.length) return sections;
  return CONTENT.en?.[topicId] || [];
};

export default CONTENT;
