// Entrypoint for CALA DORADA — Gold Coast Syndicate (make.fun gta6-01).
// Packages the offline Three.js open-world game under game/ and its 4 desktop Chrome screenshots
// under screenshots/ into MAKEFUN_OUTPUT_DIR (default /output) and emits deterministic dossier.json.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function packageEntry(): void {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

  const shotsDest = join(outputDir, 'screenshots');
  mkdirSync(shotsDest, { recursive: true });
  const shotsSrc = join(repoRoot, 'screenshots');
  if (existsSync(shotsSrc)) {
    cpSync(shotsSrc, shotsDest, { recursive: true });
  }

  const dossierBytes = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);
}

packageEntry();
