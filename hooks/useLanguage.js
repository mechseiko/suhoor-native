/**
 * Import-path parity with the web app.
 *
 * The web app reads `import { useLanguage } from '../hooks/useLanguage'`; on
 * mobile the same hook is produced by the provider in
 * context/LanguageContext.jsx. Re-exported here so both codebases can use the
 * identical import shape — there is one implementation, not two.
 */
export { useLanguage, default as LanguageContext } from '../context/LanguageContext';
export { useLanguage as default } from '../context/LanguageContext';
