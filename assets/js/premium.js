/* PowerPlatformAcademy Dojo (Power Automate): Lizenz-Check. Vier Fragen, Urteil sofort. Vorauswahl ueber ?q1=... (Startseite). */
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
    if (premium.length) { klasse += ' premium'; text = tx('Wahrscheinlich Premium nötig für: ', 'Premium probably needed for: ') + premium.join(', ') + '.'; punkte = pruefen; }
    else if (offen) { klasse += ' pruefen'; text = offen === fragen.length ? tx('Beantworte die vier Fragen, das Urteil erscheint hier.', 'Answer the four questions and the verdict appears here.') : tx('Noch ' + offen + (offen === 1 ? ' Frage' : ' Fragen') + ' offen. Bisher kein Premium-Merkmal.', offen + (offen === 1 ? ' question' : ' questions') + ' still open. No premium feature so far.'); punkte = pruefen; }
    else if (pruefen.length) { klasse += ' pruefen'; text = tx('Bisher kein Premium-Merkmal. Ob eine Microsoft-365-Lizenz reicht, hängt noch an diesen Punkten:', 'No premium feature so far. Whether a Microsoft 365 license is enough still depends on these points:'); punkte = pruefen; }
    else { text = tx('Kein Premium-Merkmal gewählt. Dafür reicht in der Regel eine Microsoft-365-Lizenz mit Power-Automate-Nutzungsrechten.', 'No premium feature selected. A Microsoft 365 license with Power Automate usage rights is usually enough for this.'); }
    if (premium.length) punkte = [tx('Welche Lizenz hast du schon? Je nach Kontext können Power Automate Premium (Per User), Process (Per Flow), Power Apps Premium oder Nutzungsrechte etwa aus Dynamics 365 passen.', 'Which license do you already have? Depending on context, Power Automate Premium (Per User), Process (Per Flow), Power Apps Premium or usage rights such as those from Dynamics 365 may cover it.')].concat(punkte);
    if (gewaehlt.some(function (x) { return !!x; })) punkte = punkte.concat([tx('Prüfe die Nutzungsrechte in deinem Tenant oder frage deine IT oder deinen Microsoft-Partner.', 'Check usage rights in your tenant or ask your IT team or Microsoft partner.')]);
    urteil.className = klasse; urteil.textContent = text;
    if (liste) liste.innerHTML = punkte.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }
  form.addEventListener('change', werte);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  werte();
})();
