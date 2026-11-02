# Review: PowerPlatformAcademy Dojo · Power Automate (powerautomate.ninja)

Date: 2026-11-02 · Reviewer: Claude (cloud session, on behalf of the task coordinator) · Branch: `review/dojo-2026-11` · Commit reviewed: `1310dc4` (main)

## Scope and method

- **Content:** all 108 entries in `data/techniken.json` (106 exam-pool questions, 24 technique pages), `data/limits.json`, the English overlay `data/en.json`, the licence check (`premium/`, `assets/js/premium.js`), `ueber/`, and the belt texts. Every claim was compared with the current Microsoft Learn source text (MicrosoftDocs GitHub repositories `power-automate-docs`, `powerapps-docs`, `power-platform`, `ai-builder`, `office-scripts-docs`, all at `main` on 2026-11-02) and with the tip the technique is built on (`PowerPlatformTip_LIVE/_posts`, commit `00d4b7f`).
- **Exam questions:** for every pool question: is the marked answer right, is no distractor also right, is the question unambiguous and answerable from the technique text, does the explanation match the docs and the tip.
- **Language:** Swiss spelling (ss, real umlauts), Du-form, no em/en dashes, no filler patterns, DE/EN parity.
- **Technical:** dead links, mobile view (Playwright/Chromium at 360 px and 390 px), sitemap, hreflang, canonical, robots, llms.txt, a fresh production build.
- **Not possible in this session:** live HTTP access to learn.microsoft.com, powerautomate.ninja or the connector reference (learn.microsoft.com/connectors). Connector tiers (Standard/Premium) were checked against the Learn licensing FAQ and the tip files, not the connector pages. Claims that could not be settled are listed per section under "not verifiable" and are not findings.
- **Rules followed:** no content changed on this branch except clear typos (separate commit, listed at the end). Everything else is a suggestion.
- **Severity:** high = wrong or misleading · medium = outdated or inconsistent with the tip · low = detail or wording.

## Summary

| Severity | Count |
| --- | --- |
| high | 2 |
| medium | 6 |
| low | 14 |
| **total** | **22** |

Content: 2 high, 5 medium, 13 low (one fixed on this branch as a typo). Technical/language: 0 high, 1 medium (the production build currently fails), 1 low. Sitemap, hreflang, canonical, robots, llms.txt, internal links and mobile view are all in order. Note: the medium finding on tip 146 appears in A2 and B because it is both a content and a build problem; the "Process (Per Flow)" label appears in A3 and B for the same reason, each counted once.

**Most important:**
1. **Technique 39 (high)** – quiz explanation and learning goal promise "Gruppierungen und Summen" with the Fetch Xml Query parameter of List rows; Learn says aggregation queries are not supported there (only distinct).
2. **Fill-and-sign (high)** – the quiz explanation describes unzipping a .docx, editing word/document.xml and zipping it again; the tip says there is no standard action that re-zips and uses the Word XML Document format instead.
3. **Build broken (medium)** – `node scripts/build.mjs --produktion` stops because the `ausdruck` of 146 (`replace(varTitle,…)`) is no longer verbatim in the tip (`replace(variables('varTitle'),…)`) and is not a valid expression as written.
4. **Exam questions 27, 118, 169 (medium)** – they teach the classic-designer Overwrite trick without scope, an outdated paste-outside-then-drag workaround, and "For a selected item runs only from the Default environment" (it is the Automate menu that lists only Default-environment flows).
5. **Licence check "Process (Per Flow)" (medium)** – the per-flow plan left the price list on 1 February 2024; the Process licence is assigned per flow or flow group.

**Exam:** of 106 pool questions, 101 have a correct and unambiguous marked answer in DE and EN; 27, 118 and 169 need rewording (the marked answer stays the best one), 39 and fill-and-sign need a corrected explanation, 135 needs a qualifier.

---

## A. Content findings (facts, exam questions, DE/EN)

### A1. Belts 1–2 (37 entries)

37 techniques, 37 quizzes, 37 EN overlays, 4 limits and 11 licence statements checked; 31 entries clean.

- **[medium] Tip 27 quiz teaches the classic-designer trick as if it still applied**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="27"].quiz (frage "Wie machst du den Overwrite-Schalter bei «Create file» sichtbar?", erklaerungen[0] "Solange Chunking aktiv ist, blendet «Create file» den Overwrite-Schalter aus. Ohne Chunking erscheint er ..."); same in data/en.json["27"].quiz
  - Problem: The tip was re-tested on 31 October 2026: in the new designer no Overwrite toggle appears after switching Allow chunking off, and Create file replaces an existing file anyway; the toggle trick only exists in the classic designer. The quiz presents the trick without that scope, so a reader in the new designer learns a step that does nothing.
  - Evidence: /home/user/powerplatformtip_live/_posts/2023-02-09-powerplatformtip-27-overwrite-existing-files-.md: "The 2023 trick (turn off 'Allow Chunking' to unlock the Overwrite toggle) only applies to the classic designer. In the new designer no Overwrite toggle appears, and SharePoint Create file replaces an existing file on its own." and "Update 31 October 2026: ... After setting Allow chunking to Off on SharePoint Create file, no Overwrite switch appears."
  - Verdict: CONFIRMED (tip file; Learn connector reference not local)
  - Suggested correction: Scope the question to the classic designer ("Wie machst du im klassischen Designer den Overwrite-Schalter ... sichtbar?") and add to the explanation that the new designer has no toggle and Create file overwrites by itself (Copy file has an explicit Overwrite Flag).

