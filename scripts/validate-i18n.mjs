/**
 * validate-i18n.mjs
 *
 * Checks that every locale has the exact same set of keys as the
 * reference locale (en-US) for every namespace.
 *
 * Usage:
 *   node scripts/validate-i18n.mjs
 *
 * Exit codes:
 *   0 — all locales are in sync
 *   1 — at least one key is missing or extra
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'src/locales');

const REFERENCE = 'en-US';
const LOCALES = ['en-US', 'pt-BR', 'es'];
const NAMESPACES = ['common', 'dashboard', 'agents', 'chat', 'crons', 'kanban', 'office3d', 'charts', 'errors', 'settings', 'health'];

/** Flatten nested object into dot-separated keys */
function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? flatKeys(v, full)
      : [full];
  });
}

let hasError = false;

for (const ns of NAMESPACES) {
  const refPath = resolve(LOCALES_DIR, REFERENCE, `${ns}.json`);
  if (!existsSync(refPath)) {
    console.error(`❌  Missing reference file: ${REFERENCE}/${ns}.json`);
    hasError = true;
    continue;
  }

  const refKeys = new Set(flatKeys(JSON.parse(readFileSync(refPath, 'utf8'))));

  for (const locale of LOCALES) {
    if (locale === REFERENCE) continue;

    const path = resolve(LOCALES_DIR, locale, `${ns}.json`);
    if (!existsSync(path)) {
      console.error(`❌  Missing file: ${locale}/${ns}.json`);
      hasError = true;
      continue;
    }

    const keys = new Set(flatKeys(JSON.parse(readFileSync(path, 'utf8'))));

    const missing = [...refKeys].filter((k) => !keys.has(k));
    const extra   = [...keys].filter((k) => !refKeys.has(k));

    if (missing.length > 0) {
      console.error(`❌  ${locale}/${ns}.json — missing keys:`);
      missing.forEach((k) => console.error(`     - ${k}`));
      hasError = true;
    }
    if (extra.length > 0) {
      console.warn(`⚠️   ${locale}/${ns}.json — extra keys (not in ${REFERENCE}):`);
      extra.forEach((k) => console.warn(`     + ${k}`));
    }
    if (missing.length === 0 && extra.length === 0) {
      console.log(`✅  ${locale}/${ns}.json`);
    }
  }
}

if (hasError) {
  console.error('\nValidation failed — fix the errors above.');
  process.exit(1);
} else {
  console.log('\nAll locales are in sync ✓');
}
