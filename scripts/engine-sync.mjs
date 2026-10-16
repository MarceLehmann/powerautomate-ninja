#!/usr/bin/env node
/*
  PowerPlatformAcademy Dojo (Power Automate): Abgleich der gemeinsamen Engine-Dateien mit copilot-ninja. Liest nur, aendert nichts ausser mit --uebernehmen.
  node scripts/engine-sync.mjs                    zeigt, welche gemeinsamen Dateien abweichen
  node scripts/engine-sync.mjs --uebernehmen <d>  kopiert die Datei <d> aus copilot-ninja hierher (nur Dateien der Liste GLEICH)

  GLEICH: Dateien, die in beiden Seiten identisch sein muessen.
  ANGEPASST: Dateien, die aus copilot-ninja stammen und hier nur ueber Konfiguration abweichen. Der Abgleich zeigt die Zeilen,
  die sich unterscheiden, damit ein Fix in einer Seite bewusst in die andere uebernommen wird (Bauplan, Schutzregel 2).
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const ANDERE = path.resolve(ROOT, CFG.copilot_ninja_pfad);
const GLEICH = ['scripts/pre-push', 'assets/fonts/dojo-display-600.woff2', 'assets/fonts/dojo-display-700.woff2', 'assets/fonts/OFL.txt', 'assets/fonts/LIESMICH.txt', 'templates/partials/tusch.svg'];
const ANGEPASST = ['scripts/links.mjs', 'assets/js/theme-init.js'];

if (!fs.existsSync(ANDERE)) { console.error(`copilot-ninja nicht gefunden: ${ANDERE}`); process.exit(1); }
const i = process.argv.indexOf('--uebernehmen');
if (i > -1) {
  const datei = process.argv[i + 1];
  if (!GLEICH.includes(datei)) { console.error(`Nur Dateien aus GLEICH lassen sich übernehmen: ${GLEICH.join(', ')}`); process.exit(1); }
  fs.copyFileSync(path.join(ANDERE, datei), path.join(ROOT, datei));
  console.log(`${datei} aus copilot-ninja übernommen`);
  process.exit(0);
}
let abweichend = 0;
for (const d of GLEICH) {
  const a = path.join(ROOT, d), b = path.join(ANDERE, d);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { console.log(`FEHLT  ${d}`); abweichend++; continue; }
  const gleich = Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0;
  console.log(`${gleich ? 'GLEICH' : 'ANDERS'} ${d}`);
  if (!gleich) abweichend++;
}
for (const d of ANGEPASST) {
  const a = path.join(ROOT, d), b = path.join(ANDERE, d);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { console.log(`FEHLT  ${d}`); continue; }
  const za = fs.readFileSync(a, 'utf8').split(/\r?\n/), zb = new Set(fs.readFileSync(b, 'utf8').split(/\r?\n/));
  const nur = za.filter(z => z.trim() && !zb.has(z));
  console.log(`ANGEPASST ${d}: ${nur.length} Zeilen weichen ab`);
  nur.slice(0, 8).forEach(z => console.log(`    ${z.trim().slice(0, 110)}`));
}
console.log(abweichend ? `\n${abweichend} gemeinsame Dateien weichen ab. Mit --uebernehmen <datei> angleichen oder den Fix nach copilot-ninja zurückführen.` : '\nAlle gemeinsamen Dateien sind gleich.');
process.exit(abweichend ? 1 : 0);
