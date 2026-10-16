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
const MIN_WOERTER_INDEX = 240; // nur noch Kennzahl im Build-Protokoll. Freigabe aller Inhalte durch Marcel 16.10.2026: im Livegang ist jede Seite indexierbar (ausser 404).

const fehlerListe = [], warnListe = [], geschrieben = [];
const fehler = (m) => { if (!fehlerListe.includes(m)) fehlerListe.push(m); };
const warnung = (m) => { if (!warnListe.includes(m)) warnListe.push(m); };

/* Sprachen: Deutsch unter /, Englisch unter /en/. Alle Builder laufen je Sprache einmal, L ist die aktuelle Sprache.
   T('deutsch', 'english') waehlt den Text. Pfade in den Buildern sind relativ zur Sprachwurzel. */
const SPRACHEN = ['de', 'en'];
let L = 'de';
const T = (de, en) => (L === 'en' ? en : de);
const PFX = () => (L === 'en' ? 'en/' : '');
const BL = () => BASE_URL + PFX();
const LANG_HTML = () => T('de-CH', 'en');

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
  // Sprachfassung templates/partials/<name>.en.html, wenn vorhanden
  const key = `${name}.${L}`;
  if (!partialCache[key]) {
    const datei = L !== 'de' && gibtEs(`templates/partials/${name}.${L}.html`) ? `templates/partials/${name}.${L}.html` : `templates/partials/${name}.html`;
    if (!gibtEs(datei)) { fehler(`Partial fehlt: ${datei}`); return ''; }
    partialCache[key] = lies(datei).replace(/\s+$/, '');
  }
  return partialCache[key];
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
const EN = gibtEs('data/en.json') ? JSON.parse(lies('data/en.json')) : { guertel: [], techniken: {} };
const LIMITS = JSON.parse(lies('data/limits.json'));
const FARBEN = ['weiss', 'gelb', 'orange', 'gruen', 'blau', 'braun', 'schwarz'];
const GNAMEN = ['Weisser Gürtel', 'Gelber Gürtel', 'Oranger Gürtel', 'Grüner Gürtel', 'Blauer Gürtel', 'Brauner Gürtel', 'Schwarzer Gürtel'];
const GKURZ = ['Weiss', 'Gelb', 'Orange', 'Grün', 'Blau', 'Braun', 'Schwarz'];
const GAKK = ['den weissen Gürtel', 'den gelben Gürtel', 'den orangen Gürtel', 'den grünen Gürtel', 'den blauen Gürtel', 'den braunen Gürtel', 'den schwarzen Gürtel'];
const BAND_HEX = ['#FBFAF5', '#E2B100', '#E36A00', '#2E8B57', '#2F6FB5', '#7A4A2B', '#111111'];
const PRUEF_JE_GUERTEL = 2; // Gürtelprüfung: zwei Fragen je Gürtel von Weiss bis Braun (12 Fragen, Entscheid 16.10.2026)

/* Platzhalter {limit:schluessel} aus data/limits.json einsetzen (Englisch: text_en) */
function setzeLimits(text, wo) {
  return String(text).replace(/\{limit:([a-z_]+)\}/g, (_, k) => {
    const l = LIMITS.limits[k];
    if (!l) { fehler(`${wo}: unbekanntes Limit «${k}»`); return ''; }
    if (!String(l.learn_url || '').startsWith('https://learn.microsoft.com/')) fehler(`limits.json ${k}: learn_url fehlt`);
    if (L === 'en' && !l.text_en) fehler(`limits.json ${k}: text_en fehlt`);
    return L === 'en' ? l.text_en : l.text;
  });
}
function mitLimits(obj, wo) {
  if (typeof obj === 'string') return setzeLimits(obj, wo);
  if (Array.isArray(obj)) return obj.map(x => mitLimits(x, wo));
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, mitLimits(v, wo)]));
  return obj;
}

/* Sprachsicht: dieselben Felder (titel_de, kurztext_de ...) mit Texten der aktuellen Sprache.
   Englisch aus data/en.json, Schluessel = schluessel. Fortschritt (localStorage) gilt sprachuebergreifend ueber schluessel. */
let ALLE, SEITEN, POOL, NACH_KEY, GUERTEL;
function technikSicht(t) {
  if (L === 'de') return t;
  const e = (EN.techniken || {})[t.schluessel];
  if (!e) { if (t.pool || t.seite) fehler(`Tipp ${t.schluessel}: englische Fassung fehlt in data/en.json`); return null; }
  const q = e.quiz || {};
  if (t.pool && (!q.frage || !Array.isArray(q.antworten) || q.antworten.length !== 3)) fehler(`Tipp ${t.schluessel}: englisches Quiz unvollständig`);
  const v = { ...t, lernziel: e.lernziel || '', thema: e.thema || t.thema, suchbegriffe: e.suchbegriffe || [],
    quiz: { ...t.quiz, frage: q.frage || '', antworten: q.antworten || [], erklaerungen: q.erklaerungen || [] } };
  if (t.seite) Object.assign(v, { titel_de: e.titel, kurztext_de: e.kurztext, wann_ja: e.wann_ja, wann_nein: e.wann_nein, fehler: e.fehler });
  return v;
}
function setzeSprache(sprache) {
  L = sprache;
  ALLE = daten.techniken.map(technikSicht).filter(Boolean).map(t => mitLimits(t, `Tipp ${t.schluessel} (${L})`));
  SEITEN = ALLE.filter(t => t.seite).sort((a, b) => a.guertel - b.guertel || (a.tipp_nr || 0) - (b.tipp_nr || 0));
  POOL = ALLE.filter(t => t.pool);
  NACH_KEY = Object.fromEntries(ALLE.map(t => [t.schluessel, t]));
  GUERTEL = FARBEN.map((farbe, i) => {
    const basis = { nr: i + 1, farbe, name: GNAMEN[i], kurz: GKURZ[i], akk: GAKK[i], hex: BAND_HEX[i], leitwort: '', kannst_du: '', erreicht_satz: '', ...((daten.guertel || []).find(g => g.nr === i + 1) || {}) };
    if (L === 'de') return basis;
    const e = (EN.guertel || []).find(g => g.nr === i + 1);
    if (!e) { fehler(`Gürtel ${i + 1}: englische Fassung fehlt in data/en.json`); return basis; }
    return { ...basis, ...e, farbe, hex: BAND_HEX[i] };
  });
}
const urlTechnik = (t) => `${BL()}techniken/${t.slug}/`;
const tippLabel = (t) => t.tipp_nr ? `PowerPlatformTip #${t.tipp_nr}` : T('Artikel auf powerplatformtip.com', 'Article on powerplatformtip.com');
const BUCHST = ['A', 'B', 'C'];

