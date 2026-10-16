/* Synchron im head: Theme und Guertel vor dem ersten Rendern (verhindert Spruenge). Gleiche Engine wie copilot-ninja, Schluessel fd-.
   Sprachwahl: Erstbesuch der deutschen Startseite ohne Deutsch in navigator.languages und ohne gespeicherte Wahl (fd-lang)
   leitet einmalig auf /en/ um. Nur Startseite, nicht fuer Crawler, nur wenn die Wahl gespeichert werden kann. */
(function(d,w){var h=d.documentElement,ls,g=function(k){try{return ls.getItem(k)}catch(e){return null}};try{ls=w.localStorage}catch(e){}
var t=g("fd-theme");if(t=="light"||t=="dark")h.setAttribute("data-theme",t);
try{var s=JSON.parse(g("fd-dojo-v1")||"null"),n=s&&s.guertel|0;if(n>0&&n<8)h.setAttribute("data-guertel",n)}catch(e){}
try{var nv=w.navigator||{};if(h.getAttribute("data-seite")=="start"&&!/^en/i.test(h.lang)&&!g("fd-lang")&&!/bot|crawl|spider|slurp|mediapartners|lighthouse|preview/i.test(nv.userAgent||"")){
var sp=nv.languages&&nv.languages.length?nv.languages:[nv.language||""],de=false;for(var i=0;i<sp.length;i++)if(/^de(-|$)/i.test(sp[i]))de=true;
if(!de&&sp[0]){ls.setItem("fd-lang","en");if(g("fd-lang")=="en")w.location.replace((h.getAttribute("data-lr")||"")+"en/"+w.location.search+w.location.hash)}}}catch(e){}
h.className+=" js"})(document,window);
