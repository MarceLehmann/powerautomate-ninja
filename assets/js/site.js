/* KMUpower Flow-Dojo: Theme, Menue, Suche, Kopieren, Quiz, Fortschritt, Technik-Wand, Technik des Tages, Mein Dojo.
   Kein Tracking, keine Anfragen an fremde Server. Jeder Zugriff auf localStorage in try/catch, alles laeuft auch ohne. */
(function () {
  'use strict';
  var d = document, h = d.documentElement, R = h.getAttribute('data-r') || '', LR = h.getAttribute('data-lr') || R, EN = /^en/i.test(h.lang || '');
  var SFX = EN ? '-en' : '';
  function tx(de, en) { return EN ? en : de; }
  var SCHLUESSEL = 'fd-dojo-v1', THEME = 'fd-theme';
  var GNAME = EN ? ['White belt', 'Yellow belt', 'Orange belt', 'Green belt', 'Blue belt', 'Brown belt', 'Black belt'] : ['Weisser Gürtel', 'Gelber Gürtel', 'Oranger Gürtel', 'Grüner Gürtel', 'Blauer Gürtel', 'Brauner Gürtel', 'Schwarzer Gürtel'];
  var BUCHST = ['A', 'B', 'C'];
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function heuteIso() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function datumCH(iso) { if (!iso) return ''; if (EN) return iso; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }

  /* Speicher */
  function lade() { try { var s = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null'); if (s && typeof s === 'object') { s.geuebt = s.geuebt || {}; return s; } } catch (e) {} return { v: 1, geuebt: {} }; }
  function speichere(s) { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(s)); return true; } catch (e) { return false; } }
  window.FlowDojo = { lade: lade, speichere: speichere, R: R, LR: LR, EN: EN, SFX: SFX, tx: tx, esc: esc, kopiere: kopiere, heuteIso: heuteIso, datumCH: datumCH };

  /* Sprache: Wahl beim Umschalten merken (fd-lang), keine Cookies. Die deutsche 404 unter /en/ leitet auf die englische. */
  d.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-sprache]'); if (a) { try { localStorage.setItem('fd-lang', a.getAttribute('data-sprache')); } catch (x) {} } });
  if (h.getAttribute('data-seite') === '404' && !EN && location.pathname.indexOf(R + 'en/') === 0) location.replace(R + 'en/404.html');

  /* Theme */
  var tk = $('[data-theme-toggle]');
  function istDunkel() { var t = h.getAttribute('data-theme'); return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function themeStatus() { if (tk) { tk.setAttribute('aria-pressed', istDunkel() ? 'true' : 'false'); tk.setAttribute('aria-label', istDunkel() ? tx('Hellmodus', 'Light mode') : tx('Dunkelmodus', 'Dark mode')); } }
  if (tk) { themeStatus(); tk.addEventListener('click', function () { var neu = istDunkel() ? 'light' : 'dark'; h.setAttribute('data-theme', neu); try { localStorage.setItem(THEME, neu); } catch (e) {} themeStatus(); }); }

  /* Menue */
  var menue = $('#menue'), mk = $('[data-menue-knopf]');
  function menueZu() { if (!menue || menue.hidden) return; menue.hidden = true; if (mk) { mk.setAttribute('aria-expanded', 'false'); mk.focus(); } d.body.style.overflow = ''; }
  if (menue && mk) {
    mk.addEventListener('click', function () { menue.hidden = false; mk.setAttribute('aria-expanded', 'true'); d.body.style.overflow = 'hidden'; var a = $('a', menue); if (a) a.focus(); });
    $$('[data-menue-zu]', menue).forEach(function (b) { b.addEventListener('click', menueZu); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') menueZu(); });
  }

  /* Kopieren */
  var status = $('#kopier-status');
  function kopiere(text, knopf) {
    function ok() { if (status) status.textContent = tx('Kopiert.', 'Copied.'); if (knopf) { var alt = knopf.getAttribute('data-alt') || knopf.textContent; knopf.setAttribute('data-alt', alt); knopf.textContent = tx('Kopiert', 'Copied'); setTimeout(function () { knopf.textContent = alt; }, 1800); } }
    function rueck() { var ta = d.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only'; d.body.appendChild(ta); ta.select(); try { d.execCommand('copy'); ok(); } catch (e) {} d.body.removeChild(ta); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, rueck); else rueck();
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-kopieren],[data-kopieren-text]');
    if (!b) return;
    var text = b.hasAttribute('data-kopieren') ? (($('#' + b.getAttribute('data-kopieren')) || {}).textContent || '') : b.getAttribute('data-kopieren-text');
    kopiere(text, b);
  });

  /* Suche (Strg+K) */
  var dlg = $('#suche'), feld = $('#suche-feld'), liste = $('#suche-liste'), leer = $('.suche__leer'), daten = null, auswahl = -1;
  function ladeSuche(cb) { if (daten) return cb(); fetch(R + 'assets/data/suche' + SFX + '.json').then(function (r) { return r.json(); }).then(function (j) { daten = j.eintraege || []; cb(); }).catch(function () { daten = []; cb(); }); }
  function zeigeTreffer() {
    var q = (feld.value || '').toLowerCase().trim(), teile = q.split(/\s+/).filter(Boolean);
    var treffer = (daten || []).filter(function (t) { var s = (t.titel + ' ' + t.s + ' ' + t.nr).toLowerCase(); return teile.every(function (w) { return s.indexOf(w) > -1; }); }).slice(0, 12);
    liste.innerHTML = treffer.map(function (t, i) { return '<li role="option" id="st-' + i + '"><a href="' + LR + 'techniken/' + t.slug + '/"><span class="band-punkt" data-guertel-nr="' + t.g + '" aria-hidden="true"></span><span>' + esc(t.titel) + ' <span class="klein">' + tx('Tipp', 'Tip') + ' ' + t.nr + '</span></span></a></li>'; }).join('');
    leer.hidden = treffer.length > 0 || !q; auswahl = -1; feld.setAttribute('aria-expanded', treffer.length ? 'true' : 'false');
  }
  function sucheAuf() { if (!dlg || !dlg.showModal) { location.href = LR + 'techniken/'; return; } ladeSuche(function () { zeigeTreffer(); }); if (!dlg.open) dlg.showModal(); feld.value = ''; feld.focus(); }
  if (dlg) {
    $$('[data-suche-auf]').forEach(function (b) { b.addEventListener('click', sucheAuf); });
    $$('[data-suche-zu]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    feld.addEventListener('input', zeigeTreffer);
    feld.addEventListener('keydown', function (e) {
      var links = $$('a', liste); if (!links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); auswahl = (auswahl + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; links.forEach(function (a, i) { a.setAttribute('aria-selected', i === auswahl ? 'true' : 'false'); }); feld.setAttribute('aria-activedescendant', 'st-' + auswahl); }
      if (e.key === 'Enter') { e.preventDefault(); location.href = links[Math.max(auswahl, 0)].href; }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    d.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); sucheAuf(); } });
  }

  /* Quiz auf der Technik-Seite */
  var quiz = $('[data-quiz]');
  function beantworte(i) {
    if (!quiz || quiz.getAttribute('data-beantwortet')) return;
    var richtig = parseInt(quiz.getAttribute('data-richtig'), 10), knoepfe = $$('[data-antwort]', quiz);
    quiz.setAttribute('data-beantwortet', '1');
    knoepfe.forEach(function (b, k) { b.disabled = true; if (k === richtig) b.classList.add('ist-richtig'); if (k === i && k !== richtig) b.classList.add('ist-falsch'); if (k === i) b.setAttribute('aria-pressed', 'true'); });
    var st = $('[data-quiz-status]', quiz);
    if (st) { st.textContent = i === richtig ? tx('Richtig.', 'Correct.') : tx('Nicht ganz. Richtig ist ', 'Not quite. The correct answer is ') + BUCHST[richtig] + '.'; st.className = 'quiz__status ' + (i === richtig ? 'ok' : 'nein'); }
    var a = $('[data-aufloesung]', quiz); if (a) a.classList.add('offen');
  }
  if (quiz) {
    $$('[data-antwort]', quiz).forEach(function (b) { b.addEventListener('click', function () { beantworte(parseInt(b.getAttribute('data-antwort'), 10)); }); });
    var m = /[?&]antwort=([0-2])/.exec(location.search);
    if (m) { beantworte(parseInt(m[1], 10)); }
  }

  /* Als geuebt markieren und Status auf Karten */
  function statusAnzeigen() {
    var s = lade();
    $$('[data-technik]').forEach(function (el) {
      var k = el.getAttribute('data-technik'), g = s.geuebt[k];
      var st = $('[data-status]', el); if (st) { st.hidden = !g; st.textContent = g ? tx('Geübt', 'Practiced') : ''; }
      var tt = $('[data-status-text]', el); if (tt) { tt.textContent = g ? tx('geübt am ', 'practiced on ') + datumCH(g) : tx('offen', 'open'); tt.classList.toggle('geuebt', !!g); }
    });
    $$('[data-geuebt]').forEach(function (b) {
      var g = s.geuebt[b.getAttribute('data-geuebt')];
      b.setAttribute('aria-pressed', g ? 'true' : 'false'); b.textContent = g ? tx('Geübt, Markierung entfernen', 'Practiced, remove mark') : tx('Als geübt markieren', 'Mark as practiced');
    });
  }
  $$('[data-geuebt]').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = lade(), k = b.getAttribute('data-geuebt'), msg = $('[data-geuebt-status]');
      if (s.geuebt[k]) delete s.geuebt[k]; else s.geuebt[k] = heuteIso();
      var ok = speichere(s);
      if (msg) msg.textContent = !ok ? tx('Dein Browser erlaubt kein Speichern. Der Stand bleibt nur bis zum Neuladen.', 'Your browser does not allow saving. Your progress only lasts until you reload.') : s.geuebt[k] ? tx('Gespeichert in deinem Browser. Dein Stand steht unter Mein Dojo.', 'Saved in your browser. Your progress is under My dojo.') : tx('Markierung entfernt.', 'Mark removed.');
      statusAnzeigen();
    });
  });
  statusAnzeigen();

  /* Technik-Wand: Filter und Suche */
  var filter = $('[data-filter]');
  if (filter) {
    var karten = $$('.karte'), zaehler = $('[data-filter-zaehler]'), such = $('[data-wand-suche]');
    var aktiv = { 'guertel-nr': [], thema: [], lizenz: [], stand: [] };
    try { var p = new URLSearchParams(location.search); Object.keys(aktiv).forEach(function (f) { aktiv[f] = p.getAll(f); }); if (p.get('q') && such) such.value = p.get('q'); } catch (e) {}
    function anwenden() {
      var s = lade(), q = (such && such.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean), n = 0;
      karten.forEach(function (k) {
        var geuebt = !!s.geuebt[k.getAttribute('data-technik')];
        var sichtbar = Object.keys(aktiv).every(function (f) {
          if (!aktiv[f].length) return true;
          if (f === 'stand') return aktiv[f].indexOf(geuebt ? 'geuebt' : 'offen') > -1;
          return aktiv[f].indexOf(k.getAttribute('data-' + f)) > -1;
        }) && q.every(function (w) { return (k.getAttribute('data-such') || '').indexOf(w) > -1; });
        k.hidden = !sichtbar; if (sichtbar) n++;
      });
      var gefiltert = q.length || Object.keys(aktiv).some(function (f) { return aktiv[f].length; });
      $$('.guertel-abschnitt').forEach(function (a) { var ks = $$('.karte', a); a.hidden = gefiltert && (!ks.length || ks.every(function (k) { return k.hidden; })); });
      if (zaehler) zaehler.textContent = gefiltert ? n + tx(' von ', ' of ') + karten.length + tx(' Techniken', ' techniques') : karten.length + tx(' Techniken', ' techniques');
      $$('.chip', filter).forEach(function (c) { c.setAttribute('aria-pressed', aktiv[c.getAttribute('data-f')].indexOf(c.getAttribute('data-v')) > -1 ? 'true' : 'false'); });
    }
    $$('.chip', filter).forEach(function (c) {
      c.addEventListener('click', function () { var f = c.getAttribute('data-f'), v = c.getAttribute('data-v'), i = aktiv[f].indexOf(v); if (i > -1) aktiv[f].splice(i, 1); else aktiv[f].push(v); anwenden(); });
    });
    if (such) such.addEventListener('input', anwenden);
    anwenden();
  }

  /* Technik des Tages: nach lokalem Datum, fuer alle am selben Tag dieselbe */
  var karteTag = $('[data-heute-karte]');
  if (karteTag) {
    var nurStart = !$('[data-heute-alle]');
    fetch(R + 'assets/data/tag' + SFX + '.json').then(function (r) { return r.json(); }).then(function (j) {
      var folge = (j.eintraege || []).filter(function (t) { return !nurStart || t.start; });
      if (!folge.length) return;
      var tage = Math.round((Date.parse(heuteIso() + 'T00:00:00Z') - Date.parse(j.start + 'T00:00:00Z')) / 864e5);
      var t = folge[((tage % folge.length) + folge.length) % folge.length];
      karteTag.setAttribute('data-guertel-nr', t.g);
      var tag = $('.guertel-tag', karteTag); if (tag) { tag.setAttribute('data-guertel-nr', t.g); tag.innerHTML = '<span class="band-punkt" data-guertel-nr="' + t.g + '" aria-hidden="true"></span>' + GNAME[t.g - 1]; }
      var bd = $('[data-heute-badge]', karteTag); if (bd) bd.innerHTML = '<span class="badge badge--' + t.lizenz + '">' + (t.lizenz === 'premium' ? 'Premium' : 'Standard') + '</span>';
      var fr = $('[data-heute-frage]', karteTag); if (fr) fr.textContent = t.frage;
      var an = $('[data-heute-antworten]', karteTag); if (an) an.innerHTML = t.antworten.map(function (a, i) { return '<li><a class="antwort" href="' + LR + 'techniken/' + t.slug + '/?antwort=' + i + '#quiz"><span class="antwort__b" aria-hidden="true">' + BUCHST[i] + '</span><span>' + esc(a) + '</span></a></li>'; }).join('');
      var ln = $('[data-heute-link]', karteTag); if (ln) { ln.href = LR + 'techniken/' + t.slug + '/'; ln.textContent = t.titel; }
    }).catch(function () {});
  }

  /* Mein Dojo */
  var stand = $('[data-dojo-stand]');
  if (stand) {
    var s = lade(), n = Object.keys(s.geuebt).length, gesamt = $$('[data-status-text]').length;
    var teile = [];
    if (s.guertel) teile.push(tx('Dein Gürtel aus der Prüfung: ', 'Your belt from the exam: ') + GNAME[s.guertel - 1] + (s.pruefung_datum ? ' (' + datumCH(s.pruefung_datum) + ')' : '') + '.');
    else teile.push(tx('Du hast die Gürtelprüfung noch nicht gemacht.', 'You have not taken the belt exam yet.'));
    teile.push(tx('Geübt: ', 'Practiced: ') + n + tx(' von ', ' of ') + gesamt + tx(' Techniken. Alles bleibt in deinem Browser.', ' techniques. Everything stays in your browser.'));
    stand.textContent = teile.join(' ');
    var lo = $('[data-dojo-loeschen]');
    if (lo) lo.addEventListener('click', function () {
      try { localStorage.removeItem(SCHLUESSEL); localStorage.removeItem(THEME); localStorage.removeItem('fd-lang'); } catch (e) {}
      h.removeAttribute('data-guertel'); h.removeAttribute('data-theme'); themeStatus();
      var mm = $('[data-dojo-meldung]'); if (mm) mm.textContent = tx('Gelöscht. Dein Browser speichert für diese Seite nichts mehr.', 'Deleted. Your browser no longer stores anything for this website.');
      stand.textContent = tx('Du hast die Gürtelprüfung noch nicht gemacht. Geübt: 0 von ', 'You have not taken the belt exam yet. Practiced: 0 of ') + gesamt + tx(' Techniken.', ' techniques.');
      statusAnzeigen();
    });
  }
})();