/* Validierung */
const VERBOTEN = [[/[\u2013\u2014]/, 'Gedankenstrich'], [/\u00df/, 'Eszett'], [/\p{Extended_Pictographic}/u, 'Emoji'], [/ - /, '« - » als Gedankenstrich'], [/nicht getestet|laut Doku|not tested|according to the docs/i, 'Testhinweis'], [/Power Automate Ninja|powerautomate[\s-]ninja/i, 'Marke als Name']];
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
    const wo = `Tipp ${t.schluessel} (${L})`;
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
    const wo = `Tipp ${t.schluessel} (${L})`;
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
function lizenzBadge(t) {
  if (t.lizenz === 'premium') return '<span class="badge badge--premium">Premium</span>';
  return '<span class="badge badge--standard">Standard</span>';
}
const LIZENZ_SATZ = () => ({
  standard: T('Läuft ohne Premium-Connector, also mit der Lizenz aus Microsoft 365.', 'Runs without a premium connector, so the license from Microsoft 365 is enough.'),
  premium: T('Braucht Power Automate Premium oder eine andere Lizenz mit Premium-Connectoren.', 'Needs Power Automate Premium or another license that includes premium connectors.')
});
const mailtoFehler = (t) => `mailto:${CFG.kontakt}?subject=${encodeURIComponent(T(`Flow-Dojo: Fehler in Frage ${t.tipp_nr || t.schluessel}`, `Flow-Dojo: error in question ${t.tipp_nr || t.schluessel}`))}&body=${encodeURIComponent(T(`Frage: ${t.quiz.frage}\n\nWas stimmt nicht?\n\n`, `Question: ${t.quiz.frage}\n\nWhat is wrong?\n\n`))}`;
function linkedinUrl(text) { return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`; }
function teilenText(t) {
  return `${T('Quizfrage für alle, die Flows bauen', 'Quiz question for everyone who builds flows')}: ${t.quiz.frage}\n\n${t.quiz.antworten.map((a, i) => `${BUCHST[i]}) ${a}`).join('\n')}\n\n${T('Auflösung mit Erklärung im KMUpower Flow-Dojo', 'Answer with explanation in the KMUpower Flow-Dojo')}: ${urlTechnik(t)}`;
}
function karte(t, r) {
  const such = [t.titel_de, t.thema, ...(t.suchbegriffe || []), String(t.tipp_nr || '')].join(' ').toLowerCase();
  return `<li class="karte" data-technik="${esc(t.schluessel)}" data-guertel-nr="${t.guertel}" data-thema="${esc(t.thema)}" data-lizenz="${t.lizenz}" data-such="${esc(such)}">
<span class="klein">${T('Tipp', 'Tip')} ${t.tipp_nr}</span>
<h3><a href="${r}techniken/${t.slug}/">${esc(t.titel_de)}</a></h3>
<p>${esc(t.lernziel || '')}</p>
<div class="karte__meta">${lizenzBadge(t)}<span>${esc(t.thema)}</span><span class="karte__status" data-status hidden></span></div>
</li>`;
}
function abzeichenSvg(n, klasse = '') { return `<svg class="${klasse}" viewBox="0 0 32 32" data-guertel-nr="${n}" aria-hidden="true" focusable="false">${KNOTEN_PFADE}</svg>`; }

/* Lizenz-Check: vier Fragen, Quellen nur Microsoft Learn (Stand im Kopf von data/limits.json) */
const LQ = () => [
  { id: 'q1', frage: T('Mit welchen Datenquellen arbeitet dein Flow?', 'Which data sources does your flow work with?'), hinweis: T('SharePoint, Office 365 Outlook, Microsoft Teams und Excel Online (Business) sind Standard-Connectoren.', 'SharePoint, Office 365 Outlook, Microsoft Teams and Excel Online (Business) are standard connectors.'), optionen: [
    { v: 'm365', text: T('Nur SharePoint, Outlook, Teams oder Excel', 'Only SharePoint, Outlook, Teams or Excel'), wirkung: 'standard' },
    { v: 'andere', text: T('Auch andere Systeme oder Fachanwendungen', 'Other systems or business applications too'), wirkung: 'pruefen', punkt: T('Connectoren zu anderen Systemen: Ob sie Standard oder Premium sind, zeigt die Liste der Premium-Connectoren.', 'Connectors to other systems: the list of premium connectors shows whether they are standard or premium.') },
    { v: 'unklar', text: T('Weiss ich noch nicht', 'I do not know yet'), wirkung: 'pruefen', punkt: T('Datenquellen klären und in der Liste der Premium-Connectoren nachsehen.', 'Clarify the data sources and check them in the list of premium connectors.') }] },
  { id: 'q2', frage: T('Brauchst du einen Custom Connector oder «HTTP with Microsoft Entra ID»?', 'Do you need a custom connector or "HTTP with Microsoft Entra ID"?'), hinweis: '', optionen: [
    { v: 'nein', text: T('Nein', 'No'), wirkung: 'standard' },
    { v: 'ja', text: T('Ja', 'Yes'), wirkung: 'premium', punkt: T('Custom Connector oder HTTP with Microsoft Entra ID', 'Custom connector or HTTP with Microsoft Entra ID') },
    { v: 'andere', text: T('Ich rufe eine andere Web-Schnittstelle auf', 'I call a different web API'), wirkung: 'pruefen', punkt: T('Für andere Web-Schnittstellen: Zeigt die Aktion im Designer das Premium-Kennzeichen, brauchst du Premium.', 'For other web APIs: if the action shows the premium label in the designer, you need Premium.') }] },
  { id: 'q3', frage: T('Liest oder schreibt dein Flow Daten in Dataverse?', 'Does your flow read or write data in Dataverse?'), hinweis: '', optionen: [
    { v: 'nein', text: T('Nein', 'No'), wirkung: 'standard' },
    { v: 'ja', text: T('Ja', 'Yes'), wirkung: 'premium', punkt: 'Microsoft Dataverse' }] },
  { id: 'q4', frage: T('Soll dein Cloud Flow einen Desktop Flow auf einem Rechner starten?', 'Should your cloud flow start a desktop flow on a machine?'), hinweis: '', optionen: [
    { v: 'nein', text: T('Nein', 'No'), wirkung: 'standard' },
    { v: 'ja', text: T('Ja', 'Yes'), wirkung: 'premium', punkt: T('Desktop Flows aus einem Cloud Flow (RPA)', 'Desktop flows started from a cloud flow (RPA)') }] }
];
const LQUELLEN = () => [
  { url: 'https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs', titel: 'Power Automate licensing FAQ' },
  { url: 'https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/deep-dive-on-specific-license', titel: 'Deep dive on specific licenses' },
  { url: 'https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-standard-connectors', titel: 'List of all Standard tier connectors' },
  { url: 'https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-premium-connectors', titel: 'List of all Premium tier connectors' },
  { url: 'https://learn.microsoft.com/en-us/connectors/commondataserviceforapps/', titel: T('Microsoft Dataverse, Connector-Referenz', 'Microsoft Dataverse connector reference') },
  { url: 'https://learn.microsoft.com/en-us/connectors/webcontents/', titel: T('HTTP with Microsoft Entra ID (preauthorized), Connector-Referenz', 'HTTP with Microsoft Entra ID (preauthorized) connector reference') }
];

/* Rahmen */
const NAV = { wand: 'techniken', technik: 'techniken', pruefung: 'pruefung', premium: 'premium', dojo: 'dojo' };
const alleSeiten = []; // [pfad ohne Sprachpraefix] je Sprache, fuer hreflang und Sitemap
function seite(relL, p) {
  // relL: Pfad relativ zur Sprachwurzel (index.html, techniken/x/index.html, 404.html)
  const rel = PFX() + relL;
  const r = p.absolut ? BASIS_PFAD : praefix(rel); // Wurzel der Website (Assets)
  const lr = r + PFX(); // Wurzel der aktuellen Sprache (Seiten)
  const pfad = relL.replace(/(^|\/)index\.html$/, '$1');
  const andere = L === 'en' ? '' : 'en/';
  const cur = (n) => NAV[p.seite] === n ? (/^(wand|pruefung|premium|dojo)$/.test(p.seite) ? ' aria-current="page"' : ' aria-current="true"') : '';
  const ctx = {
    r, lr, name: NAME, marke_knoten: markeKnoten,
    icon_suche: ICONS.suche, icon_sonne: ICONS.sonne, icon_mond: ICONS.mond, icon_menue: ICONS.menue, icon_zu: ICONS.zu,
    cur_techniken: cur('techniken'), cur_pruefung: cur('pruefung'), cur_premium: cur('premium'), cur_dojo: cur('dojo'),
    js_extra: (p.js || []).map(s => `<script src="${r}assets/js/${s}" defer></script>`).join('\n'),
    tipp_fuss: mitUtm('https://www.powerplatformtip.com/', 'fusszeile'), academy_fuss: mitUtm(CFG.academy_url, 'fusszeile'),
    sprache_href: r + andere + pfad, sprache_code: L === 'en' ? 'de' : 'en', sprache_kurz: L === 'en' ? 'DE' : 'EN', sprache_name: L === 'en' ? 'Deutsche Version' : 'English version'
  };
  const noindex = TESTPHASE || p.noindex;
  const bild = p.ogBild || `${BASE_URL}${L === 'en' ? 'assets/img/en/og-image.png' : 'og-image.png'}`;
  const canonical = p.absolut ? '' : (p.canonical === false ? '' : BL() + pfad);
  const meta = [GENERATOR, `<title>${esc(p.titel)}</title>`, `<meta name="description" content="${esc(p.beschreibung)}">`];
  if (noindex) meta.push('<meta name="robots" content="noindex">');
  if (TESTPHASE) meta.push('<meta name="dojo-build" content="testphase">');
  if (canonical) {
    meta.push(`<link rel="canonical" href="${canonical}">`,
      `<link rel="alternate" hreflang="de" href="${BASE_URL}${pfad}">`, `<link rel="alternate" hreflang="en" href="${BASE_URL}en/${pfad}">`, `<link rel="alternate" hreflang="x-default" href="${BASE_URL}${pfad}">`);
  }
  meta.push(`<meta property="og:type" content="${p.ogTyp || 'website'}">`, `<meta property="og:site_name" content="${esc(NAME)}">`, `<meta property="og:locale" content="${T('de_CH', 'en_US')}">`, `<meta property="og:locale:alternate" content="${T('en_US', 'de_CH')}">`,
    `<meta property="og:title" content="${esc(p.ogTitel || p.titel)}">`, `<meta property="og:description" content="${esc(p.beschreibung)}">`);
  if (canonical) meta.push(`<meta property="og:url" content="${canonical}">`);
  meta.push(`<meta property="og:image" content="${bild}">`, '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">');
  if (p.jsonld) meta.push(jsonLd({ '@context': 'https://schema.org', '@graph': p.jsonld }));
  const html = `<!doctype html>
<html lang="${LANG_HTML()}" data-seite="${p.seite}" data-r="${r}" data-lr="${lr}">
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
const LD_WEBSITE = () => ({ '@type': 'WebSite', '@id': `${BL()}#website`, name: NAME, url: BL(), inLanguage: LANG_HTML(), description: T('Fragen, Erklärungen und Gürtelweg für Flows in Power Automate, auf Deutsch. Unabhängige Website ohne Verbindung zu Microsoft.', 'Questions, explanations and a belt path for flows in Power Automate. Independent website, not affiliated with Microsoft.'), publisher: { '@id': LD_ORG['@id'] } });
const krumen = (teile) => ({ '@type': 'BreadcrumbList', itemListElement: teile.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const krumenHtml = (r, teile) => `<nav class="krumen" aria-label="${T('Brotkrumen', 'Breadcrumb')}"><ol><li><a href="${r}">${T('Start', 'Home')}</a></li>${teile.map(([name, href], i) => `<li><a href="${href}"${i === teile.length - 1 ? ' aria-current="page"' : ''}>${esc(name)}</a></li>`).join('')}</ol></nav>`;

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
<ul class="metazeile"><li>${guertelTag(t.guertel)}</li><li data-heute-badge>${lizenzBadge(t)}</li></ul>
<${ebene} class="tdt__frage" data-heute-frage>${esc(t.quiz.frage)}</${ebene}>
<ul class="antworten antworten--drei" data-heute-antworten>${t.quiz.antworten.map((a, i) => `<li><a class="antwort" href="${r}techniken/${t.slug}/?antwort=${i}#quiz"><span class="antwort__b" aria-hidden="true">${BUCHST[i]}</span><span>${esc(a)}</span></a></li>`).join('')}</ul>
${mitLink ? `<p class="klein">${T('Tippe auf eine Antwort, die Auflösung steht auf der Technik-Seite', 'Tap an answer, the solution is on the technique page')}: <a href="${r}techniken/${t.slug}/" data-heute-link>${esc(t.titel_de)}</a></p>` : ''}
</article>`;
}

/* Seiten */
function guertelpfadHtml(r) {
  const zeile = (g) => {
    const tk = SEITEN.filter(t => t.guertel === g.nr).length;
    const fr = POOL.filter(t => t.guertel === g.nr).length;
    const ziel = g.nr === 7 && !tk;
    const zahl = ziel ? T('Ziel', 'Goal') : T(`${tk} ${tk === 1 ? 'Technik' : 'Techniken'}, ${fr} ${fr === 1 ? 'Frage' : 'Fragen'}`, `${tk} ${tk === 1 ? 'technique' : 'techniques'}, ${fr} ${fr === 1 ? 'question' : 'questions'}`);
    const name = ziel ? `<span class="pfadzeile__name">${esc(g.name)}: ${esc(g.leitwort)}</span>` : `<a class="pfadzeile__name" href="${r}guertel/${g.farbe}/">${esc(g.name)}: ${esc(g.leitwort)}</a>`;
    return `<li class="pfadzeile${ziel ? ' pfadzeile--ziel' : ''}" data-guertel-nr="${g.nr}"><span class="pfadzeile__band" aria-hidden="true"></span>${name}<span class="pfadzeile__zahl">${zahl}</span><p class="pfadzeile__kann">${esc(g.kannst_du)}</p></li>`;
  };
  return `<ol class="pfadzeilen">${GUERTEL.slice(0, 3).map(zeile).join('\n')}</ol>
<p class="schwelle"><strong>${T('Die Schwelle.', 'The threshold.')}</strong> ${T('Ab Grün wird es technisch: unsaubere Daten, parallele Schleifen, Aufrufe an SharePoint und Microsoft Graph.', 'From green on it gets technical: messy data, parallel loops, calls to SharePoint and Microsoft Graph.')}</p>
<ol class="pfadzeilen" start="4">${GUERTEL.slice(3).map(zeile).join('\n')}</ol>`;
}
const PRUEF_ANZAHL = () => GUERTEL.slice(0, 6).reduce((s, g) => s + Math.min(PRUEF_JE_GUERTEL, POOL.filter(t => t.guertel === g.nr).length), 0);

function baueStart() {
  const t = heuteTechnik(true);
  const lq = LQ(), q1 = lq[0];
  const haupt = `<main id="main">
<section class="wrap hero" aria-labelledby="h1">
  <div class="hero__band" aria-hidden="true">${GUERTEL.map(g => `<span data-guertel-nr="${g.nr}"></span>`).join('')}</div>
  <span class="label">${esc(NAME)}</span>
  <h1 id="h1">${T('Welcher <span class="strich">Flow-Gürtel</span> bist du?', 'Which <span class="strich">flow belt</span> are you?')}</h1>
  <p class="lead">${T(`${PRUEF_ANZAHL()} Fragen, rund vier Minuten. Danach weisst du, was du als Nächstes lernst.`, `${PRUEF_ANZAHL()} questions, about four minutes. Then you know what to learn next.`)}</p>
  <div class="knopf-reihe"><a class="knopf knopf--primaer" href="pruefung/">${T('Gürtelprüfung starten', 'Start the belt exam')}</a><a class="knopf" href="premium/">${T('Reicht meine Lizenz?', 'Is my license enough?')}</a></div>
</section>
<section class="block" aria-labelledby="h-lizenz"><div class="wrap sektion--eng">
  <div class="lcheck">
    <span class="label">${T(`Lizenz-Check, Frage 1 von ${lq.length}`, `License check, question 1 of ${lq.length}`)}</span>
    <h2 id="h-lizenz">${T('Reicht die Lizenz aus Microsoft 365 für deinen Flow?', 'Is the license from Microsoft 365 enough for your flow?')}</h2>
    <p class="lcheck__frage">${esc(q1.frage)}</p>
    <ul class="antworten antworten--drei">${q1.optionen.map((o, i) => `<li><a class="antwort" href="premium/?q1=${o.v}#q2"><span class="antwort__b" aria-hidden="true">${BUCHST[i]}</span><span>${esc(o.text)}</span></a></li>`).join('')}</ul>
    <p class="klein">${T('Vier Fragen, das Urteil mit Quelle bei Microsoft Learn. Keine Preise, nur der Lizenztyp.', 'Four questions, the verdict with a source on Microsoft Learn. No prices, only the license type.')}</p>
  </div>
</div></section>
<section class="block" aria-labelledby="h-tdt"><div class="wrap sektion--eng">
  <span class="label">${T('Technik des Tages', 'Technique of the day')}</span>
  <h2 id="h-tdt">${T('Kennst du die Antwort?', 'Do you know the answer?')}</h2>
  ${t ? quizKarte(t, '', 'p') : `<p class="leer-hinweis">${T('Die erste Technik des Tages folgt.', 'The first technique of the day is coming soon.')}</p>`}
</div></section>
<section class="block" aria-labelledby="h-pfad"><div class="wrap sektion--eng">
  <span class="label">${T('Der Gürtelweg', 'The belt path')}</span>
  <h2 id="h-pfad">${T('Sieben Gürtel, vom ersten Test bis zur Architektur', 'Seven belts, from the first test to architecture')}</h2>
  ${guertelpfadHtml('')}
  <p class="knopf-reihe"><a class="knopf" href="techniken/">${T('Alle Techniken ansehen', 'See all techniques')}</a></p>
</div></section>
<section class="block" aria-label="${T('Absender', 'About the author')}"><div class="wrap sektion--eng">
  <p class="absender">${T('Von Marcel Lehmann, KMUpower. Die Fragen stammen aus den wöchentlichen Tipps auf powerplatformtip.com. Wer Flows mit Begleitung lernen will', 'By Marcel Lehmann, KMUpower. The questions come from the weekly tips on powerplatformtip.com. If you want to learn flows with guidance')}: <a href="${esc(kursUrl('start'))}" rel="noopener">${esc(KURS_NAME())}</a>.</p>
</div></section>
</main>`;
  seite('index.html', {
    seite: 'start', titel: T(CFG.titel_start, 'Flow-Dojo by KMUpower'), haupt,
    beschreibung: T('Welcher Flow-Gürtel bist du? Gürtelprüfung, Lizenz-Check und Techniken mit Erklärung für Flows in Power Automate, auf Deutsch.', 'Which flow belt are you? Belt exam, license check and techniques with explanations for flows in Power Automate.'),
    ogTitel: T('Welcher Flow-Gürtel bist du?', 'Which flow belt are you?'), jsonld: [LD_WEBSITE(), LD_ORG]
  });
}
const KURS_NAME = () => T(`${CFG.kurs_name} der Power Platform Academy`, 'Power Automate live course of the Power Platform Academy');

function filterHtml() {
  const themen = [...new Set(SEITEN.map(t => t.thema))].sort((a, b) => a.localeCompare(b, L));
  const chip = (f, v, text, k = '') => `<button type="button" class="chip" data-f="${f}" data-v="${esc(v)}" aria-pressed="false">${k}${esc(text)}</button>`;
  return `<div class="filter" data-filter data-nur-js>
<label class="sr-only" for="wand-suche">${T('Techniken durchsuchen', 'Search techniques')}</label>
<input class="suchfeld" id="wand-suche" type="search" placeholder="${T('Suchen: JSON, Approval, SharePoint', 'Search: JSON, approval, SharePoint')}" data-wand-suche autocomplete="off">
<fieldset><legend>${T('Gürtel', 'Belt')}</legend><div class="chips">${GUERTEL.slice(0, 6).map(g => chip('guertel-nr', g.nr, g.kurz, bandPunkt(g.nr))).join('')}</div></fieldset>
<fieldset><legend>${T('Thema', 'Topic')}</legend><div class="chips">${themen.map(th => chip('thema', th, th)).join('')}</div></fieldset>
<fieldset><legend>${T('Lizenz', 'License')}</legend><div class="chips">${chip('lizenz', 'standard', 'Standard')}${chip('lizenz', 'premium', 'Premium')}</div></fieldset>
<fieldset><legend>${T('Dein Stand', 'Your progress')}</legend><div class="chips">${chip('stand', 'offen', T('Noch offen', 'Not yet practiced'))}${chip('stand', 'geuebt', T('Geübt', 'Practiced'))}</div></fieldset>
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
${drin.length ? `<ul class="karten">${drin.map(t => karte(t, r)).join('\n')}</ul>` : `<p class="leer-hinweis">${g.nr === 7 ? T('Meisterprüfung. Die Techniken für diesen Gürtel folgen, sobald die Tipps dazu überarbeitet sind.', 'Master exam. The techniques for this belt follow once the tips behind them have been revised.') : T('Weitere Techniken folgen mit der nächsten Welle.', 'More techniques follow with the next wave.')}</p>`}
</section>`;
  }).join('\n');
  const haupt = `<main id="main"><div class="wrap">
${krumenHtml(r, [[T('Techniken', 'Techniques'), './']])}
<div class="sektion--eng">
<span class="label">${T('Technik-Wand', 'Technique wall')}</span>
<h1 id="h1">${T('Alle Techniken', 'All techniques')}</h1>
<p class="lead">${T(`${SEITEN.length} Techniken mit Quizfrage, Erklärung und Ausdruck. Jede verweist auf den ganzen Tipp mit Screenshots auf powerplatformtip.com.`, `${SEITEN.length} techniques with a quiz question, explanation and expression. Each one links to the full tip with screenshots on powerplatformtip.com.`)}</p>
${filterHtml()}
</div>
${abschnitte}
</div></main>`;
  seite('techniken/index.html', {
    seite: 'wand', titel: T(`Alle Techniken für Flows nach Gürtel | ${NAME}`, `All techniques for flows by belt | ${NAME}`), haupt,
    beschreibung: T(`${SEITEN.length} Techniken für Flows in Power Automate, nach Gürtel geordnet. Jede mit Quizfrage, Erklärung auf Deutsch und Link zum ganzen Tipp.`, `${SEITEN.length} techniques for flows in Power Automate, ordered by belt. Each with a quiz question, explanation and a link to the full tip.`),
    jsonld: [LD_WEBSITE(), LD_ORG, { '@type': 'CollectionPage', name: T('Alle Techniken', 'All techniques'), url: `${BL()}techniken/`, inLanguage: LANG_HTML(), mainEntity: { '@type': 'ItemList', itemListElement: SEITEN.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: urlTechnik(t), name: t.titel_de })) } }, krumen([[T('Start', 'Home'), BL()], [T('Techniken', 'Techniques'), `${BL()}techniken/`]])]
  });
}

function baueTechnik(t, i) {
  const r = '../../';
  const g = GUERTEL[t.guertel - 1];
  const url = urlTechnik(t);
  const vor = SEITEN[i - 1], nach = SEITEN[i + 1];
  const q = t.quiz;
  const kurs = t.guertel >= 4 ? `<p class="kurs-zeile">${T('Lieber mit Begleitung? Der', 'Prefer to learn with guidance? The')} <a href="${esc(kursUrl(`technik-${t.tipp_nr}`))}" rel="noopener">${esc(KURS_NAME())}</a> ${T('führt in vier Wochen von den Grundlagen bis zu Error Handling und Scopes.', 'takes you from the basics to error handling and scopes in four weeks.')}</p>` : '';
  const indexierbar = !TESTPHASE;
  const belege = (t.lizenz_belege || []).map(b => `<a href="${esc(b.url)}" rel="noopener">${esc(b.titel)}</a>`).join(', ');
  const haupt = `<main id="main"><div class="wrap">
${krumenHtml(r, [[T('Techniken', 'Techniques'), '../'], [t.titel_de, './']])}
<article class="tk" data-technik="${esc(t.schluessel)}" data-guertel-nr="${t.guertel}">
<header class="tk__kopf">
<ul class="metazeile"><li>${guertelTag(t.guertel)}</li><li>${lizenzBadge(t)}</li><li class="tk__nr">${T('Tipp', 'Tip')} ${t.tipp_nr}</li></ul>
<h1 id="h1">${esc(t.titel_de)}</h1>
</header>
<section class="quiz" id="quiz" data-quiz data-richtig="${q.richtig_index}" data-guertel-nr="${t.guertel}" aria-labelledby="h-quiz">
<h2 id="h-quiz" class="label">${T('Quizfrage', 'Quiz question')}</h2>
<p class="quiz__frage">${esc(q.frage)}</p>
<ul class="antworten" data-nur-js>${q.antworten.map((a, k) => `<li><button type="button" class="antwort" data-antwort="${k}"><span class="antwort__b" aria-hidden="true">${BUCHST[k]}</span><span>${esc(a)}</span></button></li>`).join('')}</ul>
<p class="quiz__status" data-quiz-status role="status" aria-live="polite"></p>
<div class="aufloesung-block" data-aufloesung>
<h3>${T('Auflösung', 'Solution')}</h3>
<ol class="aufloesung">${q.antworten.map((a, k) => `<li class="${k === q.richtig_index ? 'richtig' : 'falsch'}"><b>${BUCHST[k]}) ${esc(a)}</b>${esc(q.erklaerungen[k])}</li>`).join('')}</ol>
</div>
</section>
<section class="abschnitt" aria-labelledby="h-worum"><h2 id="h-worum">${T('Worum es geht', 'What it is about')}</h2><p>${esc(t.kurztext_de)}</p></section>
${t.ausdruck ? `<section class="abschnitt" aria-labelledby="h-ausdruck"><h2 id="h-ausdruck">${T('Der Ausdruck aus dem Tipp', 'The expression from the tip')}</h2><div class="code-block"><pre id="ausdruck"><code>${esc(t.ausdruck)}</code></pre><button type="button" class="knopf knopf--klein" data-kopieren="ausdruck" data-nur-js>${T('Kopieren', 'Copy')}</button></div></section>` : ''}
<section class="abschnitt" aria-labelledby="h-wann"><h2 id="h-wann">${T('Wann einsetzen, wann nicht', 'When to use it, when not')}</h2><div class="zwei"><div class="karte-text"><h3>${T('Einsetzen', 'Use it')}</h3><p>${esc(t.wann_ja)}</p></div><div class="karte-text"><h3>${T('Lieber nicht', 'Better not')}</h3><p>${esc(t.wann_nein)}</p></div></div></section>
<section class="abschnitt" aria-labelledby="h-fehler"><h2 id="h-fehler">${T('Häufigster Fehler', 'Most common mistake')}</h2><p>${esc(t.fehler)}</p></section>
<section class="abschnitt" aria-labelledby="h-lizenz"><h2 id="h-lizenz">${T('Lizenz', 'License')}</h2><p>${lizenzBadge(t)} ${esc(LIZENZ_SATZ()[t.lizenz])} ${T('Beleg bei Microsoft Learn', 'Source on Microsoft Learn')}: ${belege}. ${T('Für deinen ganzen Flow', 'For your whole flow')}: <a href="${r}premium/">${T('Lizenz-Check', 'License check')}</a>.</p></section>
<section class="abschnitt" aria-label="${T('Ganzer Tipp', 'Full tip')}"><a class="tipp-knopf" href="${esc(mitUtm(t.tipp_url, `technik-${t.tipp_nr}`))}" rel="noopener"><strong>${T('Ganzer Tipp mit Screenshots auf powerplatformtip.com', 'Full tip on powerplatformtip.com')}</strong><span>${esc(tippLabel(t))}${T(', auf Englisch', ', with screenshots')}</span></a></section>
<section class="abschnitt" aria-label="${T('Dein Stand', 'Your progress')}">
<button type="button" class="knopf" data-geuebt="${esc(t.schluessel)}" aria-pressed="false" data-nur-js>${T('Als geübt markieren', 'Mark as practiced')}</button>
<p class="status-zeile" data-geuebt-status role="status" aria-live="polite"></p>
${kurs}
</section>
<section class="abschnitt" aria-labelledby="h-teilen"><h2 id="h-teilen">${T('Teilen', 'Share')}</h2>
<div class="knopf-reihe"><a class="knopf knopf--klein" href="${esc(linkedinUrl(teilenText(t)))}" rel="noopener">${T('Als Quizfrage auf LinkedIn teilen', 'Share as a quiz question on LinkedIn')}</a><button type="button" class="knopf knopf--klein" data-kopieren-text="${esc(teilenText(t)).replace(/\n/g, '&#10;')}" data-nur-js>${T('Text kopieren', 'Copy text')}</button><a class="knopf knopf--leise knopf--klein" href="${esc(mailtoFehler(t))}">${T('Fehler in dieser Frage melden', 'Report an error in this question')}</a></div>
<p class="klein">${T('Kurzadresse', 'Short link')}: ${esc(KURZ_BASIS)}/${PFX()}${t.tipp_nr}</p>
</section>
<p class="quelle">${T('Quelle', 'Source')}: <a href="${esc(mitUtm(t.tipp_url, `quelle-${t.tipp_nr}`))}" rel="noopener">${esc(tippLabel(t))}</a>, Microsoft Learn: <a href="${esc(t.learn_url)}" rel="noopener">${esc(t.learn_titel)}</a>.</p>
<nav class="blaettern" aria-label="${T('Weitere Techniken', 'More techniques')}">${vor ? `<a href="${r}techniken/${vor.slug}/" rel="prev"><span>${T('Vorherige Technik', 'Previous technique')}</span>${esc(vor.titel_de)}</a>` : `<a href="${r}techniken/"><span>${T('Zurück', 'Back')}</span>${T('Zur Technik-Wand', 'To the technique wall')}</a>`}${nach ? `<a href="${r}techniken/${nach.slug}/" rel="next"><span>${T('Nächste Technik', 'Next technique')}</span>${esc(nach.titel_de)}</a>` : `<a href="${r}pruefung/" rel="next"><span>${T('Geschafft', 'Done')}</span>${T('Zur Gürtelprüfung', 'To the belt exam')}</a>`}</nav>
</article>
</div></main>`;
  seite(`techniken/${t.slug}/index.html`, {
    seite: 'technik', titel: `${t.titel_de} | ${NAME}`, haupt, noindex: !indexierbar, ogTyp: 'article',
    ogBild: `${BASE_URL}assets/img/${PFX()}guertel-${g.farbe}.png`,
    beschreibung: T(`${t.titel_de}: Quizfrage mit Auflösung, kurze Erklärung auf Deutsch und der Link zum ganzen Tipp auf powerplatformtip.com.`, `${t.titel_de}: quiz question with solution, a short explanation and the link to the full tip on powerplatformtip.com.`).slice(0, 160),
    jsonld: [LD_WEBSITE(), LD_ORG, { '@type': 'LearningResource', '@id': `${url}#technik`, name: t.titel_de, url, inLanguage: LANG_HTML(), learningResourceType: 'Quiz', educationalLevel: g.name, isBasedOn: t.tipp_url, citation: [t.learn_url, ...(t.lizenz_belege || []).map(b => b.url)], publisher: { '@id': LD_ORG['@id'] }, isPartOf: { '@id': `${BL()}#website` }, hasPart: { '@id': `${url}#quiz` } },
      { '@type': 'Quiz', '@id': `${url}#quiz`, name: `${T('Quizfrage', 'Quiz question')}: ${t.titel_de}`, inLanguage: LANG_HTML(), educationalLevel: g.name, about: { '@type': 'Thing', name: 'Power Automate' }, isBasedOn: t.tipp_url,
        hasPart: [{ '@type': 'Question', eduQuestionType: 'Multiple choice', learningResourceType: 'Practice problem', name: q.frage, text: q.frage,
          acceptedAnswer: { '@type': 'Answer', position: q.richtig_index, text: q.antworten[q.richtig_index], answerExplanation: { '@type': 'Comment', text: q.erklaerungen[q.richtig_index] } },
          suggestedAnswer: q.antworten.map((a, k) => k === q.richtig_index ? null : { '@type': 'Answer', position: k, text: a, answerExplanation: { '@type': 'Comment', text: q.erklaerungen[k] } }).filter(Boolean) }] },
      krumen([[T('Start', 'Home'), BL()], [T('Techniken', 'Techniques'), `${BL()}techniken/`], [t.titel_de, url]])]
  });
  return indexierbar;
}

