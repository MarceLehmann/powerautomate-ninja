#!/usr/bin/env node
/*
  Power Platform Dojo (Power Automate): Veroeffentlichungs- und Aenderungsdatum je Technik-Seite aus der Git-Historie.
  node scripts/seitendaten-aus-git.mjs   schreibt data/seitendaten.json

  Quelle ist git blame auf data/techniken.json (Stand HEAD, nur eingecheckte Zeilen): frueheste Zeile eines Eintrags =
  datePublished, spaeteste Zeile = dateModified. Der Build liest nur die Datei, nicht die Historie. Nach Aenderungen an
  data/techniken.json und Commit neu ausfuehren.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATEI = 'data/techniken.json';
const text = execFileSync('git', ['blame', '--porcelain', 'HEAD', '--', DATEI], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const zeit = {}, zeileSha = {};
let sha = null;
for (const z of text.split('\n')) {
  const kopf = z.match(/^([0-9a-f]{40}) \d+ (\d+)/);
  if (kopf) { sha = kopf[1]; zeileSha[kopf[2]] = sha; continue; }
  const t = z.match(/^author-time (\d+)/);
  if (t && sha) zeit[sha] = Number(t[1]);
}
const zeilen = execFileSync('git', ['show', `HEAD:${DATEI}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n');
const iso = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const starts = [];
zeilen.forEach((z, i) => { if (/^ {6}"schluessel":/.test(z)) starts.push(i); }); // Zeile i (0-basiert) = i+1, die oeffnende Klammer steht davor
const aus = {};
starts.forEach((s, k) => {
  const von = s, bis = (k + 1 < starts.length ? starts[k + 1] - 1 : zeilen.length - 1);
  let slug = null, frueh = Infinity, spaet = 0;
  for (let i = von; i < bis; i++) {
    const m = zeilen[i].match(/^ {6}"slug": "([^"]+)"/); if (m) slug = m[1];
    const t = zeit[zeileSha[String(i + 1)]];
    if (t) { frueh = Math.min(frueh, t); spaet = Math.max(spaet, t); }
  }
  if (slug && frueh !== Infinity) aus[slug] = { publiziert: iso(frueh), geaendert: iso(spaet) };
});
fs.writeFileSync(path.join(ROOT, 'data/seitendaten.json'), JSON.stringify({ quelle: 'git blame data/techniken.json', erzeugt_aus_commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), seiten: aus }, null, 1) + '\n');
console.log(`${Object.keys(aus).length} Eintraege`);
