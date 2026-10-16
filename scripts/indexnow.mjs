#!/usr/bin/env node
/*
  PowerPlatformAcademy Dojo (Power Automate): alle URLs der Sitemap an IndexNow melden (Bing, Yandex, Seznam, Naver teilen die Meldung).
  node scripts/indexnow.mjs            liest sitemap.xml aus dem Ordner, sendet an api.indexnow.org
  node scripts/indexnow.mjs --trocken  zeigt nur, was gesendet wuerde
  Key: indexnow_key in site.config.json, die Datei <key>.txt im Stamm schreibt build.mjs. Keine Abhaengigkeiten, Node 18+.
  Laeuft automatisch nach jedem Pages-Build (.github/workflows/indexnow.yml).
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const key = CFG.indexnow_key, base = CFG.base_url;
if (!key || !/^[a-f0-9]{32}$/.test(key)) { console.error('indexnow_key fehlt in site.config.json'); process.exit(1); }
const host = new URL(base).hostname;
if (host.endsWith('github.io')) { console.log('Testphase unter github.io: keine Meldung an IndexNow.'); process.exit(0); }
const urls = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(u => u.startsWith(base));
const body = { host, key, keyLocation: `${base}${key}.txt`, urlList: urls };
console.log(`${urls.length} URLs fuer ${host}, Key-Datei ${body.keyLocation}`);
if (process.argv.includes('--trocken')) process.exit(0);
const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
console.log(`IndexNow: HTTP ${res.status} ${res.statusText}`);
if (![200, 202].includes(res.status)) { console.log(await res.text()); process.exit(1); }