function baueHeute() {
  const t = heuteTechnik(false);
  const haupt = `<main id="main"><div class="wrap sektion--eng">
<span class="label">${T('Technik des Tages', 'Technique of the day')}</span>
<h1 id="h1">${T('Die Frage von heute', "Today's question")}</h1>
<p class="lead">${T('Jeden Tag eine Frage aus dem Dojo, für alle am selben Tag dieselbe. Antwort antippen, die Auflösung steht auf der Technik-Seite.', 'One question from the dojo every day, the same for everyone on the same day. Tap an answer, the solution is on the technique page.')}</p>
<div data-heute data-heute-alle>${t ? quizKarte(t, '../', 'h2') : `<p class="leer-hinweis">${T('Die erste Technik des Tages folgt.', 'The first technique of the day is coming soon.')}</p>`}</div>
<p class="knopf-reihe"><a class="knopf" href="../kalender/montag.ics" download>${T('Jeden Montag eine Frage im Kalender', 'A question in your calendar every Monday')}</a><a class="knopf knopf--leise" href="../techniken/">${T('Alle Techniken', 'All techniques')}</a></p>
</div></main>`;
  seite('heute/index.html', { seite: 'heute', titel: T(`Technik des Tages | ${NAME}`, `Technique of the day | ${NAME}`), haupt, beschreibung: T('Jeden Tag eine Quizfrage zu Flows in Power Automate, mit Auflösung und Erklärung.', 'A quiz question about flows in Power Automate every day, with solution and explanation.') });
}