- **[medium] Tip 118 quiz answer describes an outdated workaround**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="118"].quiz.antworten[1] "Ausserhalb einfügen, hineinziehen, Verweise neu setzen" and erklaerungen[1] "Du fügst sie weiter oben ein, ziehst sie in den Zweig und setzt die dynamischen Inhalte neu."; same in data/en.json["118"]
  - Problem: The current tip (updated 2026-10-17) says to paste the action directly into the target case (right-click the + inside the branch → Paste an action) and then fix references to sibling branches; the "paste outside, drag in" detour is no longer part of the tip and is not what Learn describes either. The essential part (re-point references) is still right, so the answer is defensible but teaches an unnecessary step.
  - Evidence: /home/user/powerplatformtip_live/_posts/2024-07-23-powerplatformtip-118-copy-actions-in-switch_condition-.md: "Right-click the + inside the target case or branch → Paste an action ... If it references an action from another case or branch, re-point that reference before you save"; https://learn.microsoft.com/power-automate/flows-designer (flows-designer.md): "On the canvas, right-click on +, and then select Paste an action. You can copy and paste actions across different parts of your flow, or in between flows."
  - Verdict: CONFIRMED
  - Suggested correction: Change the answer to "In den Zweig einfügen und Verweise auf Aktionen anderer Zweige neu setzen" and the explanation to "Du fügst die Aktion direkt im Ziel-Case ein und ersetzt dynamische Inhalte, die auf einen anderen Zweig zeigen" (EN accordingly).

- **[low] Tip 36 text: wrong menu path for Static result in the classic designer**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="36"].kurztext_de "Im klassischen Designer öffnest du das Menü "Settings" der Aktion und dort "Static result"."; data/en.json["36"].kurztext "In the classic designer, open the action's "Settings" menu, then "Static result"."
  - Problem: In the classic designer Static result is its own entry in the action's ellipsis menu, not inside Settings.
  - Evidence: https://learn.microsoft.com/power-automate/guidance/coding-guidelines/test-cloud-flows (guidance/coding-guidelines/test-cloud-flows.md): "Configure the static result (classic designer): Select the ellipsis (…) on the action you want to mock, and then select Static result. Select the Enable Static Result toggle."
  - Verdict: CONFIRMED
  - Suggested correction: "Im klassischen Designer wählst du im Menü (…) der Aktion "Static result"." / "In the classic designer, select Static result in the action's (…) menu."

- **[low] Tip 92 explanation uses the old vendor name Muhimbi**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="92"].quiz.erklaerungen[0] "Adobe PDF Services, Encodian, Muhimbi und Cloudmersive haben kostenlose Kontingente."; data/en.json["92"].quiz.erklaerungen[0] "... Encodian, Muhimbi and Cloudmersive ..."
  - Problem: The tip (updated 2026-10-17) lists the product as "Nutrient Document Converter (formerly Muhimbi PDF)". The marked answer ("most connectors are still premium") is correct: three of the four connectors in the tip's table are premium, Encodian is standard.
  - Evidence: /home/user/powerplatformtip_live/_posts/2023-12-08-powerplatformtip-92-free-pdf-tools-in-powerautomate-.md: table rows "Encodian - PDF | Standard", "Adobe PDF Services | Premium", "Nutrient Document Converter (formerly Muhimbi PDF) | Premium", "Cloudmersive PDF | Premium".
  - Verdict: CONFIRMED (tip file; connector reference not local)
  - Suggested correction: Typo fix: 'Muhimbi' → 'Nutrient (ehemals Muhimbi)' in DE and 'Nutrient (formerly Muhimbi)' in EN; optionally mention that Encodian is the one standard connector in the list.

- **[low] Tip 7 text claims union() dedupes objects, tip restricts the DISTINCT behaviour to primitive arrays**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="7"].kurztext_de "Das funktioniert mit einfachen Werten und mit Objekten."; data/en.json["7"].kurztext "This works with simple values and with objects."
  - Problem: The tip only vouches for the union(x, x) DISTINCT trick on primitive arrays (text, numbers, booleans) and says union() is "most predictable on primitive arrays"; the technique extends the claim to objects without a source.
  - Evidence: /home/user/powerplatformtip_live/_posts/2022-12-16-powerplatformtip-7-union-and-filterarray-.md: "Passing the same array twice makes it behave like DISTINCT for primitive arrays (text, numbers, booleans), removing duplicates." and "union() is most predictable on primitive arrays." The Azure Logic Apps function reference is not available locally.
  - Verdict: CONFIRMED (discrepancy with the tip; runtime behaviour on objects not verifiable locally)
  - Suggested correction: "Verlässlich funktioniert das mit einfachen Werten (Text, Zahlen, Ja/Nein); bei Objekten prüfst du das Ergebnis." (EN accordingly).

