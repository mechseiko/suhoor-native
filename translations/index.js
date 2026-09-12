import { en } from './en';
import { ar } from './ar';
import { fr } from './fr';
import { es } from './es';
import { tr } from './tr';
import { ur } from './ur';

/**
 * Bundled dictionaries for the mobile app.
 *
 * The individual {code}.js files are GENERATED from the web app's
 * public/locales/{code}/translation.json by scripts/sync-translations.mjs.
 * Edit the JSON, then run `npm run i18n:sync` from the repo root — never edit
 * the generated files, and never add a string here that the web app does not
 * also have.
 */
export const translations = {
  en,
  ar,
  fr,
  es,
  tr,
  ur,
};

/**
 * The language list lives in config/languages.js (shared verbatim with the web
 * app). Re-exported here only so the previous `import { languages } from
 * '../translations'` call sites keep working; new code should import from
 * config/languages directly.
 */
export { SUPPORTED_LANGUAGES as languages } from '../config/languages';

export default translations;
