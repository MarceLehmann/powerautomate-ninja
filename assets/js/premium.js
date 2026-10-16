/* KMUpower Flow-Dojo: Lizenz-Check. Vier Fragen, Urteil sofort. Vorauswahl ueber ?q1=... (Startseite). */
(function () {
  'use strict';
  var d = document, EN = /^en/i.test(d.documentElement.lang || ''), tx = function (de, en) { return EN ? en : de; }, form = d.querySelector('[data-lizenz-check]'), urteil = d.querySelector('[data-urteil]'), liste = d.querySelector('[data-urteil-liste]');
  if (!form || !urteil) return;
  var fragen = Array.prototype.slice.call(form.querySelectorAll('fieldset'));
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  try {
    var p = new URLSearchParams(location.search);
    fragen.forEach(function (f) { var v = p.get(f.id); if (v) { var r = f.querySelector('input[value="' + v.replace(/[^a-z0-9-]/gi, '') + '"]'); if (r) r.checked = true; } });
  } catch (e) {}
  function werte() {
    var gewaehlt = fragen.map(function (f) { return f.querySelector('input:checked'); });
    var offen = gewaehlt.filter(function (x) { return !x; }).length;
    var premium = [], pruefen = [];
    gewaehlt.forEach(function (x) { if (!x) return; var w = x.getAttribute('data-wirkung'), pt = x.getAttribute('data-punkt'); if (w === 'premium') premium.push(pt); if (w === 'pruefen') pruefen.push(pt); });
    var klasse = 'urteil', text, punkte = [];
    if (premium.length) { klasse += ' premium'; text = tx('Du brauchst Power Automate Premium für: ', 'You need Power Automate Premium for: ') + premium.join(', ') + '.'; punkte = pruefen; }
    else if (offen) { klasse += ' pruefen'; text = offen === fragen.length ? tx('Beantworte die vier Fragen, das Urteil erscheint hier.', 'Answer the four questions and the verdict appears here.') : tx('Noch ' + offen + (offen === 1 ? ' Frage' : ' Fragen') + ' offen. Bisher spricht nichts gegen die Lizenz aus Microsoft 365.', offen + (offen === 1 ? ' question' : ' questions') + ' still open. So far nothing speaks against the license from Microsoft 365.'); punkte = pruefen; }
    else if (pruefen.length) { klasse += ' pruefen'; text = tx('Wahrscheinlich reicht die Lizenz aus Microsoft 365. Prüfe noch diesen Punkt:', 'The license from Microsoft 365 is probably enough. Check this point as well:'); punkte = pruefen; }
    else { text = tx('Für deinen Fall reicht die Lizenz aus Microsoft 365.', 'For your case, the license from Microsoft 365 is enough.'); }
    urteil.className = klasse; urteil.textContent = text;
    if (liste) liste.innerHTML = punkte.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }
  form.addEventListener('change', werte);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  werte();
})();