- **[low] Tip 124 explanation: .json is returned as a JSON object, not as text, and Markdown is not in the tip's list**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="124"].quiz.erklaerungen[2] "Klartextformate wie JSON, CSV, XML oder Markdown kommen direkt als Text zurück."; data/en.json["124"].quiz.erklaerungen[2]
  - Problem: Per the tip, .txt/.csv/.xml/.html come back as plain text, while a .json file comes back as a JSON object whose properties can be addressed directly (hence the string() wrapper in the tip's BOM expression); Markdown is not listed for Get file content. The marked answer (no Base64 detour for text formats) stays correct.
  - Evidence: /home/user/powerplatformtip_live/_posts/2024-09-18-powerplatformtip-124-recognize-plain-text-file-formats-.md: "Text formats such as .txt, .csv, .xml or .html come back as plain text and .json as a JSON object, so body('Get_file_content') is usable directly."
  - Verdict: CONFIRMED (tip file; connector reference not local)
  - Suggested correction: "Textformate wie CSV, XML oder HTML kommen direkt als Text zurück, JSON als Objekt. Du verarbeitest sie ohne Base64-Dekodierung weiter." (EN accordingly).

#### Not verifiable locally (belts 1–2)

Claims not verifiable locally (consistent with the tip files, no contradiction found):
- Tip 97: SharePoint Get items default 100 items and Excel List rows default 256 (connector reference not local; tip documents measured runs).
- Tip 139: Exchange Online plus addressing, receive-only, usable as Reply To (Exchange docs not local).
- flows-vs-rules: SharePoint list rules (Automate > Create a rule) evaluating the condition inside SharePoint (SharePoint docs not local).
- Tip 193: replacing /details with /export opens the package export page (undocumented UI workaround, stated as such in the tip).
- Tip 34: Power Apps (V2) trigger input types Text, Yes/No, File, Email, Number, Date (support article known-issues-power-apps-v2-trigger not in the local clone; only the embedded/invoker connection note in approvals-known-issues.md).
- Tip 96: OneDrive for Business Upload file from URL / Get file content being standard actions (connector reference not local; licensing FAQ confirms only that non-premium connectors need no premium license).
- Tips 65, 120, 145: PowerDocu, Power Tools by Paul Murana and tools.powerplatformtip.com are third-party products, not covered by Learn.
- Tip 148: take() returning all items when the array is shorter; tip 6: utcNow() accepting a format string; tip 59: the ? operator returning null and the InvalidTemplate error (Azure Logic Apps function/WDL reference not local; tips show real runs).
- Tip 27 / tip 124: SharePoint connector parameters (Create file has no overwrite parameter, Infer Content Type behaviour) rest on the tip's tests and the non-local connector reference.

### A2. Belts 3–4 (47 entries)

47 entries checked, 42 clean; the three limits used (30 days, 50, 11) confirmed in Learn limits-and-config.

- **[medium] `ausdruck` of technique 146 is not in the tip and is not a valid expression as written**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="146"].ausdruck: `replace(varTitle,'''','''''')`
  - Problem: The rule is that `ausdruck` appears verbatim in the tip. The tip only contains `replace(variables('varTitle'),'''','''''')` and `replace(triggerOutputs()?['body/Title'],'''','''''')`. The shortened form with a bare `varTitle` is not a valid cloud-flow expression (a variable must be referenced as `variables('varTitle')`), so the string check and the syntax both fail.
  - Evidence: /home/user/powerplatformtip_live/_posts/2025-10-18-powerplatformtip-146-encode-decode-functions.md, FAQ 2: "Use the replace() expression to double apostrophes: `replace(variables('varTitle'),'''','''''')`"; `grep -n "replace(varTitle" ` on the file returns nothing.
  - Verdict: CONFIRMED
  - Suggested correction: Set `ausdruck` to `replace(variables('varTitle'),'''','''''')` (the form the tip uses).

- **[low] `pool_ausschluss` of entry 19 describes a tip version that no longer exists**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="19"].pool_ausschluss: "Tipp nennt eine Aktion «Upload file from URL» mit Thumbnail-Ausgabe, fachlich fraglich, Frage nicht eindeutig belegbar."
  - Problem: Tip 19 was rewritten (last_modified_at 2026-10-17) and now uses the real **Get file thumbnail** action (SharePoint returns the thumbnail content, OneDrive for Business returns a URL that is saved with Upload file from URL). The stored quiz ("Aus dem Thumbnail, das SharePoint für die gespeicherte Datei bereitstellt", richtig_index 2) is now fully backed by the tip, so the exclusion reason is outdated. Not visible on the site (pool false, seite false), internal data only.
  - Evidence: /home/user/powerplatformtip_live/_posts/2023-01-12-powerplatformtip-19-resize-files-.md: "Use the built-in **Get file thumbnail** action. It exists in both connectors ... SharePoint: *Get file thumbnail* returns the **thumbnail content** (binary). Write it straight into a new file with *Create file*."
  - Verdict: CONFIRMED
  - Suggested correction: Update or remove `pool_ausschluss` for 19; the question can be re-admitted to the pool if desired (no EN overlay exists yet, build.mjs would then require one).