function bauePruefung() {
  const n = PRUEF_ANZAHL();
  const haupt = `<main id="main"><div class="wrap sektion--eng pruef">
${krumenHtml('../', [[T('Gürtelprüfung', 'Belt exam'), './']])}
<span class="label">${T('Selbsttest', 'Self-assessment')}</span>
<h1 id="h1">${T('Gürtelprüfung', 'Belt exam')}</h1>
<p class="lead">${T(`${n} Fragen von Weiss bis Braun, zwei je Gürtel. Zwei falsche Antworten in einem Gürtel beenden die Prüfung.`, `${n} questions from white to brown, two per belt. Two wrong answers in one belt end the exam.`)}</p>
<div data-pruefung data-anzahl="${n}">
<p class="knopf-reihe"><button type="button" class="knopf knopf--primaer" data-pruefung-start data-nur-js>${T('Prüfung starten', 'Start the exam')}</button></p>
<p class="klein" data-nur-js>${T(`Die Fragen kommen zufällig aus ${POOL.length} Fragen zu den Tipps. Dein Ergebnis bleibt in deinem Browser.`, `The questions are drawn at random from ${POOL.length} questions on the tips. Your result stays in your browser.`)}</p>
<p class="leer-hinweis" data-ohne-js>${T('Die Gürtelprüfung braucht JavaScript. Alle Fragen mit Auflösung findest du auch auf den', 'The belt exam needs JavaScript. You also find questions with solutions on the')} <a href="../techniken/">${T('Technik-Seiten', 'technique pages')}</a>.</p>
</div>
<section class="abschnitt" aria-labelledby="h-regeln"><h2 id="h-regeln">${T('So wird gewertet', 'How it is scored')}</h2>
<ul class="arrow-list">${T('<li>Ein Gürtel gilt als bestanden, wenn alle seine Fragen richtig sind.</li><li>Dein Ergebnis ist der höchste Gürtel, bis zu dem alle Gürtel bestanden sind.</li><li>Zwei falsche Antworten im selben Gürtel beenden die Prüfung. Den schwarzen Gürtel prüft die Meisterprüfung, sie folgt.</li><li>Nach jeder Frage führt ein Link zum Tipp, aus dem sie stammt.</li>', '<li>You pass a belt when all of its questions are correct.</li><li>Your result is the highest belt up to which you passed every belt.</li><li>Two wrong answers in the same belt end the exam. The black belt is tested in the master exam, which is coming soon.</li><li>After each question, a link takes you to the tip it comes from.</li>')}</ul>
</section>
</div></main>`;
  seite('pruefung/index.html', {
    seite: 'pruefung', titel: T(`Gürtelprüfung für Flows | ${NAME}`, `Belt exam for flows | ${NAME}`), haupt, js: ['pruefung.js'],
    beschreibung: T(`Welcher Flow-Gürtel bist du? ${n} Fragen zu Flows in Power Automate, von Weiss bis Braun, mit Ergebnisbild zum Teilen.`, `Which flow belt are you? ${n} questions about flows in Power Automate, from white to brown, with a result image to share.`),
    ogTitel: T('Welcher Flow-Gürtel bist du?', 'Which flow belt are you?'), jsonld: [LD_WEBSITE(), LD_ORG, krumen([[T('Start', 'Home'), BL()], [T('Gürtelprüfung', 'Belt exam'), `${BL()}pruefung/`]])]
  });
}

