#!/usr/bin/env node
/*
  KMUpower Flow-Dojo: data/techniken.json aus dem Tipp-Inventar erzeugen oder ergaenzen.
  node scripts/import-tipps.mjs [--tipps <pfad>] [--review <pfad>]

  Quelle: _recherche/data/tipps.json (Inventar der Power-Automate-Tipps, nicht im Repo).
  Pool: Tipps mit Urteil «OK» oder «Klein» im Tip-Review-Inventar (CSV ausserhalb des Repos, Pfad in site.config.json).
  Das Urteil selbst wird nicht nach data/ geschrieben, nur das Ergebnis «pool».
  Vorhandene Eintraege in data/techniken.json bleiben erhalten: von Hand gepflegte Felder werden nie ueberschrieben,
  neue Tipps kommen mit pool und seite = false dazu (Ausnahme: pool aus dem Review beim ersten Import).
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const TIPPS = path.resolve(ROOT, arg('--tipps', '_recherche/data/tipps.json'));
const REVIEW = path.resolve(ROOT, arg('--review', CFG.review_csv));
const ZIEL = path.join(ROOT, 'data/techniken.json');
const FARBEN = ['weiss', 'gelb', 'orange', 'gruen', 'blau', 'braun', 'schwarz'];

if (!fs.existsSync(TIPPS)) { console.error(`Inventar fehlt: ${TIPPS}`); process.exit(1); }
const inventar = JSON.parse(fs.readFileSync(TIPPS, 'utf8'));
const alt = fs.existsSync(ZIEL) ? JSON.parse(fs.readFileSync(ZIEL, 'utf8')) : null;

// Review-Urteile (nur fuer den Pool, nicht gespeichert)
const urteil = {};
if (fs.existsSync(REVIEW)) {
  const zeilen = fs.readFileSync(REVIEW, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  for (const z of zeilen.slice(1)) {
    const teile = z.split(';');
    if (teile.length > 5) urteil[teile[2]] = teile[5];
  }
} else console.warn(`Hinweis: Review-Inventar nicht gefunden (${REVIEW}), pool bleibt wie bisher.`);
const urteilFuer = (url) => {
  const slug = url.split('/').filter(Boolean).pop();
  const datei = Object.keys(urteil).find(f => f.replace(/\.md$/, '').replace(/-$/, '').endsWith(slug) || f.includes(slug));
  return datei ? urteil[datei] : null;
};

const schluessel = (t) => t.nr ? String(t.nr) : t.id;
const altNach = Object.fromEntries((alt?.techniken || []).map(t => [t.schluessel, t]));
let neu = 0;
const techniken = inventar.tipps.map(t => {
  const k = schluessel(t);
  const vorher = altNach[k];
  const basis = {
    schluessel: k,
    tipp_nr: t.nr || null,
    tipp_titel: t.titel,
    tipp_datum: t.datum,
    tipp_url: t.url,
    guertel: FARBEN.indexOf(t.guertel) + 1,
    thema: t.thema,
    seite: false,
    pool: ['OK', 'Klein'].includes(urteilFuer(t.url) || ''),
    quiz: { frage: t.quizfrage.frage.trim(), antworten: t.quizfrage.antworten, richtig_index: t.quizfrage.richtig_index, erklaerungen: [] },
    lernziel: t.lernziel
  };
  if (!vorher) { neu++; return basis; }
  // Hand-Pflege hat Vorrang. Nur Herkunftsfelder des Tipps werden aufgefrischt.
  return { ...basis, ...vorher, tipp_titel: t.titel, tipp_datum: t.datum, tipp_url: t.url };
});
const daten = {
  schema: 1,
  stand: alt?.stand || new Date().toISOString().slice(0, 10),
  guertel: alt?.guertel || [],
  tag_start: alt?.tag_start || '2026-10-19',
  tag_reihenfolge: alt?.tag_reihenfolge || [],
  techniken
};
fs.writeFileSync(ZIEL, JSON.stringify(daten, null, 2) + '\n');
console.log(`data/techniken.json: ${techniken.length} Tipps, ${neu} neu, Pool ${techniken.filter(t => t.pool).length}, Seiten ${techniken.filter(t => t.seite).length}`);