- **[low] Technique 15 and its source tip give opposite advice on where Terminate goes**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="15"].quiz (richtig_index 1, erklaerungen[0] "Ein Terminate im Catch-Scope beendet den Flow sofort, der Finally-Scope wird dann übersprungen.") and `fehler` ("Terminate in Catch setzen."); linked tip 15.
  - Problem: The technique page and quiz treat "Terminate inside Catch" as the classic mistake. The linked tip recommends exactly that: step 2 "(optionally) a **Terminate** action set to *Failed*" inside Catch and FAQ 4 "Add a **Terminate** action set to *Failed* ... inside the Catch scope." The tip also tells readers to tick "is skipped" on Catch, which the technique (correctly) omits. The dojo text is right (Terminate stops the run, Finally does not run), but a reader who follows the tip link gets the opposite instruction, and an exam candidate who learned from the tip would pick the answer marked wrong.
  - Evidence: Learn https://learn.microsoft.com/power-automate/guidance/coding-guidelines/error-handling: "you can use the **Terminate** action to stop the flow and set the status to 'Failed' to ensure that no further actions are executed." Tip: /home/user/powerplatformtip_live/_posts/2022-12-24-powerplatformtip-15-try-catch-finally-.md, step 2 and FAQ 4 as quoted.
  - Verdict: CONFIRMED (Learn) for the dojo claim; the inconsistency is in the source tip.
  - Suggested correction: Keep the technique as is and align tip 15 (move the Terminate recommendation after Finally, drop "is skipped" from the Catch run-after list), or add one sentence to the technique that the tip's older FAQ differs.

