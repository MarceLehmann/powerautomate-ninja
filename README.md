# PowerPlatformAcademy Dojo · Power Automate

Name seit 16.10.2026 (vorher «KMUpower Flow-Dojo»). Gehört zur Power Platform Academy, Schwesterseite für Copilot: copilot.ninja.

Statische Website (HTML, CSS, JavaScript): Quizfragen, Erklärungen und ein Gürtelweg für Flows in Power Automate, auf Deutsch (/) und Englisch (/en/). Grundlage sind die Tipps auf powerplatformtip.com, jede Technik verlinkt ihren Tipp. Live seit 16.10.2026 unter https://powerautomate.ninja/ (GitHub Pages, Custom Domain, HTTPS erzwungen). Alle Inhalte von Marcel freigegeben, jede Seite indexierbar (ausser 404, Kurzadressen, /heute/ und /dojo/ in beiden Sprachen).

Unabhängige Website von Marcel Lehmann (Handelsname KMUpower), keine Verbindung zu Microsoft.

## Tusch und Farbton (seit 16.10.2026)

- Figur «Tusch» aus copilot.ninja: `templates/partials/tusch.svg` (in `engine-sync.mjs` unter GLEICH, nur in copilot-ninja ändern). Im Build `tusch(pose)`, Posen `ruhe`, `zeigen`, `spaehen`. Einsatz: Marke in Kopf und Menü, Hero der Startseite, Absender-Block (mit Querverweis auf copilot.ninja), /pruefung/ und /dojo/ (trägt den eigenen Gürtel über `--belt-current`), /guertel/<farbe>/ (trägt diesen Gürtel über `data-guertel-nr`), 404 (spähend), Favicon (Kopf). Der Gurtknoten bleibt für Ergebnis- und Gürtelbilder.
- Eigener Farbton Power-Automate-Blau, Kontraste nach WCAG AA geprüft: hell Papier `#EDF2F9`, Akzent `--site: #0F5BB5`; dunkel Papier `#0B1019`, Akzent `#82B4F2`. Akzent nur für die Kopflinie und die Unterzeile der Marke. Signal (Rot), ok und premium wie copilot.ninja.
- Menü: letzter Punkt «Dojo für Copilot» bzw. «Dojo for Copilot», Menüknopf auf allen Breiten sichtbar.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Startseite in fünf Blöcken: Hero, Lizenz-Check Frage 1, Technik des Tages, Gürtelpfad, Absender |
| `/pruefung/` | Gürtelprüfung (12 Fragen, zwei je Gürtel Weiss bis Braun, zufällig aus dem Pool aller geprüften Tipps, Abbruch bei zwei falschen pro Gürtel, Ergebnisbild, LinkedIn, .ics) |
| `/premium/` | Lizenz-Check «Reicht meine Lizenz?», vier Fragen, Quellen nur Microsoft Learn |
| `/techniken/` | alle Techniken mit Filter (Gürtel, Thema, Lizenz, Stand) und Suche |
| `/techniken/<slug>/` | Technik: Quiz, Auflösung, Erklärung, Ausdruck, wann ja/nein, Fehler, Lizenz, Link zum Tipp |
| `/guertel/<farbe>/` | sieben Gürtelseiten, Ziel der geteilten Ergebnisse |
| `/heute/`, `/dojo/` | Technik des Tages, eigener Fortschritt (nur localStorage) |
| `/<tippnr>/` | Kurzadresse, leitet auf die Technik |
| `/en/...` | englische Fassung aller Seiten, gleiche Pfade. Umschalter DE/EN im Kopf, hreflang, Erstbesuch der deutschen Startseite ohne Deutsch in navigator.languages leitet einmalig auf /en/ (Wahl in localStorage fd-lang, nicht für Crawler) |
| `/ueber/`, `/impressum/`, `/datenschutz/`, `/404.html` | |

## Aufbau

| Datei | Inhalt |
|---|---|
| `site.config.json` | alle Seitenwerte: Basis-URL, Name, Kurs, UTM, Pfade |
| `data/techniken.json` | einzige Inhaltsquelle (108 Tipps, `pool` = Prüfungsfrage, `seite` = eigene Technik-Seite, `pool_ausschluss` = Grund, warum eine Frage nicht in die Prüfung kommt) |
| `data/en.json` | englische Texte je Technik (Schlüssel wie techniken.json) und Gürtel. Limits auf Englisch: `text_en` in limits.json |
| `data/limits.json` | alle Zahlen zu Limits mit Learn-Quelle, in Texten als `{limit:schluessel}` |
| `templates/datenschutz*.html` | Datenschutztexte in DE und EN |
| `templates/partials/`, `templates/css/site.css` | Rahmen und CSS-Quelle, englischer Rahmen in `*.en.html` |
| `assets/js/` | `site.js` (Theme, Suche, Quiz, Fortschritt, Filter), `pruefung.js`, `premium.js`, `theme-init.js` |
| `scripts/build.mjs` | erzeugt alle Seiten und prüft Texte, Lizenzbelege und Ausdrücke |
| `scripts/import-tipps.mjs` | ergänzt `data/techniken.json` aus dem Tipp-Inventar (`_recherche/`, nicht im Repo) |
| `scripts/links.mjs` | prüft interne Links unter Unterpfad und eigener Domain |
| `scripts/karten.mjs` | rendert die Vorschaubilder als PNG (lokales Chrome) |
| `scripts/engine-sync.mjs` | Abgleich der gemeinsamen Engine-Dateien mit copilot-ninja |
| `scripts/pre-push` | Git-Hook, identisch mit copilot-ninja |

