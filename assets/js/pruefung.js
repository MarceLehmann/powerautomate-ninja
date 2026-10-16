/* KMUpower Flow-Dojo: Guertelpruefung. Zwei Fragen je Guertel von Weiss bis Blau, eine fuer Braun.
   Bestanden ist ein Guertel, wenn alle seine Fragen richtig sind. Zwei falsche im selben Guertel beenden die Pruefung.
   Ergebnis ist der hoechste Guertel, bis zu dem alle Guertel bestanden sind. Das Ergebnisbild entsteht lokal im Browser. */
(function () {
  'use strict';
  var F = window.FlowDojo, d = document, R = F ? F.R : (d.documentElement.getAttribute('data-r') || '');
  var box = d.querySelector('[data-pruefung]'), start = d.querySelector('[data-pruefung-start]');
  if (!box || !start || !F) return;
  var esc = F.esc, BUCHST = ['A', 'B', 'C'], daten = null, fragen = [], idx = 0, log = [], falsch = {}, bildUrl = null;
  var KNOTEN = ['M2 11h28v7H2z', 'M12.5 17.5L8 29h5.2l3-6.4M19.5 17.5L24 29h-5.2l-3-6.4'];

  function mische(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function link(u) { return /^https?:/.test(u) ? u : R + u; }
  function knotenSvg(n) { return '<svg viewBox="0 0 32 32" data-guertel-nr="' + n + '" aria-hidden="true" focusable="false"><path class="band" d="' + KNOTEN[0] + '"/><path class="band" d="' + KNOTEN[1] + '"/><rect class="knoten-k" x="11.5" y="8.5" width="9" height="12" rx="2.2"/></svg>'; }

  start.addEventListener('click', function () {
    start.disabled = true;
    fetch(R + 'assets/data/pool.json').then(function (r) { return r.json(); }).then(function (j) { daten = j; neu(); }).catch(function () {
      box.innerHTML = '<p class="leer-hinweis">Die Fragen liessen sich nicht laden. Lade die Seite neu oder versuche es später.</p>';
    });
  });

  function neu() {
    fragen = []; idx = 0; log = []; falsch = {};
    for (var g = 1; g <= 6; g++) {
      var n = g === 6 ? 1 : 2;
      mische(daten.fragen.filter(function (f) { return f.g === g; })).slice(0, n).forEach(function (f) {
        var reihe = mische([0, 1, 2]);
        fragen.push({ f: f, reihe: reihe });
      });
    }
    zeige();
  }

  function balken() {
    return '<div class="fortschritt" aria-hidden="true">' + fragen.map(function (_, i) {
      var c = i < log.length ? (log[i].ok ? 'ok' : 'nein') : i === idx ? 'jetzt' : '';
      return '<span class="' + c + '"></span>';
    }).join('') + '</div>';
  }

  function zeige() {
    var q = fragen[idx], g = daten.guertel[q.f.g - 1];
    box.innerHTML = '<div class="pruef__kopf"><span>Frage ' + (idx + 1) + ' von ' + fragen.length + '</span><span class="guertel-tag" data-guertel-nr="' + g.nr + '"><span class="band-punkt" data-guertel-nr="' + g.nr + '" aria-hidden="true"></span>' + esc(g.name) + '</span></div>' + balken() +
      '<section class="quiz" data-guertel-nr="' + g.nr + '" aria-labelledby="pf-frage"><h2 class="quiz__frage" id="pf-frage" tabindex="-1">' + esc(q.f.frage) + '</h2>' +
      '<ul class="antworten">' + q.reihe.map(function (orig, pos) { return '<li><button type="button" class="antwort" data-orig="' + orig + '"><span class="antwort__b" aria-hidden="true">' + BUCHST[pos] + '</span><span>' + esc(q.f.antworten[orig]) + '</span></button></li>'; }).join('') + '</ul>' +
      '<div data-feedback role="status" aria-live="polite"></div></section>';
    var fbx = box.querySelector('.fortschritt'); if (fbx) fbx.style.setProperty('--n', fragen.length);
    var h2 = box.querySelector('#pf-frage'); if (h2 && idx > 0) h2.focus();
    Array.prototype.forEach.call(box.querySelectorAll('[data-orig]'), function (b) { b.addEventListener('click', function () { antwort(parseInt(b.getAttribute('data-orig'), 10)); }); });
  }

  function antwort(orig) {
    var q = fragen[idx], ok = orig === q.f.richtig;
    log.push({ g: q.f.g, ok: ok });
    if (!ok) falsch[q.f.g] = (falsch[q.f.g] || 0) + 1;
    Array.prototype.forEach.call(box.querySelectorAll('[data-orig]'), function (b) {
      var o = parseInt(b.getAttribute('data-orig'), 10); b.disabled = true;
      if (o === q.f.richtig) b.classList.add('ist-richtig'); if (o === orig && !ok) b.classList.add('ist-falsch');
    });
    var abbruch = falsch[q.f.g] >= 2, ende = abbruch || idx === fragen.length - 1;
    var fb = box.querySelector('[data-feedback]');
    fb.innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'nein') + '"><p><strong>' + (ok ? 'Richtig.' : 'Nicht ganz. Richtig ist: ' + esc(q.f.antworten[q.f.richtig]) + '.') + '</strong></p>' +
      (q.f.erkl ? '<p>' + esc(q.f.erkl.replace(/^Richtig\.\s*/, '')) + '</p>' : '') +
      '<p><a href="' + esc(link(q.f.url)) + '"' + (q.f.seite ? '' : ' rel="noopener"') + '>' + (q.f.seite ? 'Zur Technik: ' : 'Zum Tipp: ') + esc(q.f.titel) + '</a></p></div>' +
      (abbruch ? '<p class="klein">Zwei falsche Antworten im ' + esc(daten.guertel[q.f.g - 1].name) + '. Die Prüfung endet hier.</p>' : '') +
      '<p class="knopf-reihe"><button type="button" class="knopf knopf--primaer" data-weiter>' + (ende ? 'Zum Ergebnis' : 'Nächste Frage') + '</button></p>';
    var w = fb.querySelector('[data-weiter]');
    w.addEventListener('click', function () { if (ende) ergebnis(abbruch); else { idx++; zeige(); } });
    w.focus();
  }

  function ergebnis(abbruch) {
    var res = 0, uebersicht = [];
    for (var g = 1; g <= 6; g++) {
      var dieser = log.filter(function (l) { return l.g === g; }), soll = fragen.filter(function (q) { return q.f.g === g; }).length;
      var bestanden = soll > 0 && dieser.length === soll && dieser.every(function (l) { return l.ok; });
      if (bestanden && res === g - 1) res = g;
      uebersicht.push({ g: g, text: !dieser.length ? 'nicht geprüft' : bestanden ? 'bestanden' : (dieser.filter(function (l) { return l.ok; }).length + ' von ' + soll + ' richtig') });
    }
    var s = F.lade(); s.guertel = res; s.pruefung_datum = F.heuteIso(); F.speichere(s);
    if (res) d.documentElement.setAttribute('data-guertel', res); else d.documentElement.removeAttribute('data-guertel');
    var g0 = res ? daten.guertel[res - 1] : null, naechster = daten.guertel[res] || null;
    var kurs = res <= 3 ? daten.kurs.einstieg : daten.kurs.fortgeschritten;
    var text = res ? 'Ich habe in der Flow-Gürtelprüfung des KMUpower Flow-Dojo ' + g0.akk + ' geschafft. ' + (naechster && res < 6 ? 'Schaffst du ' + naechster.akk + '?' : 'Schaffst du das auch?') + '\n\n' + daten.base + 'guertel/' + g0.farbe + '/' : '';
    var naechste = naechster && res < 6 ? daten.guertel[res].naechste : [];
    box.innerHTML = '<section class="ergebnis" aria-labelledby="erg-titel">' + balken() +
      '<div class="ergebnis__abzeichen">' + knotenSvg(res || 1) + '<div><span class="label">Dein Ergebnis' + (abbruch ? ', Prüfung beendet' : '') + '</span><h2 id="erg-titel" tabindex="-1">' + (res ? esc(g0.name) : 'Noch kein Gürtel') + '</h2></div></div>' +
      '<p class="lead">' + (res ? 'Das kannst du: ' + esc(g0.kann) : 'Starte mit dem weissen Gürtel: Flows testen, Ein- und Ausgaben lesen, Datumswerte formatieren.') + '</p>' +
      '<ul class="uebersicht">' + uebersicht.map(function (u) { return '<li><span class="band-punkt" data-guertel-nr="' + u.g + '" aria-hidden="true"></span>' + esc(daten.guertel[u.g - 1].name) + ': ' + u.text + '</li>'; }).join('') + '</ul>' +
      (naechste.length ? '<h3>Als Nächstes lernst du</h3><ul class="arrow-list">' + naechste.map(function (t) { return '<li><a href="' + R + t.url + '">' + esc(t.titel) + '</a></li>'; }).join('') + '</ul>' : (res < 6 ? '<p><a href="' + R + 'guertel/' + (naechster ? naechster.farbe : 'weiss') + '/">Zum ' + esc(naechster ? naechster.name : 'Weissen Gürtel') + '</a></p>' : '')) +
      (res ? '<h3>Teilen</h3><img class="vorschau-bild" data-bild alt="Ergebnisbild: ' + esc(g0.name) + ' im KMUpower Flow-Dojo" width="1200" height="627">' +
        '<div class="knopf-reihe"><a class="knopf knopf--klein" data-bild-download download="flow-dojo-' + g0.farbe + '.png" href="#">Bild herunterladen</a>' +
        '<a class="knopf knopf--klein" href="https://www.linkedin.com/feed/?shareActive=true&amp;text=' + encodeURIComponent(text) + '" rel="noopener">Auf LinkedIn teilen</a>' +
        '<button type="button" class="knopf knopf--klein" data-text-kopieren>Text kopieren</button></div>' : '') +
      '<div class="knopf-reihe"><a class="knopf" href="' + R + 'kalender/montag.ics" download>Jeden Montag eine Frage im Kalender</a><button type="button" class="knopf knopf--leise" data-nochmal>Prüfung neu starten</button></div>' +
      '<p class="kurs-zeile">' + (res <= 3 ? 'Grundlagen mit Begleitung lernen: ' : 'Weiter mit Error Handling und Scopes, live begleitet: ') + '<a href="' + esc(kurs) + '" rel="noopener">' + esc(daten.kurs.name) + ' der Power Platform Academy</a></p>' +
      '</section>';
    var fbx = box.querySelector('.fortschritt'); if (fbx) fbx.style.setProperty('--n', fragen.length);
    var t2 = box.querySelector('#erg-titel'); if (t2) t2.focus();
    box.querySelector('[data-nochmal]').addEventListener('click', neu);
    var kp = box.querySelector('[data-text-kopieren]'); if (kp) kp.addEventListener('click', function () { F.kopiere(text, kp); });
    if (res) zeichne(g0);
  }

  function umbrechen(ctx, text, x, y, breite, zeile) {
    var w = text.split(' '), z = '';
    for (var i = 0; i < w.length; i++) { var t = z ? z + ' ' + w[i] : w[i]; if (ctx.measureText(t).width > breite && z) { ctx.fillText(z, x, y); y += zeile; z = w[i]; } else z = t; }
    if (z) ctx.fillText(z, x, y);
  }
  function zeichne(g) {
    var c = d.createElement('canvas'); c.width = 1200; c.height = 627;
    var ctx = c.getContext('2d'); if (!ctx) return;
    var malen = function () {
      ctx.fillStyle = '#F4EFE6'; ctx.fillRect(0, 0, 1200, 627);
      daten.guertel.forEach(function (b, i) { ctx.fillStyle = b.hex; ctx.fillRect(i * 1200 / 7, 601, 1200 / 7 + 1, 26); });
      ctx.fillStyle = '#8A7F6C'; ctx.fillRect(0, 600, 1200, 1.5);
      ctx.fillStyle = '#4E525B'; ctx.font = '600 30px "Dojo Display", Bahnschrift, "Arial Narrow", sans-serif'; ctx.fillText('KMUPOWER FLOW-DOJO  ·  GÜRTELPRÜFUNG', 80, 110);
      ctx.fillStyle = '#15171B'; ctx.font = '700 104px "Dojo Display", Bahnschrift, "Arial Narrow", sans-serif'; ctx.fillText(g.name.split(' ')[0], 76, 250); ctx.fillText('Gürtel', 76, 360);
      ctx.strokeStyle = '#B4301A'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(80, 386); ctx.quadraticCurveTo(250, 374, 420, 382); ctx.stroke();
      ctx.fillStyle = '#4E525B'; ctx.font = '30px "Segoe UI", system-ui, sans-serif'; umbrechen(ctx, g.kann, 80, 450, 700, 40);
      ctx.fillStyle = '#15171B'; ctx.font = '600 28px "Segoe UI", system-ui, sans-serif'; ctx.fillText(daten.kurz + '/pruefung', 80, 560);
      ctx.save(); ctx.translate(860, 140); ctx.scale(9, 9); ctx.fillStyle = g.hex; ctx.strokeStyle = '#15171B'; ctx.lineWidth = .5;
      KNOTEN.forEach(function (p) { var pf = new Path2D(p); ctx.fill(pf); ctx.stroke(pf); });
      ctx.fillStyle = '#15171B'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(11.5, 8.5, 9, 12, 2.2); else ctx.rect(11.5, 8.5, 9, 12); ctx.fill(); ctx.restore();
      c.toBlob(function (blob) {
        if (!blob) return;
        if (bildUrl) URL.revokeObjectURL(bildUrl);
        bildUrl = URL.createObjectURL(blob);
        var img = box.querySelector('[data-bild]'), a = box.querySelector('[data-bild-download]');
        if (img) img.src = bildUrl; if (a) a.href = bildUrl;
      }, 'image/png');
    };
    if (d.fonts && d.fonts.load) d.fonts.load('700 104px "Dojo Display"').then(malen, malen); else malen();
  }
})();