- **[low] Quiz explanation 24 recommends a method the tip does not use**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="24"].quiz.erklaerungen[0]: "Enthalten die Werte das Trennzeichen oder sind es Objekte, nimmst du Apply to each mit Append to array variable." (EN identical)
  - Problem: Not wrong, but the tip gives different and simpler guidance: for values containing the delimiter "choose a unique delimiter", and for objects (or to keep types) `json(replace(concat(string(array1), string(array2)), '][', ','))`. Apply to each / Append to array variable does not appear in the tip at all.
  - Evidence: /home/user/powerplatformtip_live/_posts/2023-01-31-powerplatformtip-24-merge-arrays-or-tables-.md: "**3. Merge and keep duplicates without losing types.** Serialise both arrays, glue them at the `][` seam and parse again: `json(replace(concat(string(array1), string(array2)), '][', ','))`"; FAQ 3: "Choose a unique delimiter that doesn't appear in your data".
  - Verdict: CONFIRMED
  - Suggested correction: Replace the last sentence with the tip's advice, e.g. "Enthalten die Werte das Trennzeichen, nimmst du ein anderes Trennzeichen; für Objekte nutzt du json(replace(concat(string(array1), string(array2)), '][', ','))."

- **[low] EN quiz 166 names the connectors, DE does not**
  - Site: powerautomate.ninja
  - Location: data/en.json → techniken["166"].quiz.antworten: "Office 365 Users: \"Get user profile (V2)\"", "Office 365 Outlook: \"Get mail tips for a mailbox (V2)\"", "Office 365 Outlook: \"Get calendar view of events\"" vs. DE "«Get user profile (V2)»", "«Get mail tips for a mailbox (V2)»", "«Get calendar view of events»"
  - Problem: Content difference between the two language versions (the EN answers carry extra information). The question itself works either way.
  - Evidence: data/techniken.json vs data/en.json, key 166.
  - Verdict: CONFIRMED
  - Suggested correction: Either add the connector names to the DE answers or drop them from the EN answers so both versions ask the same thing.

#### Not verifiable locally (belts 3–4)

Not verifiable locally (connector reference pages, Graph and SharePoint REST docs, Logic Apps function reference are not in the clones; all of these match the respective tip file):
- 138 / 165: "HTTP with Microsoft Entra ID (preauthorized)" is a premium connector (lizenz_belege points to learn.microsoft.com/connectors/webcontents/, not local). Stated identically in tips 58, 138 and 165. PLAUSIBLE.
- 140: "Azure AI Document Intelligence (form recognizer)" is a standard connector; F0 = 500 pages/month, first 2 pages per request. From tip 140 only.
- 142: Office 365 Outlook "Send an HTTP request" is standard and accepts PATCH on /me/events; "Update event (V4)" has no categories field (distractor). From tip 142 only.
- 149: "Bei Antworten über HTML können Rückgabefelder leer sein" and "UserEmailAddress ist kein verlässlicher Nachweis" (kurztext, quiz explanation 2, fehler). Tip 149 only says the output carries UserEmailAddress and that for distribution groups it holds the member's user id; the empty-field behaviour with HTML responses is in neither the tip nor a local Learn page.
- 166: "Get mail tips for a mailbox (V2)" and its automaticReplies output. Tip only.
- 167: `dateDifference()` exists and returns a timespan string such as 1268.00:00:00 (quiz explanation). Tip only; the local expression cookbook mentions only the absence of dateDiff().
- 163: ICS attachment with content type text/calendar. Tip only.
- 121 / 123 / 129 / 133 / 153: SharePoint field names FileLeafRef/FileRef/FileDirRef, /ItemCount including folders, OData case-insensitivity, Choice column `{"Value": ...}`, MERGE via X-HTTP-Method. Tip only (SharePoint REST docs not local).
- 21: `x-ms-user-email` header of the manual trigger. Tip only (no Learn hit).
- 106: Quick Parts > Document Property fills from library columns. Tip only.
- 18 / 19: OneDrive for Business "Upload file from URL" and "Get file thumbnail" (URL valid 6 hours). Tip only.

Note on the source tips (outside the two sites, listed because the technique pages link to them): tip 35 FAQ 2 says trigger concurrency can be set "between 1-50", Learn limits-and-config says 1 to 100 (default 25); data/limits.json already has the correct 1 to 100. Tip 15 contradicts technique 15 as described in F3.

### A3. Belts 5–7 (24 entries), limits.json, licence check, belt texts, about page

19 of 24 techniques clean; both `ausdruck` strings (144, 168) verbatim in their tips; all four limits.json numbers confirmed; the licence-check core (Microsoft 365 = Standard connectors only, owner vs. instant-user rule, Process licence instead of per-user, Power Apps / Dynamics 365 context, desktop flow = Premium) confirmed in the Learn licensing FAQ; belt texts DE/EN in parity.

- **[high] FetchXML aggregation (sums, group by) is not supported in the List rows action**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="39"].quiz.erklaerungen[0] "So gehen Joins und Gruppierungen, die der OData-Filter nicht kann." and .lernziel "Du lässt Dataverse komplexe Abfragen und Summen serverseitig rechnen."; same in data/en.json → techniken["39"] ("This enables joins and grouping ...", "calculate complex queries and totals on the server")
  - Problem: Both texts tell the reader that the Fetch Xml Query parameter of List rows gives them grouping/sums. Microsoft Learn states that aggregation queries are not supported in List rows with FetchXML. The tip's aggregation examples were run against the Dataverse Web API, not the List rows action.
  - Evidence: https://learn.microsoft.com/power-automate/dataverse/list-rows (power-automate-docs/articles/dataverse/list-rows.md, section "Fetch Xml Query"): "Aggregation queries aren't currently supported when using the **List rows** action with FetchXML queries. However, the distinct operator is supported." The parameter name "Fetch Xml Query" itself is confirmed on the same page.
  - Verdict: CONFIRMED
  - Suggested correction: In erklaerungen[0] replace "Joins und Gruppierungen" with "Joins über verknüpfte Tabellen (link-entity) und eigenes Paging" and change lernziel to "Du lässt Dataverse komplexe Abfragen mit Joins serverseitig ausführen." (drop "Summen"); mirror in en.json.

- **[high] Fill-and-sign explanation describes re-zipping a .docx, which the tip says is not possible with standard actions**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="fill-and-sign-word-document-power-apps-automate"].quiz.erklaerungen[2] "Du entpackst sie, ersetzt den Platzhalter in word/document.xml und packst sie wieder." and .lernziel "... über das XML im Archiv."; same in data/en.json ("You extract it, replace the placeholder in word/document.xml and zip it again.")
  - Problem: The tip explicitly says there is no standard action that zips the edited files back into a .docx; its method saves the template as "Word XML Document (*.xml)" (one flat XML file), replaces placeholders with replace() and writes the result with Create file. The explanation teaches a workflow that the tip says does not work.
  - Evidence: /home/user/powerplatformtip_live/_posts/2022-04-27-fill-and-sign-word-document-power-apps-automate.md: "Unzipping the `.docx` with **Extract archive to folder** works, but there is no standard action that zips the edited files back into a `.docx`." and "Save your Word template as a **Word XML Document (\*.xml)**, a single-file format ... the flow swaps the placeholders with `replace()` and writes the filled file back with **Create file**."
  - Verdict: CONFIRMED (against the tip)
  - Suggested correction: "Word speichert die Vorlage als Word XML Document (*.xml), ein einziges XML. Der Flow liest es als Text, ersetzt die Platzhalter mit replace() und schreibt die Datei mit Create file zurück; ein Zurückpacken in .docx ist mit Standardaktionen nicht möglich." and lernziel "... über das XML-Format der Datei" (EN accordingly).

