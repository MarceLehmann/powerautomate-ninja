#!/usr/bin/env node
/*
  KMUpower Flow-Dojo (Engine aus copilot-ninja): interne Links unter zwei Basen pruefen. Aendert nichts, braucht kein Netz.
  node scripts/links.mjs              Vorschau und Produktion pruefen, Vorschau-Seiten nur als Hinweis
  node scripts/links.mjs --livegang   zusaetzlich Abbruch, wenn noch Vorschau-Seiten (Banner, noindex) im Ordner liegen.
                                      Laeuft als Git-Hook vor jedem Push (scripts/pre-push, Einrichtung im README).

  Prueft jede veroeffentlichte HTML-Seite so, als laege die Website
    a) unter base_url aus site.config.json (Testphase: Unterpfad)
    b) unter einer eigenen Domain                           (Basis /)
  Fuer jedes href und src ohne Schema: Ziel existiert, verlaesst die Basis nicht, Sprungmarke existiert.
  Absolute URLs auf BASE_URL (404.html, Canonical, Sitemap) muessen auf eine vorhandene Datei zeigen.
  Zusaetzlich: sitemap.xml gegen die indexierbaren Seiten.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Eine Quelle fuer die Basis: base_url in site.config.json (beim Domainwechsel nur dort aendern)
const BASE_URL = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')).base_url;
if (!BASE_URL) { console.error('base_url in site.config.json fehlt'); process.exit(1); }
const LIVEGANG = process.argv.includes('--livegang');
const BASEN = [new URL(BASE_URL).pathname, '/'];
const AUSGESCHLOSSEN = /^(\.git|_recherche|templates|node_modules|scripts|data)$/;

function htmlDateien(d = '') {
  const aus = [];
  for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = d ? `${d}/${f.name}` : f.name;
    if (f.isDirectory()) { if (!AUSGESCHLOSSEN.test(f.name)) aus.push(...htmlDateien(rel)); }
    else if (f.name.endsWith('.html')) aus.push(rel);
  }
  return aus;
}

const cache = new Map();
const lesen = (rel) => { if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')); return cache.get(rel); };
const ids = (rel) => new Set([...lesen(rel).matchAll(/\s(?:id|name)="([^"]+)"/g)].map(m => m[1]));

/* Pfad innerhalb der Website auf eine Datei abbilden, null wenn nichts da ist */
function datei(innen) {
  let p = decodeURIComponent(innen);
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const voll = path.join(ROOT, p);
  if (fs.existsSync(voll) && fs.statSync(voll).isFile()) return p;
  if (fs.existsSync(voll) && fs.statSync(voll).isDirectory() && fs.existsSync(path.join(voll, 'index.html'))) return p + '/index.html';
  return null;
}

const fehler = [];
const hinweise = [];
const seiten = htmlDateien();
let gezaehlt = 0;

