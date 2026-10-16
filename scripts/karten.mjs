#!/usr/bin/env node
/*
  KMUpower Flow-Dojo: Vorschaubilder (og:image) als PNG aus den SVG-Dateien rendern, die build.mjs schreibt.
  Braucht ein lokales Chrome oder Edge (Pfad per CHROME=...). Danach nicht neu bauen noetig, die Seiten verweisen schon auf die PNG.
  node scripts/karten.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
if (!chrome) { console.error('Kein Chrome gefunden (CHROME=Pfad setzen)'); process.exit(1); }
const liste = ['og-image.svg', ...fs.readdirSync(path.join(ROOT, 'assets/img')).filter(f => /^guertel-.*\.svg$/.test(f)).map(f => `assets/img/${f}`)];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowdojo-'));
let n = 0;
for (const svg of liste) {
  const voll = path.join(ROOT, svg);
  if (!fs.existsSync(voll)) { console.warn(`fehlt: ${svg}`); continue; }
  const html = path.join(tmpDir, 'render.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><img src="file:///${voll.replace(/\\/g, '/')}" width="1200" height="630" alt=""></body></html>`);
  const png = voll.replace(/\.svg$/, '.png');
  try {
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', `--screenshot=${png}`, '--window-size=1200,630', 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
    n++;
  } catch (e) { console.warn(`${svg}: Chrome-Aufruf fehlgeschlagen (${e.message})`); }
}
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`${n} von ${liste.length} Vorschaubildern als PNG geschrieben`);