function bauePremium() {
  const standard = SEITEN.filter(t => t.lizenz === 'standard');
  const lq = LQ();
  const fragen = lq.map((q, qi) => `<fieldset class="lfrage" id="${q.id}">
<legend>${qi + 1}. ${esc(q.frage)}</legend>
${q.hinweis ? `<p class="klein">${esc(q.hinweis)}</p>` : ''}
${q.optionen.map(o => `<label class="wahl"><input type="radio" name="${q.id}" value="${o.v}" data-wirkung="${o.wirkung}" data-punkt="${esc(o.punkt || '')}"><span>${esc(o.text)}</span></label>`).join('\n')}
</fieldset>`).join('\n');
  const stand = T(datumCH(LIMITS.stand), LIMITS.stand);
  const haupt = `<main id="main"><div class="wrap sektion--eng pruef">
${krumenHtml('../', [[T('Lizenz-Check', 'License check'), './']])}
<span class="label">${T(`Lizenz-Check, Stand ${stand}`, `License check, as of ${stand}`)}</span>
<h1 id="h1">${T('Reicht meine Lizenz?', 'Is my license enough?')}</h1>
<p class="lead">${T('Vier Fragen zu deinem Flow. Das Urteil sagt dir, ob die Lizenz aus Microsoft 365 reicht oder wofür du Power Automate Premium brauchst.', 'Four questions about your flow. The verdict tells you whether the license from Microsoft 365 is enough or what you need Power Automate Premium for.')}</p>
<div class="urteil pruefen" data-urteil role="status" aria-live="polite">${T('Beantworte die vier Fragen, das Urteil erscheint hier.', 'Answer the four questions and the verdict appears here.')}</div>
<ul class="arrow-list" data-urteil-liste></ul>
<form data-lizenz-check>
${fragen}
</form>
<section class="abschnitt" aria-labelledby="h-grundlage"><h2 id="h-grundlage">${T('Worauf das Urteil beruht', 'What the verdict is based on')}</h2>
<ul class="arrow-list">
${T(`<li>Mit einer Lizenz aus Microsoft 365 nutzt du Standard-Connectoren. Verwendet ein Flow keinen Premium-Connector, brauchst du keine Premium-Lizenz.</li>
<li>Microsoft Dataverse und HTTP with Microsoft Entra ID sind Premium-Connectoren. Custom Connectors und Desktop Flows aus Cloud Flows sind in der Lizenz aus Microsoft 365 nicht enthalten.</li>
<li>Startet ein automatisierter oder geplanter Flow mit Premium-Connector, braucht nur der Besitzer die Premium-Lizenz. Bei Flows, die Personen per Knopf starten, braucht sie jede Person, die startet.</li>
<li>Voraussetzung ist, dass dein Abo aus Microsoft 365 Power Automate enthält. Welche Pläne das sind, steht in der Licensing FAQ.</li>`, `<li>With a license from Microsoft 365 you use standard connectors. If a flow uses no premium connector, you do not need a premium license.</li>
<li>Microsoft Dataverse and HTTP with Microsoft Entra ID are premium connectors. Custom connectors and desktop flows started from cloud flows are not included in the license from Microsoft 365.</li>
<li>If an automated or scheduled flow with a premium connector runs, only the owner needs the premium license. For flows that people start with a button, every person who starts it needs one.</li>
<li>This assumes your Microsoft 365 subscription includes Power Automate. The Licensing FAQ lists which plans do.</li>`)}
</ul>
<p class="klein">${T(`Quellen, Stand ${stand}`, `Sources, as of ${stand}`)}: ${LQUELLEN().map(q => `<a href="${q.url}" rel="noopener">${esc(q.titel)}</a>`).join(', ')}. ${T('Keine Lizenzberatung im Einzelfall: Für Verträge fragst du deinen Microsoft-Partner.', 'No licensing advice for individual cases: for contracts, ask your Microsoft partner.')}</p>
</section>
<section class="abschnitt" aria-labelledby="h-standard"><h2 id="h-standard">${T('Diese Techniken laufen mit Standard', 'These techniques run with Standard')}</h2>
<ul class="dojo-liste">${standard.map(t => `<li data-guertel-nr="${t.guertel}">${bandPunkt(t.guertel)}<a href="../techniken/${t.slug}/">${esc(t.titel_de)}</a></li>`).join('')}</ul>
</section>
</div></main>`;
  seite('premium/index.html', {
    seite: 'premium', titel: T(`Reicht meine Lizenz für Flows? Lizenz-Check | ${NAME}`, `Is my license enough for flows? License check | ${NAME}`), haupt, js: ['premium.js'],
    beschreibung: T('Vier Fragen zu deinem Flow: Reicht die Lizenz aus Microsoft 365 oder brauchst du Power Automate Premium? Mit Quellen bei Microsoft Learn.', 'Four questions about your flow: is the license from Microsoft 365 enough or do you need Power Automate Premium? With sources on Microsoft Learn.'),
    jsonld: [LD_WEBSITE(), LD_ORG, krumen([[T('Start', 'Home'), BL()], [T('Lizenz-Check', 'License check'), `${BL()}premium/`]])]
  });
}

function baueGuertel(g) {
  const r = '../../';
  const drin = SEITEN.filter(t => t.guertel === g.nr);
  const fr = POOL.filter(t => t.guertel === g.nr).length;
  const naechster = GUERTEL[g.nr];
  const haupt = `<main id="main"><div class="wrap sektion--eng">
${krumenHtml(r, [[T('Gürtelweg', 'Belt path'), '../../techniken/'], [g.name, './']])}
<div class="ergebnis__abzeichen">${abzeichenSvg(g.nr)}<div><span class="label">${T(`Stufe ${g.nr} von 7`, `Level ${g.nr} of 7`)}</span><h1 id="h1">${esc(g.name)}: ${esc(g.leitwort)}</h1></div></div>
<p class="lead">${esc(g.erreicht_satz)}</p>
<section class="abschnitt" aria-labelledby="h-kann"><h2 id="h-kann">${T('Das kannst du mit diesem Gürtel', 'What you can do with this belt')}</h2><p>${esc(g.kannst_du)}</p>
${g.nr === 7 && !drin.length ? `<p class="leer-hinweis">${T('Die Meisterprüfung folgt. Die Techniken dazu entstehen aus Tipps, die gerade überarbeitet werden: ein Switch-Router als Werkzeug für Agents und Connector-Aufrufe, die sich selbst korrigieren.', 'The master exam is coming soon. Its techniques come from tips that are being revised right now: a switch router as a tool for agents and connector calls that correct themselves.')}</p>` : `<p class="klein">${T(`${drin.length} ${drin.length === 1 ? 'Technik' : 'Techniken'} mit eigener Seite, ${fr} ${fr === 1 ? 'Frage' : 'Fragen'} in der Gürtelprüfung.`, `${drin.length} ${drin.length === 1 ? 'technique' : 'techniques'} with their own page, ${fr} ${fr === 1 ? 'question' : 'questions'} in the belt exam.`)}</p>`}
</section>
${drin.length ? `<ul class="karten">${drin.map(t => karte(t, r)).join('\n')}</ul>` : ''}
<p class="knopf-reihe"><a class="knopf knopf--primaer" href="${r}pruefung/">${T('Gürtelprüfung starten', 'Start the belt exam')}</a>${naechster && g.nr < 6 ? `<a class="knopf" href="${r}guertel/${naechster.farbe}/">${T('Weiter zu', 'On to the')} ${esc(T(naechster.name, naechster.name.toLowerCase()))}</a>` : ''}</p>
</div></main>`;
  seite(`guertel/${g.farbe}/index.html`, {
    seite: 'guertel', titel: `${g.name}: ${g.leitwort} | ${NAME}`, haupt,
    ogBild: `${BASE_URL}assets/img/${PFX()}guertel-${g.farbe}.png`, ogTitel: T(`${g.name} im KMUpower Flow-Dojo`, `${g.name} in the KMUpower Flow-Dojo`),
    beschreibung: `${g.name}: ${g.kannst_du}`.slice(0, 160),
    jsonld: [LD_WEBSITE(), LD_ORG, krumen([[T('Start', 'Home'), BL()], [g.name, `${BL()}guertel/${g.farbe}/`]])]
  });
}

function baueDojo() {
  const liste = GUERTEL.slice(0, 6).map(g => {
    const drin = SEITEN.filter(t => t.guertel === g.nr);
    if (!drin.length) return '';
    return `<section class="abschnitt" aria-labelledby="dl-${g.farbe}" data-guertel-nr="${g.nr}"><h2 id="dl-${g.farbe}">${bandPunkt(g.nr)} ${esc(g.name)}</h2>
<ul class="dojo-liste">${drin.map(t => `<li data-technik="${esc(t.schluessel)}"><a href="../techniken/${t.slug}/">${esc(t.titel_de)}</a><span class="status" data-status-text>${T('offen', 'open')}</span></li>`).join('')}</ul></section>`;
  }).join('\n');
  const haupt = `<main id="main"><div class="wrap sektion--eng pruef">
<span class="label">${T('Dein Fortschritt', 'Your progress')}</span>
<h1 id="h1">${T('Mein Dojo', 'My dojo')}</h1>
<p class="lead" data-dojo-stand>${T('Hier siehst du, welche Techniken du geübt hast und welchen Gürtel du in der Prüfung erreicht hast. Alles bleibt in deinem Browser.', 'Here you see which techniques you have practiced and which belt you reached in the exam. Everything stays in your browser.')}</p>
<p class="knopf-reihe"><a class="knopf knopf--primaer" href="../pruefung/">${T('Gürtelprüfung', 'Belt exam')}</a><a class="knopf" href="../heute/">${T('Technik des Tages', 'Technique of the day')}</a></p>
${liste}
<section class="abschnitt" aria-labelledby="h-loeschen"><h2 id="h-loeschen">${T('Daten löschen', 'Delete data')}</h2><p>${T('Dein Fortschritt liegt nur im lokalen Speicher dieses Browsers. Mit einem Klick ist er weg.', 'Your progress is only stored in the local storage of this browser. One click and it is gone.')}</p><p><button type="button" class="knopf knopf--leise" data-dojo-loeschen data-nur-js>${T('Alles löschen', 'Delete everything')}</button></p><p class="status-zeile" data-dojo-meldung role="status" aria-live="polite"></p></section>
</div></main>`;
  seite('dojo/index.html', { seite: 'dojo', titel: T(`Mein Dojo | ${NAME}`, `My dojo | ${NAME}`), haupt, beschreibung: T('Dein Fortschritt im KMUpower Flow-Dojo: geübte Techniken und dein Gürtel aus der Prüfung.', 'Your progress in the KMUpower Flow-Dojo: practiced techniques and your belt from the exam.') });
}

