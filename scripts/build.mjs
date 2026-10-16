#!/usr/bin/env node
/*
  KMUpower Flow-Dojo: Generator und Validierung. Node 18 oder neuer, keine Abhaengigkeiten.

  node scripts/build.mjs --testphase     Testphase: jede Seite noindex, kein Banner (Standard bis zum Livegang)
  node scripts/build.mjs --produktion    Livegang: Index-Regeln aus dem Bauplan, Sitemap nur indexierbare Seiten
  node scripts/build.mjs --pruefen       nur Validierung, schreibt nichts
  Zusatz: --datum=JJJJ-MM-TT             Build-Datum (Standard: heute, lokale Zeit)
          --tipp-quelle <pfad>           Ordner _posts des Tipp-Repos fuer die Pruefung der Ausdruecke
                                         (Standard: tipp_quelle aus site.config.json)

  Alle Seitenwerte stehen in site.config.json, alle Zahlen zu Limits in data/limits.json,
  alle Inhalte in data/techniken.json. Seitenrahmen in templates/partials, CSS-Quelle in templates/css.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const BASE_URL = CFG.base_url;
const BASIS_PFAD = new URL(BASE_URL).pathname;
const KURZ_BASIS = BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const NAME = CFG.name;
const GENERATOR = '<meta name="generator" content="KMUpower Flow-Dojo build">';

const ARGS = process.argv.slice(2);
const MODUS = ARGS.includes('--produktion') ? 'produktion' : ARGS.includes('--pruefen') ? 'pruefen' : 'testphase';
const TESTPHASE = MODUS !== 'produktion';
const DATUM = (ARGS.find(a => a.startsWith('--datum=')) || '').slice(8) || lokalesDatum(new Date());
const TIPP_QUELLE = path.resolve(ROOT, (() => { const i = ARGS.indexOf('--tipp-quelle'); return i > -1 ? ARGS[i + 1] : CFG.tipp_quelle; })());
const MIN_WOERTER_INDEX = 240; // «rund 250 Woerter eigener Inhalt» (Bauplan Abschnitt 9)

const fehlerListe = [], warnListe = [], geschrieben = [];
const fehler = (m) => fehlerListe.push(m);
const warnung = (m) => warnListe.push(m);

/* Hilfen */
function lokalesDatum(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function lies(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function gibtEs(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function istIso(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function datumCH(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function tageZwischen(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
function woerter(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function schreibe(rel, inhalt) {
  if (MODUS === 'pruefen') return;
  const ziel = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, inhalt);
  geschrieben.push(rel.replace(/\\/g, '/'));
}
function praefix(rel) { const tiefe = rel.split('/').length - 1; return tiefe ? '../'.repeat(tiefe) : ''; }
function jsonLd(obj) { return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n</script>`; }
const utm = (stelle) => `utm_source=${encodeURIComponent(CFG.utm_source)}&utm_medium=${encodeURIComponent(CFG.utm_medium)}&utm_content=${encodeURIComponent(stelle)}`;
const mitUtm = (url, stelle) => `${url}${url.includes('?') ? '&' : '?'}${utm(stelle)}`;
const kursUrl = (stelle) => mitUtm(CFG.kurs_url, stelle);

/* Mini-Templates wie copilot-ninja: {{feld}} escaped, {{{feld}}} roh, {{> partial}} */
const partialCache = {};
function partial(name) {
  if (!partialCache[name]) {
    const datei = `templates/partials/${name}.html`;
    if (!gibtEs(datei)) { fehler(`Partial fehlt: ${datei}`); return ''; }
    partialCache[name] = lies(datei).replace(/\s+$/, '');
  }
  return partialCache[name];
}
function render(tpl, ctx, quelle) {
  return tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => render(partial(n), ctx, n)).replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (_, roh, feld) => {
    const n = roh || feld;
    if (!(n in ctx)) { warnung(`${quelle}: Variable «${n}» fehlt`); return ''; }
    return roh ? String(ctx[n] ?? '') : esc(ctx[n]);
  });
}

/* Daten */
const daten = JSON.parse(lies('data/techniken.json'));
const LIMITS = JSON.parse(lies('data/limits.json'));
const FARBEN = ['weiss', 'gelb', 'orange', 'gruen', 'blau', 'braun', 'schwarz'];
const GNAMEN = ['Weisser Gürtel', 'Gelber Gürtel', 'Oranger Gürtel', 'Grüner Gürtel', 'Blauer Gürtel', 'Brauner Gürtel', 'Schwarzer Gürtel'];
const GKURZ = ['Weiss', 'Gelb', 'Orange', 'Grün', 'Blau', 'Braun', 'Schwarz'];
const GAKK = ['den weissen Gürtel', 'den gelben Gürtel', 'den orangen Gürtel', 'den grünen Gürtel', 'den blauen Gürtel', 'den braunen Gürtel', 'den schwarzen Gürtel'];
const BAND_HEX = ['#FBFAF5', '#E2B100', '#E36A00', '#2E8B57', '#2F6FB5', '#7A4A2B', '#111111'];
const GUERTEL = FARBEN.map((farbe, i) => ({ nr: i + 1, farbe, name: GNAMEN[i], kurz: GKURZ[i], akk: GAKK[i], hex: BAND_HEX[i], leitwort: '', kannst_du: '', erreicht_satz: '', ...((daten.guertel || []).find(g => g.nr === i + 1) || {}) }));

/* Platzhalter {limit:schluessel} aus data/limits.json einsetzen */
function setzeLimits(text, wo) {
  return String(text).replace(/\{limit:([a-z_]+)\}/g, (_, k) => {
    const l = LIMITS.limits[k];
    if (!l) { fehler(`${wo}: unbekanntes Limit «${k}»`); return ''; }
    if (!String(l.learn_url || '').startsWith('https://learn.microsoft.com/')) fehler(`limits.json ${k}: learn_url fehlt`);
    return l.text;
  });
}
function mitLimits(obj, wo) {
  if (typeof obj === 'string') return setzeLimits(obj, wo);
  if (Array.isArray(obj)) return obj.map(x => mitLimits(x, wo));
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, mitLimits(v, wo)]));
  return obj;
}
const ALLE = daten.techniken.map(t => mitLimits(t, `Tipp ${t.schluessel}`));
const SEITEN = ALLE.filter(t => t.seite).sort((a, b) => a.guertel - b.guertel || (a.tipp_nr || 0) - (b.tipp_nr || 0));
const POOL = ALLE.filter(t => t.pool);
const NACH_KEY = Object.fromEntries(ALLE.map(t => [t.schluessel, t]));
const urlTechnik = (t) => `${BASE_URL}techniken/${t.slug}/`;
const tippLabel = (t) => t.tipp_nr ? `PowerPlatformTip #${t.tipp_nr}` : 'Artikel auf powerplatformtip.com';
const BUCHST = ['A', 'B', 'C'];

/* Validierung */
const VERBOTEN = [[/[\u2013\u2014]/, 'Gedankenstrich'], [/\u00df/, 'Eszett'], [/\p{Extended_Pictographic}/u, 'Emoji'], [/ - /, '« - » als Gedankenstrich'], [/nicht getestet|laut Doku/i, 'Testhinweis'], [/Power Automate Ninja|powerautomate[\s-]ninja/i, 'Marke als Name']];
function texte(wert, pfad, aus = []) {
  if (typeof wert === 'string') aus.push([pfad, wert]);
  else if (Array.isArray(wert)) wert.forEach((v, i) => texte(v, `${pfad}[${i}]`, aus));
  else if (wert && typeof wert === 'object') Object.entries(wert).forEach(([k, v]) => { if (!/url|beleg|tipp_titel|schluessel|slug|ausdruck/.test(k)) texte(v, `${pfad}.${k}`, aus); });
  return aus;
}
const tippDateien = fs.existsSync(TIPP_QUELLE) ? fs.readdirSync(TIPP_QUELLE) : null;
if (!tippDateien) warnung(`Tipp-Quelle ${TIPP_QUELLE} fehlt: Ausdrücke werden nicht gegen die Tipps geprüft`);
function eigeneWoerter(t) {
  return woerter(t.kurztext_de) + woerter(t.quiz.frage) + t.quiz.antworten.reduce((s, a) => s + woerter(a), 0) + t.quiz.erklaerungen.reduce((s, a) => s + woerter(a), 0) + woerter(t.wann_ja) + woerter(t.wann_nein) + woerter(t.fehler);
}
function validiere() {
  const slugs = new Set();
  for (const g of GUERTEL) texte(g, `guertel ${g.farbe}`).forEach(([p, s]) => VERBOTEN.forEach(([re, w]) => re.test(s) && fehler(`${p}: enthält ${w}`)));
  for (const t of POOL) {
    const wo = `Tipp ${t.schluessel}`;
    const q = t.quiz || {};
    if (!q.frage || !Array.isArray(q.antworten) || q.antworten.length !== 3 || !Number.isInteger(q.richtig_index) || q.richtig_index < 0 || q.richtig_index > 2) fehler(`${wo}: Quiz unvollständig (Frage, drei Antworten, richtig_index)`);
    if (!Number.isInteger(t.guertel) || t.guertel < 1 || t.guertel > 7) fehler(`${wo}: guertel 1 bis 7`);
    texte({ quiz: t.quiz }, wo).forEach(([p, s]) => VERBOTEN.forEach(([re, w]) => re.test(s) && fehler(`${p}: enthält ${w}`)));
    if (!t.seite && Array.isArray(q.antworten)) {
      q.antworten.forEach((a, i) => { if (woerter(a) > 12) fehler(`${wo}: Antwort ${BUCHST[i]} über 12 Wörter`); });
      const l = q.antworten.map(a => a.length), andere = l.filter((_, i) => i !== q.richtig_index);
      if (l[q.richtig_index] > Math.max(...andere) * 1.4 && l[q.richtig_index] - Math.max(...andere) > 12) warnung(`${wo}: richtige Antwort deutlich länger als die falschen (${l.join('/')} Zeichen)`);
      if (!(q.erklaerungen || [])[q.richtig_index]) warnung(`${wo}: Prüfungsfrage ohne Erklärung`);
    }
  }
  for (const t of SEITEN) {
    const wo = `Tipp ${t.schluessel}`;
    for (const f of ['slug', 'titel_de', 'kurztext_de', 'wann_ja', 'wann_nein', 'fehler', 'lizenz', 'learn_url', 'learn_titel']) if (!t[f]) fehler(`${wo}: Pflichtfeld «${f}» fehlt`);
    if (t.slug) { if (slugs.has(t.slug)) fehler(`${wo}: slug doppelt`); slugs.add(t.slug); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) fehler(`${wo}: slug nur [a-z0-9-]`); }
    if (!t.pool) fehler(`${wo}: Seite ohne Pool-Frage`);
    if ((t.quiz.erklaerungen || []).length !== 3) fehler(`${wo}: drei Erklärungen nötig`);
    t.quiz.antworten.forEach((a, i) => { if (woerter(a) > 12) fehler(`${wo}: Antwort ${BUCHST[i]} über 12 Wörter`); });
    const laengen = t.quiz.antworten.map(a => a.length);
    if (Math.max(...laengen) > Math.min(...laengen) * 1.6) warnung(`${wo}: Antworten ungleich lang (${laengen.join('/')} Zeichen)`);
    const w = woerter(t.kurztext_de);
    if (w < 80 || w > 150) fehler(`${wo}: Kurztext ${w} Wörter, erlaubt 80 bis 150`);
    if (t.lizenz !== 'standard' && t.lizenz !== 'premium') fehler(`${wo}: lizenz nur standard oder premium`);
    const belege = t.lizenz_belege || [];
    if (!belege.length || !belege.every(b => String(b.url).startsWith('https://learn.microsoft.com/'))) fehler(`${wo}: Lizenz ohne Beleg bei Microsoft Learn`);
    if (!String(t.learn_url).startsWith('https://learn.microsoft.com/')) fehler(`${wo}: learn_url muss auf learn.microsoft.com zeigen`);
    texte(t, wo).forEach(([p, s]) => VERBOTEN.forEach(([re, w2]) => re.test(s) && fehler(`${p}: enthält ${w2}`)));
    if (t.ausdruck && tippDateien) {
      const datei = tippDateien.find(f => new RegExp(`powerplatformtip-${t.tipp_nr}-`, 'i').test(f));
      if (!datei) fehler(`${wo}: Tipp-Datei in ${TIPP_QUELLE} nicht gefunden`);
      else if (!fs.readFileSync(path.join(TIPP_QUELLE, datei), 'utf8').includes(t.ausdruck)) fehler(`${wo}: Ausdruck «${t.ausdruck}» steht nicht wörtlich im Tipp (${datei})`);
    }
    t._woerter = eigeneWoerter(t);
  }
  for (const k of daten.tag_reihenfolge || []) if (!NACH_KEY[k] || !NACH_KEY[k].seite) fehler(`tag_reihenfolge: «${k}» hat keine Seite`);
}
validiere();

/* Bausteine */
const ICONS = {
  suche: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  sonne: '<svg class="icon-sonne" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  mond: '<svg class="icon-mond" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  menue: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18M3 12h18M3 18h12"/></svg>',
  zu: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5L5 19"/></svg>'
};
// Gurtknoten als Zeichen der Seite (keine Microsoft-Farben, keine Produktsymbole)
const KNOTEN_PFADE = '<path class="band" d="M2 11h28v7H2z"/><path class="band" d="M12.5 17.5L8 29h5.2l3-6.4M19.5 17.5L24 29h-5.2l-3-6.4"/><rect class="knoten-k" x="11.5" y="8.5" width="9" height="12" rx="2.2"/>';
const markeKnoten = `<svg class="marke__knoten" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${KNOTEN_PFADE}</svg>`;
const bandPunkt = (n) => `<span class="band-punkt" data-guertel-nr="${n}" aria-hidden="true"></span>`;
const guertelTag = (n) => `<span class="guertel-tag" data-guertel-nr="${n}">${bandPunkt(n)}${esc(GUERTEL[n - 1].name)}</span>`;
function lizenzBadge(t, r) {
  if (t.lizenz === 'premium') return '<span class="badge badge--premium">Premium</span>';
  return '<span class="badge badge--standard">Standard</span>';
}
const LIZENZ_SATZ = {
  standard: 'Läuft ohne Premium-Connector, also mit der Lizenz aus Microsoft 365.',
  premium: 'Braucht Power Automate Premium oder eine andere Lizenz mit Premium-Connectoren.'
};
const mailtoFehler = (t) => `mailto:${CFG.kontakt}?subject=${encodeURIComponent(`Flow-Dojo: Fehler in Frage ${t.tipp_nr || t.schluessel}`)}&body=${encodeURIComponent(`Frage: ${t.quiz.frage}\n\nWas stimmt nicht?\n\n`)}`;
function linkedinUrl(text) { return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`; }
function teilenText(t) {
  return `Quizfrage für alle, die Flows bauen: ${t.quiz.frage}\n\n${t.quiz.antworten.map((a, i) => `${BUCHST[i]}) ${a}`).join('\n')}\n\nAuflösung mit Erklärung im KMUpower Flow-Dojo: ${urlTechnik(t)}`;
}
function karte(t, r) {
  const such = [t.titel_de, t.thema, ...(t.suchbegriffe || []), String(t.tipp_nr || '')].join(' ').toLowerCase();
  return `<li class="karte" data-technik="${esc(t.schluessel)}" data-guertel-nr="${t.guertel}" data-thema="${esc(t.thema)}" data-lizenz="${t.lizenz}" data-such="${esc(such)}">
<span class="klein">Tipp ${t.tipp_nr}</span>
<h3><a href="${r}techniken/${t.slug}/">${esc(t.titel_de)}</a></h3>
<p>${esc(t.lernziel || '')}</p>
<div class="karte__meta">${t.lizenz === 'premium' ? '<span class="badge badge--premium">Premium</span>' : '<span class="badge badge--standard">Standard</span>'}<span>${esc(t.thema)}</span><span class="karte__status" data-status hidden></span></div>
</li>`;
}
function abzeichenSvg(n, klasse = '') { return `<svg class="${klasse}" viewBox="0 0 32 32" data-guertel-nr="${n}" aria-hidden="true" focusable="false">${KNOTEN_PFADE}</svg>`; }

/* Lizenz-Check: vier Fragen, Quellen nur Microsoft Learn (Stand im Kopf von data/limits.json) */
const LQ = [
  { id: 'q1', frage: 'Mit welchen Datenquellen arbeitet dein Flow?', hinweis: 'SharePoint, Office 365 Outlook, Microsoft Teams und Excel Online (Business) sind Standard-Connectoren.', optionen: [
    { v: 'm365', text: 'Nur SharePoint, Outlook, Teams oder Excel', wirkung: 'standard' },
    { v: 'andere', text: 'Auch andere Systeme oder Fachanwendungen', wirkung: 'pruefen', punkt: 'Connectoren zu anderen Systemen: Ob sie Standard oder Premium sind, zeigt die Liste der Premium-Connectoren.' },
    { v: 'unklar', text: 'Weiss ich noch nicht', wirkung: 'pruefen', punkt: 'Datenquellen klären und in der Liste der Premium-Connectoren nachsehen.' }] },
  { id: 'q2', frage: 'Brauchst du einen Custom Connector oder «HTTP with Microsoft Entra ID»?', hinweis: '', optionen: [
    { v: 'nein', text: 'Nein', wirkung: 'standard' },
    { v: 'ja', text: 'Ja', wirkung: 'premium', punkt: 'Custom Connector oder HTTP with Microsoft Entra ID' },
    { v: 'andere', text: 'Ich rufe eine andere Web-Schnittstelle auf', wirkung: 'pruefen', punkt: 'Für andere Web-Schnittstellen: Zeigt die Aktion im Designer das Premium-Kennzeichen, brauchst du Premium.' }] },
  { id: 'q3', frage: 'Liest oder schreibt dein Flow Daten in Dataverse?', hinweis: '', optionen: [
    { v: 'nein', text: 'Nein', wirkung: 'standard' },
    { v: 'ja', text: 'Ja', wirkung: 'premium', punkt: 'Microsoft Dataverse' }] },
  { id: 'q4', frage: 'Soll dein Cloud Flow einen Desktop Flow auf einem Rechner starten?', hinweis: '', optionen: [
    { v: 'nein', text: 'Nein', wirkung: 'standard' },
    { v: 'ja', text: 'Ja', wirkung: 'premium', punkt: 'Desktop Flows aus einem Cloud Flow (RPA)' }] }
];
const LQUELLEN = [
  { url: 'https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs', titel: 'Power Automate licensing FAQ' },
  { url: 'https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/deep-dive-on-specific-license', titel: 'Deep dive on specific licenses' },
  { url: 'https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-standard-connectors', titel: 'List of all Standard tier connectors' },
  { url: 'https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-premium-connectors', titel: 'List of all Premium tier connectors' },
  { url: 'https://learn.microsoft.com/en-us/connectors/commondataserviceforapps/', titel: 'Microsoft Dataverse, Connector-Referenz' },
  { url: 'https://learn.microsoft.com/en-us/connectors/webcontents/', titel: 'HTTP with Microsoft Entra ID (preauthorized), Connector-Referenz' }
];

/* Rahmen */
const NAV = { wand: 'techniken', technik: 'techniken', pruefung: 'pruefung', premium: 'premium', dojo: 'dojo' };
function seite(rel, p) {
  const r = p.absolut ? BASIS_PFAD : praefix(rel);
  const cur = (n) => NAV[p.seite] === n ? (/^(wand|pruefung|premium|dojo)$/.test(p.seite) ? ' aria-current="page"' : ' aria-current="true"') : '';
  const ctx = {
    r, name: NAME, marke_knoten: markeKnoten,
    icon_suche: ICONS.suche, icon_sonne: ICONS.sonne, icon_mond: ICONS.mond, icon_menue: ICONS.menue, icon_zu: ICONS.zu,
    cur_techniken: cur('techniken'), cur_pruefung: cur('pruefung'), cur_premium: cur('premium'), cur_dojo: cur('dojo'),
    js_extra: (p.js || []).map(s => `<script src="${r}assets/js/${s}" defer></script>`).join('\n'),
    tipp_fuss: mitUtm('https://www.powerplatformtip.com/', 'fusszeile'), academy_fuss: mitUtm(CFG.academy_url, 'fusszeile')
  };
  const noindex = TESTPHASE || p.noindex;
  const bild = p.ogBild || `${BASE_URL}og-image.png`;
  const meta = [GENERATOR, `<title>${esc(p.titel)}</title>`, `<meta name="description" content="${esc(p.beschreibung)}">`];
  if (noindex) meta.push('<meta name="robots" content="noindex">');
  if (TESTPHASE) meta.push('<meta name="dojo-build" content="testphase">');
  if (p.canonical) meta.push(`<link rel="canonical" href="${p.canonical}">`);
  meta.push(`<meta property="og:type" content="${p.ogTyp || 'website'}">`, `<meta property="og:site_name" content="${esc(NAME)}">`, '<meta property="og:locale" content="de_CH">',
    `<meta property="og:title" content="${esc(p.ogTitel || p.titel)}">`, `<meta property="og:description" content="${esc(p.beschreibung)}">`);
  if (p.canonical) meta.push(`<meta property="og:url" content="${p.canonical}">`);
  meta.push(`<meta property="og:image" content="${bild}">`, '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">');
  if (p.jsonld) meta.push(jsonLd({ '@context': 'https://schema.org', '@graph': p.jsonld }));
  const html = `<!doctype html>
<html lang="de-CH" data-seite="${p.seite}" data-r="${r}">
<head>
<meta charset="utf-8">
${render(partial('head'), ctx, 'head')}
${meta.join('\n')}
</head>
<body>
${render(partial('kopf'), ctx, 'kopf')}
${p.haupt.trim()}
${render(partial('fuss'), ctx, 'fuss')}
</body>
</html>
`;
  schreibe(rel, html);
}
const LD_ORG = { '@type': 'Organization', '@id': 'https://kmupower.com/#organization', name: 'KMUpower', legalName: 'Marcel Lehmann (Handelsname KMUpower)', url: 'https://kmupower.com/' };
const LD_WEBSITE = { '@type': 'WebSite', '@id': `${BASE_URL}#website`, name: NAME, url: BASE_URL, inLanguage: 'de-CH', description: 'Fragen, Erklärungen und Gürtelweg für Flows in Power Automate, auf Deutsch. Unabhängige Website ohne Verbindung zu Microsoft.', publisher: { '@id': LD_ORG['@id'] } };
const krumen = (teile) => ({ '@type': 'BreadcrumbList', itemListElement: teile.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const krumenHtml = (r, teile) => `<nav class="krumen" aria-label="Brotkrumen"><ol><li><a href="${r}">Start</a></li>${teile.map(([name, href], i) => `<li><a href="${href}"${i === teile.length - 1 ? ' aria-current="page"' : ''}>${esc(name)}</a></li>`).join('')}</ol></nav>`;

/* Technik des Tages: Rotation nach Datum. Startseite nur Standard, Weiss bis Orange (Bauplan Abschnitt 2). */
const FUER_START = (t) => t && t.lizenz === 'standard' && t.guertel <= 3;
function heuteTechnik(nurStart) {
  const folge = (daten.tag_reihenfolge || []).map(k => NACH_KEY[k]).filter(t => t && t.seite && (!nurStart || FUER_START(t)));
  if (!folge.length) return null;
  const n = ((tageZwischen(daten.tag_start || DATUM, DATUM) % folge.length) + folge.length) % folge.length;
  return folge[n];
}
function quizKarte(t, r, ebene, mitLink = true) {
  return `<article class="tdt" data-guertel-nr="${t.guertel}" data-heute-karte>
<ul class="metazeile"><li>${guertelTag(t.guertel)}</li><li data-heute-badge>${lizenzBadge(t, r)}</li></ul>
<${ebene} class="tdt__frage" data-heute-frage>${esc(t.quiz.frage)}</${ebene}>
<ul class="antworten antworten--drei" data-heute-antworten>${t.quiz.antworten.map((a, i) => `<li><a class="antwort" href="${r}techniken/${t.slug}/?antwort=${i}#quiz"><span class="antwort__b" aria-hidden="true">${BUCHST[i]}</span><span>${esc(a)}</span></a></li>`).join('')}</ul>
${mitLink ? `<p class="klein">Tippe auf eine Antwort, die Auflösung steht auf der Technik-Seite: <a href="${r}techniken/${t.slug}/" data-heute-link>${esc(t.titel_de)}</a></p>` : ''}
</article>`;
}

/* Seiten */
function guertelpfadHtml(r) {
  const zeile = (g) => {
    const tk = SEITEN.filter(t => t.guertel === g.nr).length;
    const fr = POOL.filter(t => t.guertel === g.nr).length;
    const ziel = g.nr === 7 && !tk;
    const zahl = ziel ? 'Ziel' : `${tk} ${tk === 1 ? 'Technik' : 'Techniken'}, ${fr} ${fr === 1 ? 'Frage' : 'Fragen'}`;
    const name = ziel ? `<span class="pfadzeile__name">${esc(g.name)}: ${esc(g.leitwort)}</span>` : `<a class="pfadzeile__name" href="${r}guertel/${g.farbe}/">${esc(g.name)}: ${esc(g.leitwort)}</a>`;
    return `<li class="pfadzeile${ziel ? ' pfadzeile--ziel' : ''}" data-guertel-nr="${g.nr}"><span class="pfadzeile__band" aria-hidden="true"></span>${name}<span class="pfadzeile__zahl">${zahl}</span><p class="pfadzeile__kann">${esc(g.kannst_du)}</p></li>`;
  };
  return `<ol class="pfadzeilen">${GUERTEL.slice(0, 3).map(zeile).join('\n')}</ol>
<p class="schwelle"><strong>Die Schwelle.</strong> Ab Grün wird es technisch: unsaubere Daten, parallele Schleifen, Aufrufe an SharePoint und Microsoft Graph.</p>
<ol class="pfadzeilen" start="4">${GUERTEL.slice(3).map(zeile).join('\n')}</ol>`;
}
const PRUEF_ANZAHL = () => GUERTEL.slice(0, 6).reduce((s, g) => s + Math.min(g.nr === 6 ? 1 : 2, POOL.filter(t => t.guertel === g.nr).length), 0);

function baueStart() {
  const t = heuteTechnik(true);
  const q1 = LQ[0];
  const haupt = `<main id="main">
<section class="wrap hero" aria-labelledby="h1">
  <div class="hero__band" aria-hidden="true">${GUERTEL.map(g => `<span data-guertel-nr="${g.nr}"></span>`).join('')}</div>
  <span class="label">${esc(NAME)}</span>
  <h1 id="h1">Welcher <span class="strich">Flow-Gürtel</span> bist du?</h1>
  <p class="lead">${PRUEF_ANZAHL()} Fragen, rund vier Minuten. Danach weisst du, was du als Nächstes lernst.</p>
  <div class="knopf-reihe"><a class="knopf knopf--primaer" href="pruefung/">Gürtelprüfung starten</a><a class="knopf" href="premium/">Reicht meine Lizenz?</a></div>
</section>
<section class="block" aria-labelledby="h-lizenz"><div class="wrap sektion--eng">
  <div class="lcheck">
    <span class="label">Lizenz-Check, Frage 1 von ${LQ.length}</span>
    <h2 id="h-lizenz">Reicht die Lizenz aus Microsoft 365 für deinen Flow?</h2>
    <p class="lcheck__frage">${esc(q1.frage)}</p>
    <ul class="antworten antworten--drei">${q1.optionen.map((o, i) => `<li><a class="antwort" href="premium/?q1=${o.v}#q2"><span class="antwort__b" aria-hidden="true">${BUCHST[i]}</span><span>${esc(o.text)}</span></a></li>`).join('')}</ul>
    <p class="klein">Vier Fragen, das Urteil mit Quelle bei Microsoft Learn. Keine Preise, nur der Lizenztyp.</p>
  </div>
</div></section>
<section class="block" aria-labelledby="h-tdt"><div class="wrap sektion--eng">
  <span class="label">Technik des Tages</span>
  <h2 id="h-tdt">Kennst du die Antwort?</h2>
  ${t ? quizKarte(t, '', 'p') : '<p class="leer-hinweis">Die erste Technik des Tages folgt.</p>'}
</div></section>
<section class="block" aria-labelledby="h-pfad"><div class="wrap sektion--eng">
  <span class="label">Der Gürtelweg</span>
  <h2 id="h-pfad">Sieben Gürtel, vom ersten Test bis zur Architektur</h2>
  ${guertelpfadHtml('')}
  <p class="knopf-reihe"><a class="knopf" href="techniken/">Alle Techniken ansehen</a></p>
</div></section>
<section class="block" aria-label="Absender"><div class="wrap sektion--eng">
  <p class="absender">Von Marcel Lehmann, KMUpower. Die Fragen stammen aus den wöchentlichen Tipps auf powerplatformtip.com. Wer Flows mit Begleitung lernen will: <a href="${esc(kursUrl('start'))}" rel="noopener">${esc(CFG.kurs_name)} der Power Platform Academy</a>.</p>
</div></section>
</main>`;
  seite('index.html', {
    seite: 'start', titel: CFG.titel_start, haupt, canonical: BASE_URL,
    beschreibung: 'Welcher Flow-Gürtel bist du? Gürtelprüfung, Lizenz-Check und Techniken mit Erklärung für Flows in Power Automate, auf Deutsch.',
    ogTitel: 'Welcher Flow-Gürtel bist du?', jsonld: [LD_WEBSITE, LD_ORG]
  });
}

function filterHtml() {
  const themen = [...new Set(SEITEN.map(t => t.thema))].sort((a, b) => a.localeCompare(b, 'de'));
  const chip = (f, v, text, k = '') => `<button type="button" class="chip" data-f="${f}" data-v="${esc(v)}" aria-pressed="false">${k}${esc(text)}</button>`;
  return `<div class="filter" data-filter data-nur-js>
<label class="sr-only" for="wand-suche">Techniken durchsuchen</label>
<input class="suchfeld" id="wand-suche" type="search" placeholder="Suchen: JSON, Approval, SharePoint" data-wand-suche autocomplete="off">
<fieldset><legend>Gürtel</legend><div class="chips">${GUERTEL.slice(0, 6).map(g => chip('guertel-nr', g.nr, g.kurz, bandPunkt(g.nr))).join('')}</div></fieldset>
<fieldset><legend>Thema</legend><div class="chips">${themen.map(th => chip('thema', th, th)).join('')}</div></fieldset>
<fieldset><legend>Lizenz</legend><div class="chips">${chip('lizenz', 'standard', 'Standard')}${chip('lizenz', 'premium', 'Premium')}</div></fieldset>
<fieldset><legend>Dein Stand</legend><div class="chips">${chip('stand', 'offen', 'Noch offen')}${chip('stand', 'geuebt', 'Geübt')}</div></fieldset>
<p class="zaehler" data-filter-zaehler role="status" aria-live="polite"></p>
</div>`;
}
function baueWand() {
  const r = '../';
  const abschnitte = GUERTEL.map(g => {
    const drin = SEITEN.filter(t => t.guertel === g.nr);
    return `<section class="guertel-abschnitt sektion--eng" id="${g.farbe}" aria-labelledby="h-${g.farbe}" data-guertel-nr="${g.nr}">
<h2 id="h-${g.farbe}">${bandPunkt(g.nr)}${esc(g.name)}: ${esc(g.leitwort)}</h2>
<p class="klein">${esc(g.kannst_du)}</p>
${drin.length ? `<ul class="karten">${drin.map(t => karte(t, r)).join('\n')}</ul>` : `<p class="leer-hinweis">${g.nr === 7 ? 'Meisterprüfung. Die Techniken für diesen Gürtel folgen, sobald die Tipps dazu überarbeitet sind.' : 'Weitere Techniken folgen mit der nächsten Welle.'}</p>`}
</section>`;
  }).join('\n');
  const haupt = `<main id="main"><div class="wrap">
${krumenHtml(r, [['Techniken', './']])}
<div class="sektion--eng">
<span class="label">Technik-Wand</span>
<h1 id="h1">Alle Techniken</h1>
<p class="lead">${SEITEN.length} Techniken mit Quizfrage, Erklärung und Ausdruck. Jede verweist auf den ganzen Tipp mit Screenshots auf powerplatformtip.com.</p>
${filterHtml()}
</div>
${abschnitte}
</div></main>`;
  seite('techniken/index.html', {
    seite: 'wand', titel: `Alle Techniken für Flows nach Gürtel | ${NAME}`, haupt, canonical: `${BASE_URL}techniken/`,
    beschreibung: `${SEITEN.length} Techniken für Flows in Power Automate, nach Gürtel geordnet. Jede mit Quizfrage, Erklärung auf Deutsch und Link zum ganzen Tipp.`,
    jsonld: [LD_WEBSITE, LD_ORG, { '@type': 'CollectionPage', name: 'Alle Techniken', url: `${BASE_URL}techniken/`, inLanguage: 'de-CH', mainEntity: { '@type': 'ItemList', itemListElement: SEITEN.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: urlTechnik(t), name: t.titel_de })) } }, krumen([['Start', BASE_URL], ['Techniken', `${BASE_URL}techniken/`]])]
  });
}

function baueTechnik(t, i) {
  const r = '../../';
  const g = GUERTEL[t.guertel - 1];
  const url = urlTechnik(t);
  const vor = SEITEN[i - 1], nach = SEITEN[i + 1];
  const q = t.quiz;
  const kurs = t.guertel >= 4 ? `<p class="kurs-zeile">Lieber mit Begleitung? Der <a href="${esc(kursUrl(`technik-${t.tipp_nr}`))}" rel="noopener">${esc(CFG.kurs_name)} der Power Platform Academy</a> führt in vier Wochen von den Grundlagen bis zu Error Handling und Scopes.</p>` : '';
  const indexierbar = !TESTPHASE && t._woerter >= MIN_WOERTER_INDEX;
  const belege = (t.lizenz_belege || []).map(b => `<a href="${esc(b.url)}" rel="noopener">${esc(b.titel)}</a>`).join(', ');
  const haupt = `<main id="main"><div class="wrap">
${krumenHtml(r, [['Techniken', '../'], [t.titel_de, './']])}
<article class="tk" data-technik="${esc(t.schluessel)}" data-guertel-nr="${t.guertel}">
<header class="tk__kopf">
<ul class="metazeile"><li>${guertelTag(t.guertel)}</li><li>${lizenzBadge(t, r)}</li><li class="tk__nr">Tipp ${t.tipp_nr}</li></ul>
<h1 id="h1">${esc(t.titel_de)}</h1>
</header>
<section class="quiz" id="quiz" data-quiz data-richtig="${q.richtig_index}" data-guertel-nr="${t.guertel}" aria-labelledby="h-quiz">
<h2 id="h-quiz" class="label">Quizfrage</h2>
<p class="quiz__frage">${esc(q.frage)}</p>
<ul class="antworten" data-nur-js>${q.antworten.map((a, k) => `<li><button type="button" class="antwort" data-antwort="${k}"><span class="antwort__b" aria-hidden="true">${BUCHST[k]}</span><span>${esc(a)}</span></button></li>`).join('')}</ul>
<p class="quiz__status" data-quiz-status role="status" aria-live="polite"></p>
<div class="aufloesung-block" data-aufloesung>
<h3>Auflösung</h3>
<ol class="aufloesung">${q.antworten.map((a, k) => `<li class="${k === q.richtig_index ? 'richtig' : 'falsch'}"><b>${BUCHST[k]}) ${esc(a)}</b>${esc(q.erklaerungen[k])}</li>`).join('')}</ol>
</div>
</section>
<section class="abschnitt" aria-labelledby="h-worum"><h2 id="h-worum">Worum es geht</h2><p>${esc(t.kurztext_de)}</p></section>
${t.ausdruck ? `<section class="abschnitt" aria-labelledby="h-ausdruck"><h2 id="h-ausdruck">Der Ausdruck aus dem Tipp</h2><div class="code-block"><pre id="ausdruck"><code>${esc(t.ausdruck)}</code></pre><button type="button" class="knopf knopf--klein" data-kopieren="ausdruck" data-nur-js>Kopieren</button></div></section>` : ''}
<section class="abschnitt" aria-labelledby="h-wann"><h2 id="h-wann">Wann einsetzen, wann nicht</h2><div class="zwei"><div class="karte-text"><h3>Einsetzen</h3><p>${esc(t.wann_ja)}</p></div><div class="karte-text"><h3>Lieber nicht</h3><p>${esc(t.wann_nein)}</p></div></div></section>
<section class="abschnitt" aria-labelledby="h-fehler"><h2 id="h-fehler">Häufigster Fehler</h2><p>${esc(t.fehler)}</p></section>
<section class="abschnitt" aria-labelledby="h-lizenz"><h2 id="h-lizenz">Lizenz</h2><p>${lizenzBadge(t, r)} ${esc(LIZENZ_SATZ[t.lizenz])} Beleg bei Microsoft Learn: ${belege}. Für deinen ganzen Flow: <a href="${r}premium/">Lizenz-Check</a>.</p></section>
<section class="abschnitt" aria-label="Ganzer Tipp"><a class="tipp-knopf" href="${esc(mitUtm(t.tipp_url, `technik-${t.tipp_nr}`))}" rel="noopener"><strong>Ganzer Tipp mit Screenshots auf powerplatformtip.com</strong><span>${esc(tippLabel(t))}, auf Englisch</span></a></section>
<section class="abschnitt" aria-label="Dein Stand">
<button type="button" class="knopf" data-geuebt="${esc(t.schluessel)}" aria-pressed="false" data-nur-js>Als geübt markieren</button>
<p class="status-zeile" data-geuebt-status role="status" aria-live="polite"></p>
${kurs}
</section>
<section class="abschnitt" aria-labelledby="h-teilen"><h2 id="h-teilen">Teilen</h2>
<div class="knopf-reihe"><a class="knopf knopf--klein" href="${esc(linkedinUrl(teilenText(t)))}" rel="noopener">Als Quizfrage auf LinkedIn teilen</a><button type="button" class="knopf knopf--klein" data-kopieren-text="${esc(teilenText(t)).replace(/\n/g, '&#10;')}" data-nur-js>Text kopieren</button><a class="knopf knopf--leise knopf--klein" href="${esc(mailtoFehler(t))}">Fehler in dieser Frage melden</a></div>
<p class="klein">Kurzadresse: ${esc(KURZ_BASIS)}/${t.tipp_nr}</p>
</section>
<p class="quelle">Quelle: <a href="${esc(mitUtm(t.tipp_url, `quelle-${t.tipp_nr}`))}" rel="noopener">${esc(tippLabel(t))}</a>, Microsoft Learn: <a href="${esc(t.learn_url)}" rel="noopener">${esc(t.learn_titel)}</a>.</p>
<nav class="blaettern" aria-label="Weitere Techniken">${vor ? `<a href="${r}techniken/${vor.slug}/" rel="prev"><span>Vorherige Technik</span>${esc(vor.titel_de)}</a>` : `<a href="${r}techniken/"><span>Zurück</span>Zur Technik-Wand</a>`}${nach ? `<a href="${r}techniken/${nach.slug}/" rel="next"><span>Nächste Technik</span>${esc(nach.titel_de)}</a>` : `<a href="${r}pruefung/" rel="next"><span>Geschafft</span>Zur Gürtelprüfung</a>`}</nav>
</article>
</div></main>`;
  seite(`techniken/${t.slug}/index.html`, {
    seite: 'technik', titel: `${t.titel_de} | ${NAME}`, haupt, canonical: url, noindex: !indexierbar, ogTyp: 'article',
    ogBild: `${BASE_URL}assets/img/guertel-${g.farbe}.png`,
    beschreibung: `${t.titel_de}: Quizfrage mit Auflösung, kurze Erklärung auf Deutsch und der Link zum ganzen Tipp auf powerplatformtip.com.`.slice(0, 160),
    jsonld: [LD_WEBSITE, LD_ORG, { '@type': 'LearningResource', '@id': `${url}#technik`, name: t.titel_de, url, inLanguage: 'de-CH', learningResourceType: 'Quiz', educationalLevel: g.name, isBasedOn: t.tipp_url, citation: [t.learn_url, ...(t.lizenz_belege || []).map(b => b.url)], publisher: { '@id': LD_ORG['@id'] }, isPartOf: { '@id': `${BASE_URL}#website` } }, krumen([['Start', BASE_URL], ['Techniken', `${BASE_URL}techniken/`], [t.titel_de, url]])]
  });
  return indexierbar;
}

function baueHeute() {
  const t = heuteTechnik(false);
  const haupt = `<main id="main"><div class="wrap sektion--eng">
<span class="label">Technik des Tages</span>
<h1 id="h1">Die Frage von heute</h1>
<p class="lead">Jeden Tag eine Frage aus dem Dojo, für alle am selben Tag dieselbe. Antwort antippen, die Auflösung steht auf der Technik-Seite.</p>
<div data-heute data-heute-alle>${t ? quizKarte(t, '../', 'h2') : '<p class="leer-hinweis">Die erste Technik des Tages folgt.</p>'}</div>
<p class="knopf-reihe"><a class="knopf" href="../kalender/montag.ics" download>Jeden Montag eine Frage im Kalender</a><a class="knopf knopf--leise" href="../techniken/">Alle Techniken</a></p>
</div></main>`;
  seite('heute/index.html', { seite: 'heute', titel: `Technik des Tages | ${NAME}`, haupt, noindex: true, beschreibung: 'Jeden Tag eine Quizfrage zu Flows in Power Automate, mit Auflösung und Erklärung.' });
}

function bauePruefung() {
  const haupt = `<main id="main"><div class="wrap sektion--eng pruef">
${krumenHtml('../', [['Gürtelprüfung', './']])}
<span class="label">Selbsttest</span>
<h1 id="h1">Gürtelprüfung</h1>
<p class="lead">${PRUEF_ANZAHL()} Fragen von Weiss bis Braun, zwei je Gürtel, beim braunen Gürtel eine. Zwei falsche Antworten in einem Gürtel beenden die Prüfung.</p>
<div data-pruefung data-anzahl="${PRUEF_ANZAHL()}">
<p class="knopf-reihe"><button type="button" class="knopf knopf--primaer" data-pruefung-start data-nur-js>Prüfung starten</button></p>
<p class="klein" data-nur-js>Die Fragen kommen zufällig aus ${POOL.length} Fragen zu den Tipps. Dein Ergebnis bleibt in deinem Browser.</p>
<p class="leer-hinweis" data-ohne-js>Die Gürtelprüfung braucht JavaScript. Alle Fragen mit Auflösung findest du auch auf den <a href="../techniken/">Technik-Seiten</a>.</p>
</div>
<section class="abschnitt" aria-labelledby="h-regeln"><h2 id="h-regeln">So wird gewertet</h2>
<ul class="arrow-list"><li>Ein Gürtel gilt als bestanden, wenn alle seine Fragen richtig sind.</li><li>Dein Ergebnis ist der höchste Gürtel, bis zu dem alle Gürtel bestanden sind.</li><li>Zwei falsche Antworten im selben Gürtel beenden die Prüfung. Den schwarzen Gürtel prüft die Meisterprüfung, sie folgt.</li></ul>
</section>
</div></main>`;
  seite('pruefung/index.html', {
    seite: 'pruefung', titel: `Gürtelprüfung für Flows | ${NAME}`, haupt, canonical: `${BASE_URL}pruefung/`, js: ['pruefung.js'],
    beschreibung: `Welcher Flow-Gürtel bist du? ${PRUEF_ANZAHL()} Fragen zu Flows in Power Automate, von Weiss bis Braun, mit Ergebnisbild zum Teilen.`,
    ogTitel: 'Welcher Flow-Gürtel bist du?', jsonld: [LD_WEBSITE, LD_ORG, krumen([['Start', BASE_URL], ['Gürtelprüfung', `${BASE_URL}pruefung/`]])]
  });
}

function bauePremium() {
  const standard = SEITEN.filter(t => t.lizenz === 'standard');
  const fragen = LQ.map((q, qi) => `<fieldset class="lfrage" id="${q.id}">
<legend>${qi + 1}. ${esc(q.frage)}</legend>
${q.hinweis ? `<p class="klein">${esc(q.hinweis)}</p>` : ''}
${q.optionen.map(o => `<label class="wahl"><input type="radio" name="${q.id}" value="${o.v}" data-wirkung="${o.wirkung}" data-punkt="${esc(o.punkt || '')}"><span>${esc(o.text)}</span></label>`).join('\n')}
</fieldset>`).join('\n');
  const haupt = `<main id="main"><div class="wrap sektion--eng pruef">
${krumenHtml('../', [['Lizenz-Check', './']])}
<span class="label">Lizenz-Check, Stand ${datumCH(LIMITS.stand)}</span>
<h1 id="h1">Reicht meine Lizenz?</h1>
<p class="lead">Vier Fragen zu deinem Flow. Das Urteil sagt dir, ob die Lizenz aus Microsoft 365 reicht oder wofür du Power Automate Premium brauchst.</p>
<div class="urteil pruefen" data-urteil role="status" aria-live="polite">Beantworte die vier Fragen, das Urteil erscheint hier.</div>
<ul class="arrow-list" data-urteil-liste></ul>
<form data-lizenz-check>
${fragen}
</form>
<section class="abschnitt" aria-labelledby="h-grundlage"><h2 id="h-grundlage">Worauf das Urteil beruht</h2>
<ul class="arrow-list">
<li>Mit einer Lizenz aus Microsoft 365 nutzt du Standard-Connectoren. Verwendet ein Flow keinen Premium-Connector, brauchst du keine Premium-Lizenz.</li>
<li>Microsoft Dataverse und HTTP with Microsoft Entra ID sind Premium-Connectoren. Custom Connectors und Desktop Flows aus Cloud Flows sind in der Lizenz aus Microsoft 365 nicht enthalten.</li>
<li>Startet ein automatisierter oder geplanter Flow mit Premium-Connector, braucht nur der Besitzer die Premium-Lizenz. Bei Flows, die Personen per Knopf starten, braucht sie jede Person, die startet.</li>
<li>Voraussetzung ist, dass dein Abo aus Microsoft 365 Power Automate enthält. Welche Pläne das sind, steht in der Licensing FAQ.</li>
</ul>
<p class="klein">Quellen, Stand ${datumCH(LIMITS.stand)}: ${LQUELLEN.map(q => `<a href="${q.url}" rel="noopener">${esc(q.titel)}</a>`).join(', ')}. Keine Lizenzberatung im Einzelfall: Für Verträge fragst du deinen Microsoft-Partner.</p>
</section>
<section class="abschnitt" aria-labelledby="h-standard"><h2 id="h-standard">Diese Techniken laufen mit Standard</h2>
<ul class="dojo-liste">${standard.map(t => `<li data-guertel-nr="${t.guertel}">${bandPunkt(t.guertel)}<a href="../techniken/${t.slug}/">${esc(t.titel_de)}</a></li>`).join('')}</ul>
</section>
</div></main>`;
  seite('premium/index.html', {
    seite: 'premium', titel: `Reicht meine Lizenz für Flows? Lizenz-Check | ${NAME}`, haupt, canonical: `${BASE_URL}premium/`, js: ['premium.js'],
    beschreibung: 'Vier Fragen zu deinem Flow: Reicht die Lizenz aus Microsoft 365 oder brauchst du Power Automate Premium? Mit Quellen bei Microsoft Learn.',
    jsonld: [LD_WEBSITE, LD_ORG, krumen([['Start', BASE_URL], ['Lizenz-Check', `${BASE_URL}premium/`]])]
  });
}

function baueGuertel(g) {
  const r = '../../';
  const drin = SEITEN.filter(t => t.guertel === g.nr);
  const fr = POOL.filter(t => t.guertel === g.nr).length;
  const naechster = GUERTEL[g.nr];
  const haupt = `<main id="main"><div class="wrap sektion--eng">
${krumenHtml(r, [['Gürtelweg', '../../techniken/'], [g.name, './']])}
<div class="ergebnis__abzeichen">${abzeichenSvg(g.nr)}<div><span class="label">Stufe ${g.nr} von 7</span><h1 id="h1">${esc(g.name)}: ${esc(g.leitwort)}</h1></div></div>
<p class="lead">${esc(g.erreicht_satz)}</p>
<section class="abschnitt" aria-labelledby="h-kann"><h2 id="h-kann">Das kannst du mit diesem Gürtel</h2><p>${esc(g.kannst_du)}</p>
${g.nr === 7 && !drin.length ? '<p class="leer-hinweis">Die Meisterprüfung folgt. Die Techniken dazu entstehen aus Tipps, die gerade überarbeitet werden: ein Switch-Router als Werkzeug für Agents und Connector-Aufrufe, die sich selbst korrigieren.</p>' : `<p class="klein">${drin.length} ${drin.length === 1 ? 'Technik' : 'Techniken'} mit eigener Seite, ${fr} ${fr === 1 ? 'Frage' : 'Fragen'} in der Gürtelprüfung.</p>`}
</section>
${drin.length ? `<ul class="karten">${drin.map(t => karte(t, r)).join('\n')}</ul>` : ''}
<p class="knopf-reihe"><a class="knopf knopf--primaer" href="${r}pruefung/">Gürtelprüfung starten</a>${naechster && g.nr < 6 ? `<a class="knopf" href="${r}guertel/${naechster.farbe}/">Weiter zu ${esc(naechster.name)}</a>` : ''}</p>
</div></main>`;
  seite(`guertel/${g.farbe}/index.html`, {
    seite: 'guertel', titel: `${g.name}: ${g.leitwort} | ${NAME}`, haupt, canonical: `${BASE_URL}guertel/${g.farbe}/`,
    ogBild: `${BASE_URL}assets/img/guertel-${g.farbe}.png`, ogTitel: `${g.name} im KMUpower Flow-Dojo`,
    beschreibung: `${g.name}: ${g.kannst_du}`.slice(0, 160),
    jsonld: [LD_WEBSITE, LD_ORG, krumen([['Start', BASE_URL], [g.name, `${BASE_URL}guertel/${g.farbe}/`]])]
  });
}

function baueDojo() {
  const liste = GUERTEL.slice(0, 6).map(g => {
    const drin = SEITEN.filter(t => t.guertel === g.nr);
    if (!drin.length) return '';
    return `<section class="abschnitt" aria-labelledby="dl-${g.farbe}" data-guertel-nr="${g.nr}"><h2 id="dl-${g.farbe}">${bandPunkt(g.nr)} ${esc(g.name)}</h2>
<ul class="dojo-liste">${drin.map(t => `<li data-technik="${esc(t.schluessel)}"><a href="../techniken/${t.slug}/">${esc(t.titel_de)}</a><span class="status" data-status-text>offen</span></li>`).join('')}</ul></section>`;
  }).join('\n');
  const haupt = `<main id="main"><div class="wrap sektion--eng pruef">
<span class="label">Dein Fortschritt</span>
<h1 id="h1">Mein Dojo</h1>
<p class="lead" data-dojo-stand>Hier siehst du, welche Techniken du geübt hast und welchen Gürtel du in der Prüfung erreicht hast. Alles bleibt in deinem Browser.</p>
<p class="knopf-reihe"><a class="knopf knopf--primaer" href="../pruefung/">Gürtelprüfung</a><a class="knopf" href="../heute/">Technik des Tages</a></p>
${liste}
<section class="abschnitt" aria-labelledby="h-loeschen"><h2 id="h-loeschen">Daten löschen</h2><p>Dein Fortschritt liegt nur im lokalen Speicher dieses Browsers. Mit einem Klick ist er weg.</p><p><button type="button" class="knopf knopf--leise" data-dojo-loeschen data-nur-js>Alles löschen</button></p><p class="status-zeile" data-dojo-meldung role="status" aria-live="polite"></p></section>
</div></main>`;
  seite('dojo/index.html', { seite: 'dojo', titel: `Mein Dojo | ${NAME}`, haupt, noindex: true, beschreibung: 'Dein Fortschritt im KMUpower Flow-Dojo: geübte Techniken und dein Gürtel aus der Prüfung.' });
}

function baueRecht() {
  const r = '../';
  const ueber = `<main id="main"><div class="wrap">
${krumenHtml(r, [['Über', './']])}
<div class="prose sektion--eng">
<h1 id="h1">Über das Flow-Dojo</h1>
<p class="lead">Das Flow-Dojo prüft und erklärt auf Deutsch, was die Tipps auf powerplatformtip.com zeigen. Eine Frage nach der anderen, vom ersten Test bis zur Architektur.</p>
<h2>Wie es funktioniert</h2>
<ul class="arrow-list">
<li>Jede Technik beginnt mit einer Quizfrage. Erst raten, dann lesen: So bleibt mehr hängen als beim reinen Lesen.</li>
<li>Die Auflösung erklärt jede Antwort, auch die falschen. Danach folgen eine kurze Erklärung, der Ausdruck aus dem Tipp, wann du die Technik einsetzt und der häufigste Fehler.</li>
<li>Die Schritt-für-Schritt-Anleitung mit Screenshots steht im Tipp auf powerplatformtip.com, auf Englisch. Jede Technik verlinkt dorthin.</li>
<li>Die Gürtelprüfung ordnet dich ein. Der Lizenz-Check sagt dir, ob die Lizenz aus Microsoft 365 reicht.</li>
</ul>
<h2>Woher die Inhalte kommen</h2>
<p>Alle Fragen stammen aus den wöchentlichen Tipps von Marcel Lehmann auf powerplatformtip.com. Ins Dojo kommen nur Tipps, die nach der letzten Durchsicht aktuell sind. Lizenzangaben und Zahlen zu Limits stützen sich auf Microsoft Learn, mit Link auf jeder Seite. Ist eine Erklärung hier falsch, wird zuerst der Tipp korrigiert und danach das Dojo.</p>
<h2>Was das Dojo nicht ist</h2>
<p>Kein Angebot von Microsoft, keine Zertifizierung und keine Lizenzberatung im Einzelfall. Die Gürtel sind eine Lernhilfe dieser Seite.</p>
<h2>Fehler gefunden?</h2>
<p>Auf jeder Technik-Seite gibt es den Link «Fehler in dieser Frage melden». Oder schreib direkt an <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>.</p>
<p>Wer Flows mit Begleitung lernen will: <a href="${esc(kursUrl('ueber'))}" rel="noopener">${esc(CFG.kurs_name)} der Power Platform Academy</a>.</p>
</div></div></main>`;
  seite('ueber/index.html', { seite: 'ueber', titel: `Über das Flow-Dojo | ${NAME}`, haupt: ueber, canonical: `${BASE_URL}ueber/`, beschreibung: 'Wie das KMUpower Flow-Dojo funktioniert, woher die Fragen kommen und was die Seite nicht ist.' });

  const impressum = `<main id="main"><div class="wrap">
${krumenHtml(r, [['Impressum', './']])}
<div class="prose sektion--eng">
<h1 id="h1">Impressum</h1>
<h2>Anbieter</h2>
<address>Marcel Lehmann<br>Einzelfirma (Handelsname KMUpower)<br>Weidstrasse 1<br>8320 Fehraltorf<br>Schweiz</address>
<p>UID: CHE-296.591.945, im UID-Register erfasst seit 01.01.2023 (<a href="https://www.uid.admin.ch/Detail.aspx?uid_id=CHE-296.591.945" rel="noopener">Eintrag im UID-Register</a>).</p>
<p>E-Mail: <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a><br>Web: <a href="https://kmupower.com/" rel="noopener">kmupower.com</a></p>
<h2>Verantwortlich für den Inhalt</h2>
<p>Marcel Lehmann.</p>
<h2>Unabhängigkeit und Marken</h2>
<p>Microsoft und die Produktnamen der Power Platform (z. B. Power Apps, Power Automate, Copilot Studio) sind Marken der Microsoft-Unternehmensgruppe. Dies ist eine unabhängige Website von Marcel Lehmann. Sie wird nicht von Microsoft betrieben, gesponsert oder unterstützt.</p>
<h2>Haftung</h2>
<p>Ich prüfe die Inhalte sorgfältig und gegen die Microsoft-Dokumentation. Für Richtigkeit, Vollständigkeit und Aktualität übernehme ich keine Gewähr. Microsoft ändert Funktionen und Bedingungen. Verbindlich sind die verlinkten Quellen. Die Seite ersetzt keine Lizenz- oder Rechtsberatung.</p>
<h2>Links</h2>
<p>Diese Seite verlinkt auf Websites Dritter. Für deren Inhalte sind die jeweiligen Anbieter verantwortlich.</p>
<h2>Urheberrecht</h2>
<p>Die Ausdrücke aus den Tipps darfst du in deiner Organisation frei verwenden. Die übrigen Texte, Fragen und die Gestaltung dieser Seite darfst du nicht ohne Rücksprache als eigene veröffentlichen.</p>
</div></div></main>`;
  seite('impressum/index.html', { seite: 'recht', titel: `Impressum | ${NAME}`, haupt: impressum, noindex: true, beschreibung: 'Impressum des KMUpower Flow-Dojo.' });

  const p = CFG.speicher_praefix;
  const datenschutz = `<main id="main"><div class="wrap">
${krumenHtml(r, [['Datenschutz', './']])}
<div class="prose sektion--eng">
<h1 id="h1">Datenschutz</h1>
<p>Stand: ${datumCH(CFG.recht_stand)}</p>
<h2>Kurz erklärt</h2>
<ul class="arrow-list">
<li>Diese Seite setzt keine Cookies.</li>
<li>Es läuft kein Tracking und keine Analyse auf der Seite.</li>
<li>Es gibt keine Konten und keine Formulare, die etwas senden.</li>
<li>Die Seite lädt keine Schriften, Skripte oder Bilder von Dritten.</li>
<li>Was du im Dojo markierst oder in der Prüfung erreichst, bleibt in deinem Browser. Ich erhalte davon nichts.</li>
</ul>
<h2>Verantwortlich</h2>
<p>Marcel Lehmann (Handelsname KMUpower), erreichbar unter <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>. Die vollständigen Angaben stehen im <a href="../impressum/">Impressum</a>.</p>
<h2>Hosting bei GitHub Pages</h2>
<p>Die Seite liegt auf GitHub Pages. Betreiber ist GitHub Inc. in den USA. Beim Aufruf verarbeitet GitHub technisch notwendige Zugriffsdaten in Server-Logs, zum Beispiel deine IP-Adresse und den Zeitpunkt des Aufrufs. Ich werte diese Logs nicht aus. Dabei können Daten in die USA übermittelt werden. Einzelheiten stehen in der <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">Datenschutzerklärung von GitHub</a>.</p>
<h2 id="dein-fortschritt">Dein Fortschritt im Dojo</h2>
<p>Einige Einstellungen und dein Fortschritt werden im lokalen Speicher deines Browsers abgelegt (localStorage). Das ist kein Cookie. Die Einträge bleiben auf deinem Gerät und werden nie an mich oder an Dritte übertragen. Geschrieben wird erst, wenn du etwas tust.</p>
<ul class="arrow-list">
<li><code>${p}-theme</code>: «light» oder «dark». Merkt sich den Hell- oder Dunkelmodus.</li>
<li><code>${p}-dojo-v1</code>: deine geübten Techniken mit Datum und dein Gürtel aus der Prüfung mit Datum.</li>
</ul>
<p>Löschen: Unter <a href="../dojo/">Mein Dojo</a> entfernt «Alles löschen» beide Einträge. Du kannst sie auch in den Einstellungen deines Browsers löschen.</p>
<p>Das Ergebnisbild der Gürtelprüfung entsteht in deinem Browser. Es wird nirgends hochgeladen.</p>
<h2>Wenn du mir schreibst</h2>
<p>Der Link «Fehler in dieser Frage melden» bereitet nur eine Mail in deinem eigenen Mailprogramm vor. Gesendet wird erst, wenn du dort auf Senden klickst. Ich nutze deine Mailadresse und den Inhalt nur, um zu antworten und die Frage zu korrigieren, und lösche die Mail, wenn das erledigt ist.</p>
<h2>Links zu anderen Seiten</h2>
<p>Die Seite verlinkt auf powerplatformtip.com, Microsoft Learn, die Power Platform Academy, LinkedIn und weitere Seiten. Erst wenn du einen Link anklickst, erhält der jeweilige Anbieter deine Daten. Die Links zu powerplatformtip.com und zur Academy tragen eine Herkunftsangabe in der Adresse (utm_source=${CFG.utm_source}). Diese Seite selbst wertet den Parameter nicht aus, die Zielseite tut es nach ihrer eigenen Datenschutzerklärung.</p>
<h2>Deine Rechte</h2>
<p>Nach dem Schweizer Datenschutzgesetz kannst du Auskunft oder Löschung verlangen. Die Seite selbst speichert keine Personendaten bei mir. Für die Logs beim Hosting wendest du dich an GitHub. Für alles andere schreib mir an <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>.</p>
</div></div></main>`;
  seite('datenschutz/index.html', { seite: 'recht', titel: `Datenschutz | ${NAME}`, haupt: datenschutz, noindex: true, beschreibung: 'Datenschutz im KMUpower Flow-Dojo: keine Cookies, kein Tracking, Fortschritt nur im Browser.' });

  seite('404.html', {
    seite: '404', absolut: true, titel: `Seite nicht gefunden | ${NAME}`, noindex: true, beschreibung: 'Diese Seite gibt es nicht.',
    haupt: `<main id="main"><div class="wrap sektion">
<span class="label">Fehler 404</span>
<h1 id="h1">Diese Seite gibt es nicht.</h1>
<p class="lead">Der Link ist falsch oder die Seite ist umgezogen. Eine Kurzadresse wie ${esc(KURZ_BASIS)}/158 führt direkt zur Technik zu diesem Tipp.</p>
<div class="knopf-reihe"><a class="knopf knopf--primaer" href="${BASIS_PFAD}techniken/">Zu den Techniken</a><a class="knopf" href="${BASIS_PFAD}pruefung/">Gürtelprüfung</a><a class="knopf knopf--leise" href="${BASIS_PFAD}">Zur Startseite</a></div>
</div></main>`
  });
}

function baueKurzadressen() {
  for (const t of SEITEN) {
    const ziel = `../techniken/${t.slug}/`;
    schreibe(`${t.tipp_nr}/index.html`, `<!doctype html>
<html lang="de-CH" data-seite="kurzadresse">
<head>
<meta charset="utf-8">
${GENERATOR}
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<title>${esc(t.titel_de)} | ${esc(NAME)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${urlTechnik(t)}">
<meta http-equiv="refresh" content="0; url=${ziel}">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
</head>
<body>
<p><a href="${ziel}">Zur Technik: ${esc(t.titel_de)}</a></p>
<p>Unabhängige Website, keine Verbindung zu Microsoft.</p>
</body>
</html>
`);
  }
}

/* Daten fuer Skripte, Sitemap, robots, llms.txt, Kalender, Bilder */
function baueDaten(indexierbar) {
  schreibe('assets/data/suche.json', JSON.stringify({ eintraege: SEITEN.map(t => ({ k: t.schluessel, nr: t.tipp_nr, titel: t.titel_de, g: t.guertel, slug: t.slug, s: [t.thema, ...(t.suchbegriffe || [])].join(' ') })) }));
  const folge = (daten.tag_reihenfolge || []).map(k => NACH_KEY[k]).filter(t => t && t.seite);
  schreibe('assets/data/tag.json', JSON.stringify({ start: daten.tag_start, eintraege: folge.map(t => ({ k: t.schluessel, slug: t.slug, titel: t.titel_de, g: t.guertel, lizenz: t.lizenz, start: FUER_START(t), frage: t.quiz.frage, antworten: t.quiz.antworten })) }));
  const pool = POOL.map(t => ({ k: t.schluessel, g: t.guertel, frage: t.quiz.frage, antworten: t.quiz.antworten, richtig: t.quiz.richtig_index, erkl: (t.quiz.erklaerungen || [])[t.quiz.richtig_index] || '', url: t.seite ? `techniken/${t.slug}/` : mitUtm(t.tipp_url, `pruefung-${t.tipp_nr || 'artikel'}`), titel: t.seite ? t.titel_de : tippLabel(t), seite: !!t.seite }));
  const guertel = GUERTEL.map(g => ({ nr: g.nr, farbe: g.farbe, name: g.name, akk: g.akk, kurz: g.kurz, leitwort: g.leitwort, kann: g.kannst_du, hex: g.hex, naechste: SEITEN.filter(t => t.guertel === g.nr).slice(0, 3).map(t => ({ titel: t.titel_de, url: `techniken/${t.slug}/` })) }));
  schreibe('assets/data/pool.json', JSON.stringify({ base: BASE_URL, kurz: KURZ_BASIS, kurs: { einstieg: kursUrl('pruefung-einstieg'), fortgeschritten: kursUrl('pruefung-fortgeschritten'), name: CFG.kurs_name }, guertel, fragen: pool }));

  const url = (p) => `  <url><loc>${BASE_URL}${p}</loc><lastmod>${daten.stand}</lastmod></url>`;
  const eintraege = ['', 'pruefung/', 'premium/', 'techniken/', ...GUERTEL.map(g => `guertel/${g.farbe}/`), 'ueber/', ...indexierbar.map(t => `techniken/${t.slug}/`)];
  schreibe('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege.map(url).join('\n')}\n</urlset>\n`);
  schreibe('robots.txt', `User-agent: *\nAllow: /\nDisallow: ${BASIS_PFAD}templates/\nDisallow: ${BASIS_PFAD}scripts/\nDisallow: ${BASIS_PFAD}data/\n\nSitemap: ${BASE_URL}sitemap.xml\n`);
  schreibe('llms.txt', [`# ${NAME}`, '', `> Fragen, Erklärungen und Gürtelweg für Flows in Power Automate, auf Deutsch. Jede Technik beruht auf einem Tipp von powerplatformtip.com und verlinkt ihn. Lizenzangaben mit Quelle bei Microsoft Learn. Unabhängige Website von Marcel Lehmann (KMUpower), keine Verbindung zu Microsoft.`, '',
    '## Seiten', '', `- [Gürtelprüfung](${BASE_URL}pruefung/): Selbsttest von Weiss bis Braun`, `- [Lizenz-Check](${BASE_URL}premium/): Reicht die Lizenz aus Microsoft 365?`, `- [Alle Techniken](${BASE_URL}techniken/): nach Gürtel geordnet`, `- [Über](${BASE_URL}ueber/): Methode und Herkunft der Fragen`, '',
    '## Techniken', '', ...SEITEN.map(t => `- [${t.titel_de}](${urlTechnik(t)}): ${GUERTEL[t.guertel - 1].name}, ${t.lizenz === 'premium' ? 'Premium' : 'Standard'}. Grundlage: ${t.tipp_url}`), ''].join('\n'));
  const montag = (() => { const d = new Date(DATUM + 'T00:00:00Z'); do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() !== 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KMUpower//Flow-Dojo//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', 'UID:flow-dojo-montag@kmupower.com',
    `DTSTAMP:${DATUM.replace(/-/g, '')}T000000Z`, `DTSTART:${montag}T083000`, 'DURATION:PT10M', 'RRULE:FREQ=WEEKLY;BYDAY=MO', 'SUMMARY:Flow-Dojo: eine Frage',
    `DESCRIPTION:Zehn Minuten, eine Frage zu Flows. Die Technik des Tages steht unter ${BASE_URL}heute/`, `URL:${BASE_URL}heute/`, 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'];
  schreibe('kalender/montag.ics', ics.map(falte).join('\r\n') + '\r\n');
}
function falte(zeile) {
  if (Buffer.byteLength(zeile, 'utf8') <= 75) return zeile;
  const teile = []; let rest = zeile;
  while (Buffer.byteLength(rest, 'utf8') > 74) { let n = 74; while (Buffer.byteLength(rest.slice(0, n), 'utf8') > 74) n--; teile.push(rest.slice(0, n)); rest = rest.slice(n); }
  teile.push(rest);
  return teile.join('\r\n ');
}
function baueBilder() {
  schreibe('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#F4EFE6"/><g transform="translate(0 -1)"><path d="M2 11h28v7H2z" fill="#B4301A" stroke="#15171B" stroke-width="1.4"/><path d="M12.5 17.5L8 29h5.2l3-6.4M19.5 17.5L24 29h-5.2l-3-6.4" fill="#B4301A" stroke="#15171B" stroke-width="1.4"/><rect x="11.5" y="8.5" width="9" height="12" rx="2.2" fill="#15171B"/></g></svg>\n`);
  const schrift = "Bahnschrift, 'Arial Narrow', sans-serif";
  const karteSvg = (titel1, titel2, unter, hex, rand) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#F4EFE6"/>
${BAND_HEX.map((c, i) => `<rect x="${i * (1200 / 7)}" y="604" width="${1200 / 7 + 1}" height="26" fill="${c}"/>`).join('')}
<rect x="0" y="603" width="1200" height="1.5" fill="#8A7F6C"/>
<text x="80" y="120" font-family="${schrift}" font-weight="600" font-size="34" letter-spacing="6" fill="#4E525B">KMUPOWER FLOW-DOJO</text>
<text x="76" y="270" font-family="${schrift}" font-weight="700" font-size="104" letter-spacing="-2" fill="#15171B">${titel1}</text>
<text x="76" y="380" font-family="${schrift}" font-weight="700" font-size="104" letter-spacing="-2" fill="#15171B">${titel2}</text>
<path d="M80 404C190 394 300 392 420 398" fill="none" stroke="#B4301A" stroke-width="12" stroke-linecap="round"/>
<text x="80" y="490" font-family="'Segoe UI', system-ui, sans-serif" font-size="34" fill="#4E525B">${unter}</text>
<g transform="translate(860 150) scale(9)"><path d="M2 11h28v7H2z" fill="${hex}" stroke="#15171B" stroke-width=".5"/><path d="M12.5 17.5L8 29h5.2l3-6.4M19.5 17.5L24 29h-5.2l-3-6.4" fill="${hex}" stroke="#15171B" stroke-width=".5"/><rect x="11.5" y="8.5" width="9" height="12" rx="2.2" fill="#15171B"/></g>
${rand ? '' : ''}</svg>
`;
  schreibe('og-image.svg', karteSvg('Welcher', 'Flow-Gürtel?', 'Fragen und Erklärungen zu Flows, auf Deutsch.', '#B4301A'));
  for (const g of GUERTEL) schreibe(`assets/img/guertel-${g.farbe}.svg`, karteSvg(g.name.split(' ')[0], 'Gürtel', esc(g.erreicht_satz).slice(0, 70), g.hex));
}
function minifiziere(css) {
  const strings = [];
  let s = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => { strings.push(m); return `\u0000${strings.length - 1}\u0000`; });
  s = s.replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/:\s+/g, ':').replace(/;}/g, '}').trim();
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[Number(i)]);
}
function baueCss() {
  const css = lies('templates/css/site.css');
  if (/@import|url\((?!["']?(data:|\.\.\/fonts\/[\w-]+\.woff2["']?\)))/.test(css)) fehler('site.css: @import oder fremde url() nicht erlaubt');
  schreibe('assets/css/site.css', `/* KMUpower Flow-Dojo. Quelle: templates/css/site.css (nicht hier bearbeiten) */\n${minifiziere(css)}\n`);
}

/* Abschlusspruefung */
function allesHtml(d = '') {
  const aus = [];
  for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = d ? `${d}/${f.name}` : f.name;
    if (f.isDirectory()) { if (!/^(\.git|_recherche|templates|node_modules|scripts|data)$/.test(f.name)) aus.push(...allesHtml(rel)); }
    else if (f.name.endsWith('.html')) aus.push(rel);
  }
  return aus;
}
function abschluss() {
  for (const rel of allesHtml()) {
    const html = lies(rel);
    const wo = `Prüfung ${rel}`;
    const kurz = /data-seite="kurzadresse"/.test(html);
    if (!html.includes(GENERATOR)) { warnung(`${wo}: nicht vom Build erzeugt`); continue; }
    if (rel !== '404.html' && /\s(href|src)="\/(?!\/)/.test(html)) fehler(`${wo}: absoluter Pfad`);
    for (const m of html.matchAll(/<(script|link)\b[^>]*>/g)) {
      const u = (m[0].match(/\s(?:src|href)="([^"]+)"/) || [])[1];
      if (!u || /rel="(canonical|alternate)"/.test(m[0])) continue;
      if (/^(https?:)?\/\//.test(u)) fehler(`${wo}: fremde Quelle ${u}`);
    }
    if (/<[a-z][^>]*\sstyle=/i.test(html)) fehler(`${wo}: style-Attribut`);
    if (/<[a-z][^>]*\son[a-z]+=/i.test(html)) fehler(`${wo}: on…-Attribut`);
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) if (!/\ssrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1]) && m[2].trim()) fehler(`${wo}: Inline-Skript`);
    if (!/Content-Security-Policy/.test(html)) fehler(`${wo}: CSP fehlt`);
    if (TESTPHASE && !/name="robots" content="noindex"/.test(html)) fehler(`${wo}: Testphase ohne noindex`);
    if (/class="vorschau-banner"/.test(html)) fehler(`${wo}: Vorschau-Banner`);
    const titel = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    if (!titel) fehler(`${wo}: <title> fehlt`);
    if (/Power Automate/i.test(titel)) fehler(`${wo}: «Power Automate» im <title>`);
    if (!kurz) {
      const n = (html.match(/<h1[\s>]/g) || []).length; if (n !== 1) fehler(`${wo}: ${n} statt genau ein <h1>`);
      const sichtbar = html.replace(/<script[\s\S]*?<\/script>/g, '');
      const ids = new Set();
      for (const m of sichtbar.matchAll(/\sid="([^"]+)"/g)) { if (ids.has(m[1])) fehler(`${wo}: id «${m[1]}» doppelt`); ids.add(m[1]); }
    }
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    if (/[\u2013\u2014]/.test(text)) fehler(`${wo}: Gedankenstrich im Text`);
    if (/ - /.test(text.replace(/\s+/g, ' '))) fehler(`${wo}: « - » im Text`);
    if (/\u00df/.test(text)) fehler(`${wo}: Eszett im Text`);
    if (/\p{Extended_Pictographic}/u.test(text)) fehler(`${wo}: Emoji im Text`);
    if (/Entwurf|Prüfstempel|Geprüft am/i.test(text)) fehler(`${wo}: Entwurf- oder Prüfhinweis`);
  }
  const groesse = (f) => gibtEs(f) ? fs.statSync(path.join(ROOT, f)).size / 1024 : 0;
  for (const [f, kb] of Object.entries({ 'assets/css/site.css': 30, 'assets/js/site.js': 16, 'assets/js/pruefung.js': 14, 'assets/js/premium.js': 5, 'index.html': 40 })) if (groesse(f) > kb) warnung(`Budget: ${f} ${groesse(f).toFixed(1)} KB, geplant ${kb} KB`);
}

/* Ablauf */
if (!fehlerListe.length && MODUS !== 'pruefen') {
  baueCss();
  baueBilder();
  baueStart();
  baueWand();
  const indexierbar = SEITEN.filter((t, i) => baueTechnik(t, i));
  baueHeute();
  bauePruefung();
  bauePremium();
  GUERTEL.forEach(baueGuertel);
  baueDojo();
  baueRecht();
  baueKurzadressen();
  baueDaten(indexierbar);
  abschluss();
}
console.log(`\nKMUpower Flow-Dojo Build, Modus ${MODUS}, Datum ${DATUM}`);
console.log(`Tipps: ${ALLE.length}, Pool ${POOL.length}, Technik-Seiten ${SEITEN.length}, Prüfung ${PRUEF_ANZAHL()} Fragen`);
const unter = SEITEN.filter(t => t._woerter < MIN_WOERTER_INDEX);
console.log(`Eigener Inhalt je Technik: ${Math.min(...SEITEN.map(t => t._woerter || 0))} bis ${Math.max(...SEITEN.map(t => t._woerter || 0))} Wörter, unter ${MIN_WOERTER_INDEX}: ${unter.length ? unter.map(t => t.tipp_nr).join(', ') : 'keine'}`);
if (geschrieben.length) console.log(`Geschrieben: ${geschrieben.length} Dateien, davon ${geschrieben.filter(f => f.endsWith('.html')).length} HTML-Seiten`);
if (warnListe.length) { console.log(`\nWarnungen (${warnListe.length}):`); warnListe.forEach(w => console.log('  - ' + w)); }
if (fehlerListe.length) { console.log(`\nFehler (${fehlerListe.length}):`); fehlerListe.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('\nOK');
