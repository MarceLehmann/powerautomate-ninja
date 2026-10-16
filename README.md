# KMUpower Flow-Dojo

Statische Website (HTML, CSS, JavaScript): Quizfragen, Erklärungen und ein Gürtelweg für Flows in Power Automate, auf Deutsch. Grundlage sind die Tipps auf powerplatformtip.com, jede Technik verlinkt ihren Tipp. Spätere Adresse: powerautomate.ninja. Testphase: https://marcelehmann.github.io/powerautomate-ninja/ (alle Seiten noindex).

Unabhängige Website von Marcel Lehmann (Handelsname KMUpower), keine Verbindung zu Microsoft.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Startseite in fünf Blöcken: Hero, Lizenz-Check Frage 1, Technik des Tages, Gürtelpfad, Absender |
| `/pruefung/` | Gürtelprüfung (11 Fragen aus dem Pool, Abbruch bei zwei falschen pro Gürtel, Ergebnisbild, LinkedIn, .ics) |
| `/premium/` | Lizenz-Check «Reicht meine Lizenz?», vier Fragen, Quellen nur Microsoft Learn |
| `/techniken/` | alle Techniken mit Filter (Gürtel, Thema, Lizenz, Stand) und Suche |
| `/techniken/<slug>/` | Technik: Quiz, Auflösung, Erklärung, Ausdruck, wann ja/nein, Fehler, Lizenz, Link zum Tipp |
| `/guertel/<farbe>/` | sieben Gürtelseiten, Ziel der geteilten Ergebnisse |
| `/heute/`, `/dojo/` | Technik des Tages, eigener Fortschritt (nur localStorage) |
| `/<tippnr>/` | Kurzadresse, leitet auf die Technik |
| `/ueber/`, `/impressum/`, `/datenschutz/`, `/404.html` | |

## Aufbau

| Datei | Inhalt |
|---|---|
| `site.config.json` | alle Seitenwerte: Basis-URL, Name, Kurs, UTM, Pfade |
| `data/techniken.json` | einzige Inhaltsquelle (108 Tipps, `pool` = Prüfungsfrage, `seite` = eigene Technik-Seite) |
| `data/limits.json` | alle Zahlen zu Limits mit Learn-Quelle, in Texten als `{limit:schluessel}` |
| `templates/partials/`, `templates/css/site.css` | Rahmen und CSS-Quelle |
| `assets/js/` | `site.js` (Theme, Suche, Quiz, Fortschritt, Filter), `pruefung.js`, `premium.js`, `theme-init.js` |
| `scripts/build.mjs` | erzeugt alle Seiten und prüft Texte, Lizenzbelege und Ausdrücke |
| `scripts/import-tipps.mjs` | ergänzt `data/techniken.json` aus dem Tipp-Inventar (`_recherche/`, nicht im Repo) |
| `scripts/links.mjs` | prüft interne Links unter Unterpfad und eigener Domain |
| `scripts/karten.mjs` | rendert die Vorschaubilder als PNG (lokales Chrome) |
| `scripts/engine-sync.mjs` | Abgleich der gemeinsamen Engine-Dateien mit copilot-ninja |
| `scripts/pre-push` | Git-Hook, identisch mit copilot-ninja |

## Befehle

```
node scripts/build.mjs --testphase     Testphase, jede Seite noindex
node scripts/build.mjs --produktion    Livegang
node scripts/karten.mjs                Vorschaubilder als PNG
node scripts/links.mjs [--livegang]    Linkprüfung
node scripts/engine-sync.mjs           Abgleich mit copilot-ninja
```

Node 18 oder neuer, keine Abhängigkeiten. Einrichten auf einem neuen Rechner: `cp scripts/pre-push .git/hooks/pre-push`.

Der Build bricht ab bei: Gedankenstrich, Eszett, Emoji, Testhinweis im Text; Technik ohne Lizenzbeleg bei Microsoft Learn; Ausdruck, der nicht wörtlich im Tipp steht (geprüft gegen den lokalen Klon `../PowerPlatformTip_LIVE/_posts`); Kurztext ausserhalb 80 bis 150 Wörter; Antwort über 12 Wörter; Inline-Skript, style-Attribut, fremde Quelle; «Power Automate» im Seitentitel.

## Domainwechsel

1. `base_url` in `site.config.json` auf `https://powerautomate.ninja/` setzen.
2. `node scripts/build.mjs --produktion`, `node scripts/karten.mjs`, `node scripts/links.mjs --livegang`.
3. 404 unter der neuen Domain testen, Sitemap in Search Console und Bing einreichen.

Pages liefert den ganzen Branch aus, also auch `data/`, `scripts/` und `templates/`. `robots.txt` sperrt sie ab eigener Domain. `_recherche/` liegt nur lokal (`.gitignore`).

Keine Cookies, kein Tracking, keine Anfragen an fremde Server. Schrift selbst ausgeliefert (Barlow Semi Condensed, SIL OFL 1.1, `assets/fonts/LIESMICH.txt`).