## Kurszeile und Kursstatus (UX-Review 17.10.2026, Paket 1)

Eine Kurszeile zur Academy in der gemeinsamen Dojo-Vorlage, gleicher Satzbau wie copilot.ninja: auf jeder Technik-Seite unter «Nächste Technik» (alle Gürtel) und im Ergebnis der Gürtelprüfung. Quelle ist `kursZeile()` in `scripts/build.mjs`, die Prüfung liest Name, Status und Satz aus `assets/data/pool.json`.

`kurs_status` in `site.config.json` folgt der Kursseite der Academy: `warteliste` (Stand 17.10.2026: «Auf die Warteliste», «Neue Termine folgen in Kürze») oder `termine`, sobald Termine buchbar sind. Das Prüfungsergebnis verspricht nichts, was der Kurs gerade nicht anbietet. In copilot-ninja heisst der Wert `KURS_STATUS` in `scripts/build.mjs`. Beide gleich halten.

Klickziele mindestens 24 px (WCAG 2.5.8): Regeln unter `.krumen a` in `templates/css/site.css`.

## Befehle

```
node scripts/build.mjs --testphase     Testphase, jede Seite noindex
node scripts/build.mjs --produktion    Livegang
node scripts/karten.mjs                Vorschaubilder als PNG
node scripts/links.mjs [--livegang]    Linkprüfung
node scripts/engine-sync.mjs           Abgleich mit copilot-ninja
```

Node 18 oder neuer, keine Abhängigkeiten. Einrichten auf einem neuen Rechner: `cp scripts/pre-push .git/hooks/pre-push`.

Der Build bricht ab bei: Gedankenstrich, Eszett, Emoji, Testhinweis im Text; Technik ohne Lizenzbeleg bei Microsoft Learn; Ausdruck, der nicht wörtlich im Tipp steht (geprüft gegen den lokalen Klon `../PowerPlatformTip_LIVE/_posts`); Kurztext ausserhalb 80 bis 150 Wörter; Antwort über 12 Wörter; Inline-Skript, style-Attribut, fremde Quelle; «Power Automate» im Seitentitel (Titelzusatz: `| Flow Dojo`).

## Livegang und Suchmaschinen

1. `base_url` und `domain` in `site.config.json` (eine Quelle, Build schreibt CNAME, Canonicals, Sitemap, robots.txt).
2. `node scripts/build.mjs --produktion`, `node scripts/karten.mjs`, `node scripts/links.mjs --livegang` (läuft auch als pre-push-Hook).
3. robots.txt wie powerplatformtip.com: Content-Signal search/ai-train/ai-retrieval = yes, eigene Gruppe je Such- und KI-Crawler. llms.txt mit beiden Sprachen.
4. IndexNow: Key `indexnow_key` in site.config.json, Key-Datei `<key>.txt` im Stamm, `scripts/indexnow.mjs` meldet alle Sitemap-URLs. Läuft nach jedem Pages-Build über `.github/workflows/indexnow.yml`.
5. Strukturierte Daten: WebSite, Organization, BreadcrumbList, LearningResource mit Quiz (Question, acceptedAnswer, suggestedAnswer) auf jeder Technik-Seite.

Pages liefert den ganzen Branch aus, also auch `data/`, `scripts/` und `templates/`. `robots.txt` sperrt sie ab eigener Domain. `_recherche/` liegt nur lokal (`.gitignore`).

Keine Cookies, kein Tracking. Einzige Anfrage an einen fremden Server ist die Zugriffszählung ohne Cookies mit GoatCounter, gespeichert werden nur Summen ohne Personenbezug: `assets/js/count.js` selbst gehostet, Endpunkt https://powerautomate-ninja.goatcounter.com/count, in der CSP (`templates/partials/head.html`) unter connect-src und img-src freigegeben. Schrift selbst ausgeliefert (Barlow Semi Condensed, SIL OFL 1.1, `assets/fonts/LIESMICH.txt`).