for (const rel of seiten) {
  const html = lesen(rel);
  const refs = [...html.matchAll(/\s(href|src)="([^"]*)"/g)].map(m => m[2].replace(/&amp;/g, '&'));
  const istIndex = rel.endsWith('index.html');
  // 404.html wird in jeder Tiefe ausgeliefert und nutzt Pfade ab der Basis aus BASE_URL. Sie gilt nur fuer diese Basis
  // und wird beim Domainwechsel mit BASE_URL neu gebaut.
  for (const basis of /404.html$/.test(rel) ? [new URL(BASE_URL).pathname] : BASEN) {
    const seitenPfad = basis + (istIndex ? rel.slice(0, -'index.html'.length) : rel);
    const seitenUrl = new URL(seitenPfad, 'http://pruefen.local');
    for (const ref of refs) {
      if (/^(mailto:|tel:|data:|blob:|javascript:)/i.test(ref)) continue;
      if (/^https?:\/\//i.test(ref)) {
        if (!ref.startsWith(BASE_URL)) continue; // fremde Links nur in <a>, prueft build.mjs
        if (basis !== BASEN[0]) continue; // absolute URLs gelten fuer die Basis von BASE_URL
        const innen = ref.slice(BASE_URL.length).split('#')[0].split('?')[0];
        if (!datei(innen)) fehler.push(`${rel}: ${ref} zeigt auf keine Datei`);
        gezaehlt++;
        continue;
      }
      if (ref.startsWith('#')) {
        const anker = ref.slice(1);
        if (anker && !anker.includes('=') && !ids(rel).has(anker) && basis === BASEN[0]) fehler.push(`${rel}: Sprungmarke ${ref} fehlt`);
        continue;
      }
      if (ref.startsWith('//')) { fehler.push(`${rel}: protokollrelativer Link ${ref}`); continue; }
      if (ref.startsWith("/") && !/404.html$/.test(rel)) { fehler.push(`${rel} [${basis}]: absoluter Pfad ${ref}`); continue; }
      const ziel = new URL(ref, seitenUrl);
      if (!ziel.pathname.startsWith(basis)) { fehler.push(`${rel} [${basis}]: ${ref} verlaesst die Basis (${ziel.pathname})`); continue; }
      const innen = ziel.pathname.slice(basis.length);
      const f = datei(innen);
      gezaehlt++;
      if (!f) { fehler.push(`${rel} [${basis}]: ${ref} fehlt (${innen || 'index.html'})`); continue; }
      const anker = ziel.hash.slice(1);
      if (anker && !anker.includes('=') && f.endsWith('.html') && !ids(f).has(decodeURIComponent(anker)) && basis === BASEN[0]) fehler.push(`${rel}: ${ref} Sprungmarke fehlt in ${f}`);
    }
  }
}

/* Sitemap gegen indexierbare Seiten */
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
let vorschauNoindex = 0;
const inSitemap = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
for (const u of inSitemap) {
  if (!u.startsWith(BASE_URL)) { fehler.push(`sitemap.xml: ${u} liegt nicht unter BASE_URL`); continue; }
  const f = datei(u.slice(BASE_URL.length));
  if (!f) { fehler.push(`sitemap.xml: ${u} zeigt auf keine Datei`); continue; }
  if (/<meta name="robots" content="[^"]*noindex/.test(lesen(f))) {
    if (/Interne Vorschau|content="testphase"/.test(lesen(f))) vorschauNoindex++;
    else fehler.push(`sitemap.xml: ${u} ist noindex`);
  }
}
if (vorschauNoindex) (LIVEGANG ? fehler : hinweise).push(`Vorschau-Build: ${vorschauNoindex} Seiten der Sitemap tragen noindex wegen fehlender Freigabe. Vor dem Livegang mit --produktion bauen.`);
if (LIVEGANG) for (const rel of seiten) if (/class="vorschau-banner"/.test(lesen(rel))) fehler.push(`${rel}: Vorschau-Banner im Livegang`);
for (const rel of seiten) {
  const html = lesen(rel);
  if (/404.html$/.test(rel) || /<meta name="robots" content="[^"]*noindex/.test(html)) continue;
  const url = BASE_URL + (rel.endsWith('index.html') ? rel.slice(0, -'index.html'.length) : rel);
  if (!inSitemap.has(url)) fehler.push(`sitemap.xml: indexierbare Seite fehlt: ${url}`);
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canon) hinweise.push(`${rel}: kein Canonical`);
  else if (canon[1] !== url) hinweise.push(`${rel}: Canonical ${canon[1]} statt ${url}`);
}

console.log(`Links geprueft: ${seiten.length} Seiten, ${gezaehlt} Verweise, Basen ${BASEN.join(' und ')}`);
console.log(`Sitemap: ${inSitemap.size} URLs`);
hinweise.forEach(h => console.log('Hinweis: ' + h));
if (fehler.length) { console.log(`\n${fehler.length} Fehler:`); [...new Set(fehler)].forEach(f => console.log('  ' + f)); process.exit(1); }
console.log('OK, keine Fehler');