- **[medium] "For a selected item läuft nur aus der Default-Umgebung" contradicts the tip's own point**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="169"].quiz.frage "Aus welcher Umgebung läuft «For a selected item» laut Tipp nur?" and erklaerungen[0] "«For a selected item» läuft nur aus der Default-Umgebung."; same in data/en.json ("For a selected item only runs from the Default environment.")
  - Problem: The tip says only the SharePoint **Automate menu** lists For-a-selected-item flows from the Default environment; the trigger itself runs fine from a productive environment when started via the column button (that is the whole tip). The quiz wording makes the trigger sound environment-bound. The second sentence of the explanation partly corrects this, so the question is still answerable, but the statement as written is wrong.
  - Evidence: /home/user/powerplatformtip_live/_posts/2026-09-10-powerplatformtip-169-run-for-a-selected-item-flows-from-any-list-column-button.md: "The SharePoint **Automate** menu only lists *For a selected item* flows from the **Default** environment ... keep the **standard** *For a selected item* trigger in your productive environment and start it from a **column-formatting button**". No local Learn page states the Default-environment restriction of the Automate menu (not verifiable in Learn).
  - Verdict: CONFIRMED (against the tip)
  - Suggested correction: Frage "Aus welcher Umgebung zeigt das Automate-Menü in SharePoint «For a selected item»-Flows laut Tipp nur an?" and erklaerungen[0] "Das Automate-Menü listet nur Flows aus der Default-Umgebung. Liegt der Flow in einer produktiven Umgebung, startest du ihn über einen Button in der Spaltenformatierung mit executeFlow." (EN accordingly).

- **[low] Action name: "Search for user (V2)" should be "Search for users (V2)"**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="111"].quiz.antworten[2] "Mit «Search for user (V2)» aus Office 365 Users" and erklaerungen[2]; data/en.json → techniken["111"].quiz.antworten[2] and erklaerungen[2] ("Search for user (V2)")
  - Problem: The Office 365 Users action is named "Search for users (V2)" (plural); the tip uses the plural seven times.
  - Evidence: /home/user/powerplatformtip_live/_posts/2024-04-24-powerplatformtip-111-adaptive-cards-for-dynamic-approvals-.md: "fill its `Input.ChoiceSet` from **Search for users (V2)** via a **Select** action" (connector reference not available locally).
  - Verdict: CONFIRMED (against the tip)
  - Suggested correction: Typo fix: 'Search for user (V2)' → 'Search for users (V2)' (4 occurrences: DE answer + explanation, EN answer + explanation).

- **[low] Error code "connectorRequestFailure" is not in the tip**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="174"].quiz.erklaerungen[2] "Jeder Status ausserhalb von 2xx wird zum harten Fehler connectorRequestFailure, bevor das Sprachmodell die Antwort liest."; same in data/en.json ("becomes the hard failure connectorRequestFailure")
  - Problem: The tip names the Copilot Studio error codes `HTTP400BadRequest`, `HTTP404NotFound` and `HTTP422UnprocessableEntity` for a directly bound connector; "connectorRequestFailure" does not occur anywhere in the tip, so the explanation is not answerable from the source and may be an invented code.
  - Evidence: /home/user/powerplatformtip_live/_posts/2026-09-03-powerplatformtip-174-copilot-studio-self-healing-connector-actions.md: "a non-2xx status ends the tool call with an error code such as `HTTP404NotFound` or `HTTP422UnprocessableEntity`"; `grep -i connectorRequestFailure` on the tip returns nothing. Copilot Studio docs are not available locally.
  - Verdict: PLAUSIBLE
  - Suggested correction: "... wird zum harten Fehler mit einem Code wie HTTP404NotFound oder HTTP422UnprocessableEntity, bevor das Sprachmodell die Antwort liest." (EN accordingly).

- **[medium] "Process (Per Flow)" mixes the Process license with the retired per-flow plan**
  - Site: powerautomate.ninja
  - Location: premium/index.html → section "Worauf das Urteil beruht": "Power Automate Premium (Per User), Power Automate Process (Per Flow), Power Apps Premium ..."; en/premium/index.html same sentence ("Power Automate Process (Per Flow)"); assets/js/premium.js line 22 verdict text "Process (Per Flow)" (DE and EN)
  - Problem: "Per-flow plan" is the name of a legacy license that was removed from the price list on 1 Feb 2024 and replaced by the Process license; the Process license is assigned to a flow or a flow group (up to 25 flows), so labelling it "(Per Flow)" is outdated and can be confused with the old plan.
  - Evidence: https://learn.microsoft.com/power-platform/admin/power-automate-licensing/faqs (power-platform/admin/power-automate-licensing/faqs.md): "The Power Automate per-flow plan and the Power Automate unattended RPA add-on were removed from the price list on February 1, 2024. ... The Process license replaces both" and "You can assign a Process license directly to one solution-aware cloud flow or to a flow group. A flow group lets up to 25 solution-aware cloud flows share one Process license."
  - Verdict: CONFIRMED
  - Suggested correction: Write "Power Automate Process (pro Flow oder Flow-Gruppe, ersetzt den früheren Per-Flow-Plan)" / "Power Automate Process (per flow or flow group, replaces the former per-flow plan)" in both pages and in premium.js.

