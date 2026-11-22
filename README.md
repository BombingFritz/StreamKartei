# Stream-Kartei

Öffentliche Website mit dem letzten Stand der Spielfiguren aus dem Twitch-Stream von BombingFritz. Zuschauer, die im Spiel eine Figur haben, sehen hier jederzeit deren Werte, auch wenn gerade kein Stream läuft und der Server aus ist.

**Adresse:** https://bombingfritz.github.io/StreamKartei/

- **Startseite** (`/`): Auswahl des Spiels, je Spiel „Spielstand vom …“.
- **UBOAT** (`/uboat/`):
  - oben das Boot mit der Nummer der laufenden bzw. letzten Feindfahrt und Kennzahlen,
  - die ganze Besatzung in den Gruppen Kommandant, Offiziere, Matrosen; die Gruppen sind beim Laden zugeklappt. In jeder Gruppe steht die Reserve am Ende. Filter nach Aufenthalt; je Person die Zahl der eigenen Feindfahrten (gut sichtbar unter dem Namen), Orden und eine aufklappbare Akte mit Lebenslauf und Leistungen (nach Art gruppiert),
  - darunter die Karriere (Treffer, Tiefe, Stunden auf See …),
  - die Liste der Versenkungen (am Handy als Karten),
  - die Ehrentafel der Gefallenen.
  - Nicht angezeigt: die zurückgelegte Strecke (`distanceTravelled`, Einheit ungeklärt) und die Gedenktafeln (`plaques`, Wunsch des Nutzers).
- **RimWorld** folgt später als eigene Seite.

Rein statisch: HTML, CSS und Vanilla-JavaScript, kein Build-Schritt, keine Abhängigkeiten. Keine Cookies, kein Tracking, keine fremden Skripte oder Schriften. Twitch-Namen stehen nie auf der Seite, nur die Namen im Spiel.

## Woher die Daten kommen

```
Twitch Companion JS server (Streaming-PC)
   └─ GitHub-API ──> Zweig „data“ dieses Repositorys: index.json, uboat/crew.json
                                     │
Website (GitHub Pages, Zweig „main“) ──fetch im Browser──> raw.githubusercontent.com/BombingFritz/StreamKartei/data/…
```

- Die Daten veröffentlicht der Server ([BombingFritz/Twitch-Companion-JS-server](https://github.com/BombingFritz/Twitch-Companion-JS-server)) im Zweig `data`. Der Zweig hat immer genau einen Commit; er gehört allein dem Server.
- Das **Datenformat** ist in der Server-Spec [`docs/specs/stream-kartei.md`](https://github.com/BombingFritz/Twitch-Companion-JS-server/blob/main/docs/specs/stream-kartei.md) festgelegt (Server-Issue BombingFritz/Twitch-Companion-JS-server#84). Diese Website ist nur Verbraucher.
- GitHub hält die Dateien bis zu etwa 5 Minuten im Cache. Neue Spielstände erscheinen also mit etwas Verzögerung (dazu kommt der Mindestabstand von 10 Minuten zwischen Veröffentlichungen beim Server).
- Zuschauer mit `!privat` filtert schon der Server heraus.

## Beispielmodus

In [`beispiel/`](beispiel/) liegen **erfundene** Daten im selben Format (25 Crewmitglieder, 3 Gefallene, ein ausgedachtes Boot mit 10 Versenkungen). Die Seite nimmt sie

- wenn die Adresse `?beispiel` enthält, z. B. https://bombingfritz.github.io/StreamKartei/?beispiel, oder
- wenn der Zweig `data` noch fehlt (GitHub antwortet mit 404).

Dann steht oben deutlich „Beispieldaten“. Andere Ladefehler (keine Verbindung, kaputte Datei) zeigen einen Hinweis mit „Erneut versuchen“ statt einer leeren Seite.

Weitere Hinweise auf der Seite:
- Spielstand älter als 7 Tage: „Länger nicht gespielt“.
- `schemaVersion` größer als 1: „Neueres Datenformat“; die Seite zeigt trotzdem, was sie kennt.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Startseite |
| `uboat/index.html` | UBOAT-Seite |
| `assets/css/kartei.css` | Gestaltung im Stil der Marine der 1940er: Schreibtisch, Akten, Soldbuch-Formular, Seekarte, Stempel; nur CSS, ohne Bilder und ohne Hoheitszeichen (hell und dunkel nach Systemeinstellung, Handy und PC) |
| `assets/fonts/` | Frakturschrift UnifrakturMaguntia für Vordrucke und Titel (SIL Open Font License 1.1, Lizenz daneben); liegt hier, damit kein fremder Server abgerufen wird |
| `assets/js/kartei.js` | Gemeinsame Hilfen: Laden mit Beispiel-Rückfall, Aufbereiten, Datum, Sortierung; läuft auch in Node für die Tests |
| `assets/js/start.js`, `assets/js/uboat.js` | Aufbau der beiden Seiten |
| `beispiel/` | Erfundene Beispieldaten |
| `test/format-test.js` | Prüft Beispieldaten und Hilfen |
| `tools/serve.js` | Kleiner Server zum lokalen Testen |
| `.nojekyll` | GitHub Pages veröffentlicht die Dateien unverändert |

Eine neue Spielseite (z. B. RimWorld): eigener Ordner wie `uboat/`, eigenes Skript, Eintrag in `SPIELSEITEN` in `assets/js/kartei.js`. Spiele aus `index.json` ohne eigene Seite zeigt die Startseite mit „Seite folgt“.

## Lokal testen

Voraussetzung: Node.js (jede aktuelle Version), sonst nichts.

```powershell
node tools/serve.js
```

Dann im Browser http://localhost:8080/?beispiel öffnen. Ohne `?beispiel` versucht die Seite die echten Daten von GitHub zu laden und nimmt die Beispieldaten nur, solange der Zweig `data` fehlt.

Tests (ohne Abhängigkeiten):

```powershell
node test/format-test.js
```

Eine echte Datei vom Server lässt sich mitprüfen: `node test/format-test.js <crew.json> [<index.json>]`.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Fanprojekt ohne Verbindung zu den Herstellern der Spiele; keine Logos oder Grafiken aus den Spielen.