function baueRecht() {
  const r = '../';
  const ueber = `<main id="main"><div class="wrap">
${krumenHtml(r, [[T('Über', 'About'), './']])}
<div class="prose sektion--eng">
${T(`<h1 id="h1">Über das Flow-Dojo</h1>
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
<p>Wer Flows mit Begleitung lernen will: `, `<h1 id="h1">About the Flow-Dojo</h1>
<p class="lead">The Flow-Dojo tests and explains what the tips on powerplatformtip.com show. One question after another, from the first test to architecture.</p>
<h2>How it works</h2>
<ul class="arrow-list">
<li>Every technique starts with a quiz question. Guess first, then read: more sticks than with reading alone.</li>
<li>The solution explains every answer, including the wrong ones. Then follow a short explanation, the expression from the tip, when to use the technique and the most common mistake.</li>
<li>The step-by-step guide with screenshots is in the tip on powerplatformtip.com. Every technique links there.</li>
<li>The belt exam tells you where you stand. The license check tells you whether the license from Microsoft 365 is enough.</li>
</ul>
<h2>Where the content comes from</h2>
<p>All questions come from the weekly tips by Marcel Lehmann on powerplatformtip.com. Only tips that are current after the last review make it into the dojo. License statements and limit numbers are based on Microsoft Learn, with a link on every page. If an explanation here is wrong, the tip is corrected first and the dojo after that.</p>
<h2>What the dojo is not</h2>
<p>Not a Microsoft offering, not a certification and no licensing advice for individual cases. The belts are a learning aid of this website.</p>
<h2>Found an error?</h2>
<p>Every technique page has the link "Report an error in this question". Or write directly to <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>.</p>
<p>If you want to learn flows with guidance: `)}<a href="${esc(kursUrl('ueber'))}" rel="noopener">${esc(KURS_NAME())}</a>.</p>
</div></div></main>`;
  seite('ueber/index.html', { seite: 'ueber', titel: T(`Über das Flow-Dojo | ${NAME}`, `About the Flow-Dojo | ${NAME}`), haupt: ueber, beschreibung: T('Wie das KMUpower Flow-Dojo funktioniert, woher die Fragen kommen und was die Seite nicht ist.', 'How the KMUpower Flow-Dojo works, where the questions come from and what the site is not.') });

  const impressum = `<main id="main"><div class="wrap">
${krumenHtml(r, [[T('Impressum', 'Legal notice'), './']])}
<div class="prose sektion--eng">
${T(`<h1 id="h1">Impressum</h1>
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
<p>Die Ausdrücke aus den Tipps darfst du in deiner Organisation frei verwenden. Die übrigen Texte, Fragen und die Gestaltung dieser Seite darfst du nicht ohne Rücksprache als eigene veröffentlichen.</p>`, `<h1 id="h1">Legal notice</h1>
<h2>Provider</h2>
<address>Marcel Lehmann<br>Sole proprietorship (trade name KMUpower)<br>Weidstrasse 1<br>8320 Fehraltorf<br>Switzerland</address>
<p>UID: CHE-296.591.945, listed in the Swiss UID register since 01.01.2023 (<a href="https://www.uid.admin.ch/Detail.aspx?uid_id=CHE-296.591.945" rel="noopener">entry in the UID register</a>).</p>
<p>Email: <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a><br>Web: <a href="https://kmupower.com/" rel="noopener">kmupower.com</a></p>
<h2>Responsible for the content</h2>
<p>Marcel Lehmann.</p>
<h2>Independence and trademarks</h2>
<p>Microsoft and the Power Platform product names (for example Power Apps, Power Automate, Copilot Studio) are trademarks of the Microsoft group of companies. This is an independent website. It is not operated, sponsored or endorsed by Microsoft.</p>
<h2>Liability</h2>
<p>I check the content carefully and against the Microsoft documentation. I give no guarantee for accuracy, completeness or timeliness. Microsoft changes features and terms. The linked sources are authoritative. This website does not replace licensing or legal advice.</p>
<h2>Links</h2>
<p>This website links to third-party websites. Their providers are responsible for their content.</p>
<h2>Copyright</h2>
<p>You may use the expressions from the tips freely in your organization. You may not publish the other texts, questions or the design of this website as your own without asking first.</p>`)}
</div></div></main>`;
  seite('impressum/index.html', { seite: 'recht', titel: T(`Impressum | ${NAME}`, `Legal notice | ${NAME}`), haupt: impressum, beschreibung: T('Impressum des KMUpower Flow-Dojo.', 'Legal notice of the KMUpower Flow-Dojo.') });

  const p = CFG.speicher_praefix;
  const datenschutz = `<main id="main"><div class="wrap">
${krumenHtml(r, [[T('Datenschutz', 'Privacy'), './']])}
<div class="prose sektion--eng">
${T(`<h1 id="h1">Datenschutz</h1>
<p>Stand: ${datumCH(CFG.recht_stand)}</p>
<h2>Kurz erklärt</h2>
<ul class="arrow-list">
<li>Diese Seite setzt keine Cookies.</li>
<li>Aufrufe werden anonym mit GoatCounter gezählt, ohne Cookies und ohne Speicherung deiner IP-Adresse. Es gibt kein Tracking über Seiten hinweg.</li>
<li>Es gibt keine Konten und keine Formulare, die etwas senden.</li>
<li>Schriften, Skripte und Bilder kommen von dieser Seite selbst. Die einzige Verbindung zu einem Dritten ist die Zählanfrage an GoatCounter.</li>
<li>Was du im Dojo markierst oder in der Prüfung erreichst, bleibt in deinem Browser. Ich erhalte davon nichts.</li>
</ul>
<h2>Verantwortlich</h2>
<p>Marcel Lehmann (Handelsname KMUpower), erreichbar unter <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>. Die vollständigen Angaben stehen im <a href="../impressum/">Impressum</a>.</p>
<h2>Hosting bei GitHub Pages</h2>
<p>Die Seite liegt auf GitHub Pages. Betreiber ist GitHub Inc. in den USA. Beim Aufruf verarbeitet GitHub technisch notwendige Zugriffsdaten in Server-Logs, zum Beispiel deine IP-Adresse und den Zeitpunkt des Aufrufs. Ich werte diese Logs nicht aus. Dabei können Daten in die USA übermittelt werden. Einzelheiten stehen in der <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">Datenschutzerklärung von GitHub</a>.</p>
<h2 id="zugriffszaehlung">Anonyme Zugriffszählung mit GoatCounter</h2>
<p>Damit ich sehe, welche Techniken gelesen werden, zählt die Seite Aufrufe mit GoatCounter. Anbieter ist GoatCounter.com, betrieben von Martin Tournoij in Irland, die Daten liegen auf Servern der Hetzner Online GmbH in Finnland und Deutschland. Das Zählskript liefert diese Seite selbst aus, nur die Zählanfrage geht an GoatCounter.</p>
<p>Bei jedem Aufruf erhält GoatCounter die Adresse der Seite, die verweisende Seite, die Browserkennung, die Bildschirmbreite, die Browsersprache und deine IP-Adresse. Gespeichert werden nur Summen pro Tag oder Stunde: Seitenpfad, verweisende Seite, Browser und Betriebssystem mit Version, Land, Sprache und Bildschirmbreite. Die IP-Adresse und die vollständige Browserkennung werden nicht gespeichert. Damit ein Neuladen nicht doppelt zählt, hält GoatCounter eine Kombination aus Seite, IP-Adresse und Browserkennung höchstens 8 Stunden im Arbeitsspeicher, nie auf der Festplatte. Es werden keine Cookies gesetzt, nichts im Browser gespeichert und keine Daten an Dritte weitergegeben. Grundlage ist mein Interesse zu wissen, welche Inhalte genutzt werden. Einzelheiten stehen in der <a href="https://www.goatcounter.com/help/privacy" rel="noopener">Datenschutzerklärung von GoatCounter</a>. Wenn du die Zählung nicht willst, blockiere Anfragen an goatcounter.com mit einem Inhaltsblocker. Die Seite funktioniert dann genau gleich.</p>
<h2 id="dein-fortschritt">Dein Fortschritt im Dojo</h2>
<p>Einige Einstellungen und dein Fortschritt werden im lokalen Speicher deines Browsers abgelegt (localStorage). Das ist kein Cookie. Die Einträge bleiben auf deinem Gerät und werden nie an mich oder an Dritte übertragen. Geschrieben wird erst, wenn du etwas tust.</p>
<ul class="arrow-list">
<li><code>${p}-theme</code>: «light» oder «dark». Merkt sich den Hell- oder Dunkelmodus.</li>
<li><code>${p}-lang</code>: «de» oder «en». Merkt sich deine Sprachwahl, damit die Startseite dich nicht erneut umleitet. Wird gesetzt, wenn du die Sprache wechselst oder die Startseite dich einmalig auf Englisch weiterleitet.</li>
<li><code>${p}-dojo-v1</code>: deine geübten Techniken mit Datum und dein Gürtel aus der Prüfung mit Datum. Gilt für beide Sprachen.</li>
</ul>
<p>Löschen: Unter <a href="../dojo/">Mein Dojo</a> entfernt «Alles löschen» alle Einträge. Du kannst sie auch in den Einstellungen deines Browsers löschen.</p>
<p>Das Ergebnisbild der Gürtelprüfung entsteht in deinem Browser. Es wird nirgends hochgeladen.</p>
<h2>Wenn du mir schreibst</h2>
<p>Der Link «Fehler in dieser Frage melden» bereitet nur eine Mail in deinem eigenen Mailprogramm vor. Gesendet wird erst, wenn du dort auf Senden klickst. Ich nutze deine Mailadresse und den Inhalt nur, um zu antworten und die Frage zu korrigieren, und lösche die Mail, wenn das erledigt ist.</p>
<h2>Links zu anderen Seiten</h2>
<p>Die Seite verlinkt auf powerplatformtip.com, Microsoft Learn, die Power Platform Academy, LinkedIn und weitere Seiten. Erst wenn du einen Link anklickst, erhält der jeweilige Anbieter deine Daten. Die Links zu powerplatformtip.com und zur Academy tragen eine Herkunftsangabe in der Adresse (utm_source=${CFG.utm_source}). Diese Seite selbst wertet den Parameter nicht aus, die Zielseite tut es nach ihrer eigenen Datenschutzerklärung.</p>
<h2>Deine Rechte</h2>
<p>Nach dem Schweizer Datenschutzgesetz kannst du Auskunft oder Löschung verlangen. Die Seite selbst speichert keine Personendaten bei mir, auch die Zählung bei GoatCounter enthält keine. Für die Logs beim Hosting wendest du dich an GitHub. Für alles andere schreib mir an <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>.</p>`, `<h1 id="h1">Privacy</h1>
<p>As of: ${CFG.recht_stand}</p>
<h2>In short</h2>
<ul class="arrow-list">
<li>This website sets no cookies.</li>
<li>Visits are counted anonymously with GoatCounter, without cookies and without storing your IP address. There is no tracking across websites.</li>
<li>There are no accounts and no forms that send anything.</li>
<li>Fonts, scripts and images come from this website itself. The only connection to a third party is the count request to GoatCounter.</li>
<li>What you mark in the dojo or reach in the exam stays in your browser. I receive none of it.</li>
</ul>
<h2>Responsible</h2>
<p>Marcel Lehmann (trade name KMUpower), reachable at <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>. Full details are in the <a href="../impressum/">legal notice</a>.</p>
<h2>Hosting on GitHub Pages</h2>
<p>The website is hosted on GitHub Pages, operated by GitHub Inc. in the USA. When you open a page, GitHub processes technically necessary access data in server logs, for example your IP address and the time of access. I do not analyze these logs. Data may be transferred to the USA in the process. Details are in the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub privacy statement</a>.</p>
<h2 id="zugriffszaehlung">Anonymous visit counting with GoatCounter</h2>
<p>So that I can see which techniques are read, the website counts visits with GoatCounter. The provider is GoatCounter.com, operated by Martin Tournoij in Ireland; the data is stored on servers of Hetzner Online GmbH in Finland and Germany. This website serves the counting script itself, only the count request goes to GoatCounter.</p>
<p>For each page view, GoatCounter receives the page address, the referring page, the browser identifier (User-Agent), the screen width, the browser language and your IP address. Only totals per day or hour are stored: page path, referring page, browser and operating system with version, country, language and screen width. Your IP address and the full browser identifier are not stored. So that a reload does not count twice, GoatCounter keeps a combination of site, IP address and browser identifier in memory for at most 8 hours, never on disk. No cookies are set, nothing is stored in your browser and no data is passed on to third parties. The basis is my interest in knowing which content is used. Details are in the <a href="https://www.goatcounter.com/help/privacy" rel="noopener">GoatCounter privacy policy</a>. If you do not want to be counted, block requests to goatcounter.com with a content blocker. The website works exactly the same.</p>
<h2 id="dein-fortschritt">Your progress in the dojo</h2>
<p>Some settings and your progress are stored in your browser's local storage (localStorage). This is not a cookie. The entries stay on your device and are never sent to me or to third parties. Nothing is written until you do something.</p>
<ul class="arrow-list">
<li><code>${p}-theme</code>: "light" or "dark". Remembers light or dark mode.</li>
<li><code>${p}-lang</code>: "de" or "en". Remembers your language choice so the home page does not redirect you again. Set when you switch the language or when the home page redirects you to English once.</li>
<li><code>${p}-dojo-v1</code>: your practiced techniques with date and your belt from the exam with date. Applies to both languages.</li>
</ul>
<p>Deleting: under <a href="../dojo/">My dojo</a>, "Delete everything" removes all entries. You can also delete them in your browser settings.</p>
<p>The result image of the belt exam is created in your browser. It is never uploaded.</p>
<h2>If you write to me</h2>
<p>The link "Report an error in this question" only prepares an email in your own mail program. Nothing is sent until you click send there. I use your email address and the content only to reply and to correct the question, and I delete the email once that is done.</p>
<h2>Links to other websites</h2>
<p>This website links to powerplatformtip.com, Microsoft Learn, the Power Platform Academy, LinkedIn and other websites. Only when you click a link does the provider receive your data. Links to powerplatformtip.com and the Academy carry a source parameter in the address (utm_source=${CFG.utm_source}). This website does not evaluate the parameter itself, the target website does so under its own privacy policy.</p>
<h2>Your rights</h2>
<p>Under the Swiss Federal Act on Data Protection you can request information or deletion. The website itself does not store any personal data with me, and the GoatCounter counts contain none either. For the hosting logs, contact GitHub. For everything else, write to me at <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a>.</p>`)}
</div></div></main>`;
  seite('datenschutz/index.html', { seite: 'recht', titel: T(`Datenschutz | ${NAME}`, `Privacy | ${NAME}`), haupt: datenschutz, beschreibung: T('Datenschutz im KMUpower Flow-Dojo: keine Cookies, anonyme Zugriffszählung, Fortschritt nur im Browser.', 'Privacy in the KMUpower Flow-Dojo: no cookies, anonymous visit counting, progress only in your browser.') });

  const b = BASIS_PFAD + PFX();
  seite('404.html', {
    seite: '404', absolut: true, titel: T(`Seite nicht gefunden | ${NAME}`, `Page not found | ${NAME}`), noindex: true, beschreibung: T('Diese Seite gibt es nicht.', 'This page does not exist.'),
    haupt: `<main id="main"><div class="wrap sektion">
<span class="label">${T('Fehler 404', 'Error 404')}</span>
<h1 id="h1">${T('Diese Seite gibt es nicht.', 'This page does not exist.')}</h1>
<p class="lead">${T(`Der Link ist falsch oder die Seite ist umgezogen. Eine Kurzadresse wie ${esc(KURZ_BASIS)}/158 führt direkt zur Technik zu diesem Tipp.`, `The link is wrong or the page has moved. A short link like ${esc(KURZ_BASIS)}/en/158 takes you straight to the technique for that tip.`)}</p>
<div class="knopf-reihe"><a class="knopf knopf--primaer" href="${b}techniken/">${T('Zu den Techniken', 'To the techniques')}</a><a class="knopf" href="${b}pruefung/">${T('Gürtelprüfung', 'Belt exam')}</a><a class="knopf knopf--leise" href="${b}">${T('Zur Startseite', 'To the home page')}</a></div>
</div></main>`
  });
}