- **[low] "Jede Person führt den Flow im eigenen Kontext aus" is only true for connections set to run-only user**
  - Site: powerautomate.ninja
  - Location: data/techniken.json → techniken[schluessel="135"].quiz.antworten[0] / erklaerungen[0] "Wer den Flow über die App startet, löst ihn mit dem Power Apps (V2) Trigger im eigenen Kontext aus."; data/en.json → techniken["135"] same
  - Problem: The tip stresses that whether an action acts as the clicking user depends on each connector's run-only setting ("Provided by run-only user"); with embedded connections the action still uses the configured (creator's) connection. Without that qualifier the distractor "Alle Flows laufen unter dem Konto des Erstellers" is partly defensible for embedded connections.
  - Evidence: /home/user/powerplatformtip_live/_posts/2025-04-01-powerplatformtip-135-One-Flow-Many-Users.md: "Whether an action uses the clicking user's identity depends on that connector's run-only connection setting; a flow using an embedded connection continues to use that configured connection."
  - Verdict: CONFIRMED (against the tip)
  - Suggested correction: Add to erklaerungen[0]: "..., sofern die Verbindungen auf «Provided by run-only user» stehen; eingebettete Verbindungen laufen weiter als die Person, die sie angelegt hat." (EN accordingly).

- **[low] "Alle Fragen stammen aus den wöchentlichen Tipps von Marcel Lehmann" does not cover the two guest tips**
  - Site: powerautomate.ninja
  - Location: ueber/index.html → "Woher die Inhalte kommen": "Alle Fragen stammen aus den wöchentlichen Tipps von Marcel Lehmann auf powerplatformtip.com."; en/ueber/index.html: "All questions come from the weekly tips by Marcel Lehmann on powerplatformtip.com."
  - Problem: Two pool questions in belt 5 are based on guest posts attributed to other authors (tipp_titel "... from Paulie M" and "... from Damien Bird", tipp_nr null, URLs under /article/powerplatform/2022/...), not on numbered weekly #PowerPlatformTip posts by Marcel Lehmann.
  - Evidence: data/techniken.json → techniken[schluessel="fill-and-sign-word-document-power-apps-automate"].tipp_titel "Fill and Sign a Word Document ..., from Paulie M"; techniken[schluessel="extract-html-table-email-power-automate"].tipp_titel "Extract an HTML Table from an Email ..., from Damien Bird"; both tip files end with "This video was automatically posted using PowerAutomate."
  - Verdict: CONFIRMED
  - Suggested correction: "Alle Fragen stammen aus den Tipps auf powerplatformtip.com, fast alle aus den wöchentlichen #PowerPlatformTips von Marcel Lehmann, einzelne aus dort vorgestellten Community-Beiträgen." (EN accordingly).

#### Not verifiable locally (belts 5–7 and pages)

Not verifiable locally (no finding raised):
- Q1 claim "SharePoint, Office 365 Outlook, Microsoft Teams und Excel Online (Business) sind Standard-Connectoren" and Q2/Q3 premium status of HTTP, custom connectors, "HTTP with Microsoft Entra ID" and Microsoft Dataverse connector: the connector reference (learn.microsoft.com/connectors/...) is not in the local clones; consistent with the tips (162, 164, 169, 170, 174 call HTTP with Microsoft Entra ID / HTTP / custom connectors premium and Dataverse premium) and with faqs.md "HTTP actions ... count toward your daily action limit" (no tier statement).
- 144 lizenz_belege (learn.microsoft.com/connectors/approvals/ and /connectors/sharepointonline/): connector reference not local.
- 47: "SharePoint $batch is not transactional, also for ChangeSets" (SharePoint dev docs not local; matches the tip).
- 162: "Sonst lehnt Graph die Anfrage mit 400 ab" is not stated in the tip and Graph docs are not local.
- 102 hideAttendees, 164 POST /v1.0/invitations, 160/161 SharePoint REST endpoints, 154 MERGE fields: Graph/SharePoint REST docs not local; all match the tips.
- 150: Office Scripts "Run script" being standard and result output name: not checked against office-scripts-docs (quiz does not depend on it).
- 169: Learn statement that the SharePoint Automate menu lists only Default-environment flows was not found in the local power-automate-docs.
- 174 / 170 Copilot Studio behaviour (error codes, 100-second limit, agent flows): Copilot Studio docs not local.

Language patterns: no ß, no Sie-form, no broken umlauts or filler phrases found in the assigned DE texts.

## B. Technical and language findings

