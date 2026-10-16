/* Synchron im head: Theme und Guertel vor dem ersten Rendern (verhindert Spruenge). Gleiche Engine wie copilot-ninja, Schluessel fd-. */
(function(d,w){var h=d.documentElement,ls,g=function(k){try{return ls.getItem(k)}catch(e){return null}};try{ls=w.localStorage}catch(e){}
var t=g("fd-theme");if(t=="light"||t=="dark")h.setAttribute("data-theme",t);
try{var s=JSON.parse(g("fd-dojo-v1")||"null"),n=s&&s.guertel|0;if(n>0&&n<8)h.setAttribute("data-guertel",n)}catch(e){}
h.className+=" js"})(document,window);