function baueKurzadressen() {
  for (const t of SEITEN) {
    const ziel = `../techniken/${t.slug}/`;
    schreibe(`${PFX()}${t.tipp_nr}/index.html`, `<!doctype html>
<html lang="${LANG_HTML()}" data-seite="kurzadresse">
<head>
<meta charset="utf-8">
${GENERATOR}
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<title>${esc(t.titel_de)} | ${esc(NAME)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${urlTechnik(t)}">
<meta http-equiv="refresh" content="0; url=${ziel}">
<link rel="icon" href="${praefix(PFX() + 'x/index.html')}favicon.svg" type="image/svg+xml">
</head>
<body>
<p><a href="${ziel}">${T('Zur Technik', 'To the technique')}: ${esc(t.titel_de)}</a></p>
<p>${T('Unabhängige Website, keine Verbindung zu Microsoft.', 'Independent website, not affiliated with Microsoft.')}</p>
</body>
</html>
`);
  }
}

/* Daten fuer Skripte, Kalender je Sprache (assets/data/*.json Deutsch, *-en.json Englisch) */
function baueDaten() {
  const sfx = L === 'en' ? '-en' : '';
  schreibe(`assets/data/suche${sfx}.json`, JSON.stringify({ eintraege: SEITEN.map(t => ({ k: t.schluessel, nr: t.tipp_nr, titel: t.titel_de, g: t.guertel, slug: t.slug, s: [t.thema, ...(t.suchbegriffe || [])].join(' ') })) }));
  const folge = (daten.tag_reihenfolge || []).map(k => NACH_KEY[k]).filter(t => t && t.seite);
  schreibe(`assets/data/tag${sfx}.json`, JSON.stringify({ start: daten.tag_start, eintraege: folge.map(t => ({ k: t.schluessel, slug: t.slug, titel: t.titel_de, g: t.guertel, lizenz: t.lizenz, start: FUER_START(t), frage: t.quiz.frage, antworten: t.quiz.antworten })) }));
  const pool = POOL.map(t => ({ k: t.schluessel, g: t.guertel, frage: t.quiz.frage, antworten: t.quiz.antworten, richtig: t.quiz.richtig_index, erkl: (t.quiz.erklaerungen || [])[t.quiz.richtig_index] || '', url: t.seite ? `techniken/${t.slug}/` : mitUtm(t.tipp_url, `pruefung-${t.tipp_nr || 'artikel'}`), tipp: mitUtm(t.tipp_url, `pruefung-${t.tipp_nr || 'artikel'}`), titel: t.seite ? t.titel_de : tippLabel(t), tipp_label: tippLabel(t), seite: !!t.seite }));
  const guertel = GUERTEL.map(g => ({ nr: g.nr, farbe: g.farbe, name: g.name, akk: g.akk, kurz: g.kurz, leitwort: g.leitwort, kann: g.kannst_du, hex: g.hex, naechste: SEITEN.filter(t => t.guertel === g.nr).slice(0, 3).map(t => ({ titel: t.titel_de, url: `techniken/${t.slug}/` })) }));
  schreibe(`assets/data/pool${sfx}.json`, JSON.stringify({ base: BL(), kurz: KURZ_BASIS + (L === 'en' ? '/en' : ''), je_guertel: PRUEF_JE_GUERTEL, kurs: { einstieg: kursUrl('pruefung-einstieg'), fortgeschritten: kursUrl('pruefung-fortgeschritten'), name: KURS_NAME() }, guertel, fragen: pool }));

  const montag = (() => { const d = new Date(DATUM + 'T00:00:00Z'); do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() !== 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//KMUpower//Flow-Dojo//${L.toUpperCase()}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:flow-dojo-montag${L === 'en' ? '-en' : ''}@kmupower.com`,
    `DTSTAMP:${DATUM.replace(/-/g, '')}T000000Z`, `DTSTART:${montag}T083000`, 'DURATION:PT10M', 'RRULE:FREQ=WEEKLY;BYDAY=MO', T('SUMMARY:Flow-Dojo: eine Frage', 'SUMMARY:Flow-Dojo: one question'),
    T(`DESCRIPTION:Zehn Minuten, eine Frage zu Flows. Die Technik des Tages steht unter ${BL()}heute/`, `DESCRIPTION:Ten minutes, one question about flows. The technique of the day is at ${BL()}heute/`), `URL:${BL()}heute/`, 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'];
  schreibe(`${PFX()}kalender/montag.ics`, ics.map(falte).join('\r\n') + '\r\n');
}
/* Sitemap (beide Sprachen mit hreflang), robots, llms.txt: einmal nach beiden Sprachen */
function baueSitemap(indexierbar) {
  const alt = (p) => ['de', 'en'].map(s => `    <xhtml:link rel="alternate" hreflang="${s}" href="${BASE_URL}${s === 'en' ? 'en/' : ''}${p}"/>`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${p}"/>`;
  const url = (p, sprache) => `  <url>\n    <loc>${BASE_URL}${sprache === 'en' ? 'en/' : ''}${p}</loc>\n    <lastmod>${daten.stand}</lastmod>\n${alt(p)}\n  </url>`;
  const eintraege = [];
  for (const s of SPRACHEN) {
    const pfade = ['', 'pruefung/', 'premium/', 'techniken/', ...FARBEN.map(f => `guertel/${f}/`), 'heute/', 'dojo/', 'ueber/', 'impressum/', 'datenschutz/', ...indexierbar[s].map(t => `techniken/${t.slug}/`)];
    eintraege.push(...pfade.map(p => url(p, s)));
  }
  schreibe('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${eintraege.join('\n')}\n</urlset>\n`);
  const regeln = ['Allow: /', `Disallow: ${BASIS_PFAD}templates/`, `Disallow: ${BASIS_PFAD}scripts/`, `Disallow: ${BASIS_PFAD}data/`, 'Content-Signal: search=yes, ai-train=yes, ai-retrieval=yes'];
  const BOTS = ['Googlebot', 'Googlebot-Image', 'Bingbot', 'Slurp', 'DuckDuckBot', 'Applebot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'Claude-Web', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'cohere-ai', 'MistralAI-User', 'CCBot'];
  schreibe('robots.txt', [`# ${NAME}: robots.txt (erzeugt von scripts/build.mjs)`, '# Inhalte frei fuer Suche, KI-Training und KI-Antworten (contentsignals.org).', '# Die Content-Signal-Zeile steht in jeder Gruppe, weil ein Crawler nach RFC 9309 nur seine eigene Gruppe liest.', '',
    'User-agent: *', ...regeln, '', ...BOTS.flatMap(b => [`User-agent: ${b}`, ...regeln, '']), `Sitemap: ${BASE_URL}sitemap.xml`, '', `# Uebersicht fuer KI-Antwortsysteme: ${BASE_URL}llms.txt`, ''].join('\n'));
  // IndexNow: Schluesseldatei im Stamm (Key ist oeffentlich), CNAME aus domain
  if (CFG.indexnow_key) { if (!/^[a-f0-9]{32}$/.test(CFG.indexnow_key)) fehler('indexnow_key: 32 Hexzeichen'); schreibe(`${CFG.indexnow_key}.txt`, CFG.indexnow_key); }
  if (CFG.domain && new URL(BASE_URL).hostname === CFG.domain) schreibe('CNAME', CFG.domain + '\n');
  setzeSprache('de');
  const de = [`# ${NAME}`, '', `> Fragen, Erklärungen und Gürtelweg für Flows in Power Automate, auf Deutsch und Englisch. Jede Technik beruht auf einem Tipp von powerplatformtip.com und verlinkt ihn. Lizenzangaben mit Quelle bei Microsoft Learn. Unabhängige Website von Marcel Lehmann (KMUpower), keine Verbindung zu Microsoft.`, '',
    '## Seiten', '', `- [Gürtelprüfung](${BASE_URL}pruefung/): Selbsttest von Weiss bis Braun`, `- [Lizenz-Check](${BASE_URL}premium/): Reicht die Lizenz aus Microsoft 365?`, `- [Alle Techniken](${BASE_URL}techniken/): nach Gürtel geordnet`, `- [Über](${BASE_URL}ueber/): Methode und Herkunft der Fragen`, '',
    '## Techniken', '', ...SEITEN.map(t => `- [${t.titel_de}](${urlTechnik(t)}): ${GUERTEL[t.guertel - 1].name}, ${t.lizenz === 'premium' ? 'Premium' : 'Standard'}. Grundlage: ${t.tipp_url}`), ''];
  setzeSprache('en');
  const en = ['## English', '', `- [Home](${BASE_URL}en/): English version`, `- [Belt exam](${BASE_URL}en/pruefung/): self-assessment from white to brown`, `- [License check](${BASE_URL}en/premium/): is the license from Microsoft 365 enough?`, `- [All techniques](${BASE_URL}en/techniken/): ordered by belt`, '',
    ...SEITEN.map(t => `- [${t.titel_de}](${urlTechnik(t)}): ${GUERTEL[t.guertel - 1].name}, ${t.lizenz === 'premium' ? 'Premium' : 'Standard'}. Based on: ${t.tipp_url}`), ''];
  schreibe('llms.txt', [...de, ...en].join('\n'));
}
function falte(zeile) {
  if (Buffer.byteLength(zeile, 'utf8') <= 75) return zeile;
  const teile = []; let rest = zeile;
  while (Buffer.byteLength(rest, 'utf8') > 74) { let n = 74; while (Buffer.byteLength(rest.slice(0, n), 'utf8') > 74) n--; teile.push(rest.slice(0, n)); rest = rest.slice(n); }
  teile.push(rest);
  return teile.join('\r\n ');
}
function baueBilder() {
  if (L === 'de') schreibe('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#F4EFE6"/><g transform="translate(0 -1)"><path d="M2 11h28v7H2z" fill="#B4301A" stroke="#15171B" stroke-width="1.4"/><path d="M12.5 17.5L8 29h5.2l3-6.4M19.5 17.5L24 29h-5.2l-3-6.4" fill="#B4301A" stroke="#15171B" stroke-width="1.4"/><rect x="11.5" y="8.5" width="9" height="12" rx="2.2" fill="#15171B"/></g></svg>\n`);
  const schrift = "Bahnschrift, 'Arial Narrow', sans-serif";
  const karteSvg = (titel1, titel2, unter, hex) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#F4EFE6"/>
${BAND_HEX.map((c, i) => `<rect x="${i * (1200 / 7)}" y="604" width="${1200 / 7 + 1}" height="26" fill="${c}"/>`).join('')}
<rect x="0" y="603" width="1200" height="1.5" fill="#8A7F6C"/>
<text x="80" y="120" font-family="${schrift}" font-weight="600" font-size="34" letter-spacing="6" fill="#4E525B">KMUPOWER FLOW-DOJO</text>
<text x="76" y="270" font-family="${schrift}" font-weight="700" font-size="104" letter-spacing="-2" fill="#15171B">${titel1}</text>
<text x="76" y="380" font-family="${schrift}" font-weight="700" font-size="104" letter-spacing="-2" fill="#15171B">${titel2}</text>
<path d="M80 404C190 394 300 392 420 398" fill="none" stroke="#B4301A" stroke-width="12" stroke-linecap="round"/>
<text x="80" y="490" font-family="'Segoe UI', system-ui, sans-serif" font-size="34" fill="#4E525B">${unter}</text>
<g transform="translate(860 150) scale(9)"><path d="M2 11h28v7H2z" fill="${hex}" stroke="#15171B" stroke-width=".5"/><path d="M12.5 17.5L8 29h5.2l3-6.4M19.5 17.5L24 29h-5.2l-3-6.4" fill="${hex}" stroke="#15171B" stroke-width=".5"/><rect x="11.5" y="8.5" width="9" height="12" rx="2.2" fill="#15171B"/></g>
</svg>
`;
  if (L === 'de') schreibe('og-image.svg', karteSvg('Welcher', 'Flow-Gürtel?', 'Fragen und Erklärungen zu Flows, auf Deutsch.', '#B4301A'));
  else schreibe('assets/img/en/og-image.svg', karteSvg('Which', 'flow belt?', 'Questions and explanations on flows.', '#B4301A'));
  for (const g of GUERTEL) schreibe(`assets/img/${PFX()}guertel-${g.farbe}.svg`, karteSvg(g.name.split(' ')[0], T('Gürtel', 'belt'), esc(g.erreicht_satz).slice(0, 70), g.hex));
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
    if (!/(^|\/)404\.html$/.test(rel) && /\s(href|src)="\/(?!\/)/.test(html)) fehler(`${wo}: absoluter Pfad`);
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
      if (!/hreflang="en"/.test(html) && !/(^|\/)404\.html$/.test(rel)) fehler(`${wo}: hreflang fehlt`);
      if (!/data-sprache=/.test(html)) fehler(`${wo}: Sprachumschalter fehlt`);
    }
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    if (/[–—]/.test(text)) fehler(`${wo}: Gedankenstrich im Text`);
    if (/ - /.test(text.replace(/\s+/g, ' '))) fehler(`${wo}: « - » im Text`);
    if (/ß/.test(text)) fehler(`${wo}: Eszett im Text`);
    if (/\p{Extended_Pictographic}/u.test(text)) fehler(`${wo}: Emoji im Text`);
    if (/Entwurf|Prüfstempel|Geprüft am/i.test(text)) fehler(`${wo}: Entwurf- oder Prüfhinweis`);
    if (rel.startsWith('en/') && /[äöüÄÖÜ]/.test(text.replace(/Gürtel|Fehraltorf/g, ''))) warnung(`${wo}: Umlaut auf englischer Seite (deutscher Rest?)`);
  }
  for (const f of ['assets/data/pool.json', 'assets/data/pool-en.json', 'assets/data/tag.json', 'assets/data/tag-en.json', 'assets/data/suche.json', 'assets/data/suche-en.json']) {
    if (!gibtEs(f)) { fehler(`${f} fehlt`); continue; }
    const s = lies(f);
    if (/[–—ß]/.test(s) || /\p{Extended_Pictographic}/u.test(s)) fehler(`${f}: Gedankenstrich, Eszett oder Emoji`);
  }
  const groesse = (f) => gibtEs(f) ? fs.statSync(path.join(ROOT, f)).size / 1024 : 0;
  for (const [f, kb] of Object.entries({ 'assets/css/site.css': 30, 'assets/js/site.js': 20, 'assets/js/pruefung.js': 16, 'assets/js/premium.js': 6, 'index.html': 40 })) if (groesse(f) > kb) warnung(`Budget: ${f} ${groesse(f).toFixed(1)} KB, geplant ${kb} KB`);
}

/* Ablauf */
for (const s of SPRACHEN) { setzeSprache(s); validiere(); }
const indexierbar = {};
const zahlen = {};
if (!fehlerListe.length && MODUS !== 'pruefen') {
  baueCss();
  for (const s of SPRACHEN) {
    setzeSprache(s);
    baueBilder();
    baueStart();
    baueWand();
    indexierbar[s] = SEITEN.filter((t, i) => baueTechnik(t, i));
    baueHeute();
    bauePruefung();
    bauePremium();
    GUERTEL.forEach(baueGuertel);
    baueDojo();
    baueRecht();
    baueKurzadressen();
    baueDaten();
  }
  baueSitemap(indexierbar);
  abschluss();
}
setzeSprache('de');
console.log(`\nKMUpower Flow-Dojo Build, Modus ${MODUS}, Datum ${DATUM}, Sprachen ${SPRACHEN.join(', ')}`);
console.log(`Tipps: ${ALLE.length}, Pool ${POOL.length}, Technik-Seiten ${SEITEN.length}, Prüfung ${PRUEF_ANZAHL()} Fragen`);
console.log(`Pool je Gürtel: ${GUERTEL.map(g => `${g.kurz} ${POOL.filter(t => t.guertel === g.nr).length}`).join(', ')}`);
const ausgeschlossen = daten.techniken.filter(t => t.pool_ausschluss);
if (ausgeschlossen.length) console.log(`Ausgeschlossen: ${ausgeschlossen.map(t => t.schluessel).join(', ')}`);
SEITEN.forEach(t => { t._woerter = eigeneWoerter(t); });
const unter = SEITEN.filter(t => t._woerter < MIN_WOERTER_INDEX);
console.log(`Eigener Inhalt je Technik: ${Math.min(...SEITEN.map(t => t._woerter || 0))} bis ${Math.max(...SEITEN.map(t => t._woerter || 0))} Wörter, unter ${MIN_WOERTER_INDEX}: ${unter.length ? unter.map(t => t.tipp_nr).join(', ') : 'keine'}`);
if (geschrieben.length) console.log(`Geschrieben: ${geschrieben.length} Dateien, davon ${geschrieben.filter(f => f.endsWith('.html')).length} HTML-Seiten`);
if (warnListe.length) { console.log(`\nWarnungen (${warnListe.length}):`); warnListe.forEach(w => console.log('  - ' + w)); }
if (fehlerListe.length) { console.log(`\nFehler (${fehlerListe.length}):`); fehlerListe.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('\nOK');