- **[medium] Production build currently fails: expression of tip 146 is no longer verbatim in the tip**
  - Location: `data/techniken.json` → techniken[schluessel="146"].ausdruck `replace(varTitle,'''','''''')`; `node scripts/build.mjs --produktion` stops with "Fehler (2): Tipp 146 (de/en): Ausdruck … steht nicht wörtlich im Tipp".
  - Problem: The tip (updated 2025-10-18 file, current wording) writes the expression as `replace(variables('varTitle'),'''','''''')`. The build's verbatim check therefore fails and the site cannot be rebuilt until the two agree.
  - Evidence: `_posts/2025-10-18-powerplatformtip-146-encode-decode-functions.md` line 32: "Use the replace() expression to double apostrophes: `replace(variables('varTitle'),'''','''''')`".
  - Verdict: CONFIRMED (reproduced in a scratch copy of the repo)
  - Suggested correction: Set `ausdruck` to `replace(variables('varTitle'),'''','''''')` in `data/techniken.json` (the EN overlay takes the same string), then rebuild.

- **[medium] Licence check labels the Process licence "Per Flow"** – see finding in section A (belts 5–7, premium page): "Power Automate Process (Per Flow)" in `premium/index.html`, `en/premium/index.html` and `assets/js/premium.js` conflates the Process licence with the per-flow plan that left the price list on 1 February 2024.

- **[low] Some text links are 23 px high, below the 24 px the README promises**
  - Location: technique pages, source links under the quiz (e.g. `/techniken/filter-array-im-advanced-mode/`: "PowerPlatformTip #3", "Use data operations in Power Automate"); `/premium/` and `/en/premium/`: "Deep dive on specific licensing questions", "List of all Standard tier connectors". Measured 23 px at 360 px and 390 px.
  - Problem: README states "Klickziele mindestens 24 px (WCAG 2.5.8)". Inline links inside running text are exempt in WCAG 2.5.8, so this is a consistency note, not an accessibility failure.
  - Verdict: CONFIRMED (Playwright measurement)
  - Suggested correction: Give the source-link list items `padding-block: 2px` or `line-height: 1.6` so the targets reach 24 px.

## Technical review (both sites, done by the coordinating reviewer)

Method: local clone of `main` served with a static file server; Playwright/Chromium at 360×740 and 390×844 (mobile emulation) plus 1280×900; checks for horizontal overflow, elements wider than the viewport, tap targets below 24×24 px, text below 12 px, JavaScript errors; sitemap/hreflang/canonical/noindex cross-checked against the files on disk; both sites' own `scripts/links.mjs --livegang`; a fresh `node scripts/build.mjs --produktion` in a scratch copy.

### Results that are fine (no finding)
- No horizontal overflow on any of the 17 (copilot.ninja) / 14 (powerautomate.ninja) pages tested at 360 px and 390 px; menu button, search, theme switch and DE/EN switch visible on all widths; no JavaScript errors or console errors on any page.
- `sitemap.xml`: every indexable page on disk is listed, every listed URL exists, no `noindex` page is listed (copilot.ninja 80 URLs, 73 noindex pages excluded; powerautomate.ninja 76 URLs, 52 excluded). `xhtml:link` hreflang entries present for every URL.
- Every indexable page carries `hreflang` de, en and x-default plus a canonical that matches its own URL; every hreflang target exists on disk.
- `robots.txt`: `templates/`, `scripts/`, `data/` (and `.github/` on copilot.ninja) blocked, Content-Signal line in every group, sitemap not referenced but hosted at the standard path.
- `llms.txt`: all internal links resolve (copilot.ninja 76/76, powerautomate.ninja 56/56); copilot.ninja also ships `llms-full.txt`, powerautomate.ninja does not (informational, not a defect).
- `scripts/links.mjs --livegang` passes on both sites (copilot.ninja 155 pages / 10,587 links, powerautomate.ninja 130 pages / 6,564 links); no preview build in the folders.
- Language: no ß anywhere, no em or en dashes in data or HTML, Du-form throughout (the capitalised "Sie" hits are the pronoun "sie" at sentence start, plus one deliberate instruction inside an agent prompt), no broken umlauts (ae/oe/ue only in slugs and keys). The hero figure that appears as an outline for the first 650 ms is the intended draw-in animation (`tusch--zeichnen`), not a rendering defect.
- The hand-written DE and EN pages have the same number of h2/h3/details/table/li elements; every technique and exam question has an EN counterpart (copilot.ninja 30/30 and 19/19; powerautomate.ninja 106/106 pool entries, the two pool-excluded tips 19 and 156 have no EN entry by design).


## C. Typo fixes applied on this branch (separate commit)

Commit "Aktionsname korrigiert …" on this branch (data/techniken.json, data/en.json and the generated pools assets/data/pool.json and pool-en.json; no rebuild run):

- `Search for user (V2)` → `Search for users (V2)` (technique 111, DE and EN answer and explanation).

Not applied (content, suggestion only): the `ausdruck` of 146, the quiz rewordings (27, 118, 169, 39, fill-and-sign), "Muhimbi" → "Nutrient", "Process (Per Flow)", the about-page attribution.
