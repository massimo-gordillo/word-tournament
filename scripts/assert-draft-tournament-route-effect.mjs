/**
 * Regression guard: draft tournament detail must reload when the dynamic route `id`
 * changes. Expo Router often reuses the screen component when navigating between
 * `/draft-tournament/[id]` URLs; an empty dependency array caused stale tournament data.
 *
 * Run via: npm run check:draft-route-effect
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const draftScreenPath = join(__dirname, '..', 'app', '(tabs)', 'draft-tournament', '[id].tsx');

let src;
try {
  src = readFileSync(draftScreenPath, 'utf8');
} catch {
  console.error(`Could not read ${draftScreenPath}`);
  process.exit(1);
}

const usesRouteIdInEffectDeps =
  /\},\s*\[\s*id\s*(,\s*loadParticipants\s*)?\]\)/s.test(src) ||
  /\},\s*\[\s*loadParticipants\s*,\s*id\s*\]\)/s.test(src);

if (!usesRouteIdInEffectDeps) {
  console.error(
    'Draft tournament screen must sync data when route id changes:\n' +
      '- useEffect that loads draft data must depend on [id] (and stable helpers such as loadParticipants).',
  );
  process.exit(1);
}

console.log('draft-tournament/[id].tsx route-param sync check OK');
