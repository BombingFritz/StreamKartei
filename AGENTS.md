# AGENTS.md – Regeln für KI-Assistenten

## Zuständigkeit
- Dieses Repository ist die **Website** der Stream-Kartei (GitHub Pages aus Zweig `main`, Ordner `/`). Sie ist nur Verbraucher der Daten.
- Das **Datenformat gehört dem Server** ([BombingFritz/Twitch-Companion-JS-server](https://github.com/BombingFritz/Twitch-Companion-JS-server), Spec `docs/specs/stream-kartei.md`). Hier nie selbst ändern oder umdeuten. Fehlt etwas oder passt etwas nicht: im Server-Repository ein Issue anlegen oder in Issue #84 kommentieren.
- Der **Zweig `data`** gehört allein dem Server (genau ein Commit, wird ersetzt). Nicht anlegen, nicht hineinschreiben, nicht löschen, nicht als Basis für Branches nehmen.
- Weitere Spiele (RimWorld) bekommen eine eigene Seite; ihr Format legen Mod, Server und Nutzer fest.

## Vor jeder Aufgabe
1. Stand auf GitHub prüfen: `main`, eigener Branch, offene Pull Requests und Issues.
2. Die aktuelle Server-Spec `docs/specs/stream-kartei.md` lesen, wenn Daten berührt sind.
3. Nur im vereinbarten Umfang arbeiten; neue Wünsche nicht stillschweigend mitnehmen.

## Regeln für die Seite
- Rein statisch: HTML, CSS, Vanilla-JS, kein Build-Schritt, keine npm-Abhängigkeiten.
- **Kein Tracking, keine Cookies, kein `localStorage`**, keine Analyse- oder Werbedienste, keine fremden Skripte. Auch keine Schriften von fremden Servern (z. B. Google Fonts), weil dabei die IP-Adresse der Zuschauer abfließt. Erlaubt sind Systemschriften und freie Schriften, die mit Lizenz in `assets/fonts/` liegen (derzeit UnifrakturMaguntia, nur für kurze Beschriftungen).
- **Keine Twitch-Anbindung** und **keine Twitch-Namen**. Es stehen nur die Namen im Spiel auf der Seite.
- Texte aus den Daten nur per `textContent` bzw. `Kartei.el()` einsetzen, **nie** per `innerHTML` o. Ä. Die Daten kommen aus dem Spiel und sind nicht vertrauenswürdig.
- Unbekannte Felder ignorieren. `schemaVersion` größer als unterstützt: Hinweis zeigen, nicht abbrechen.
- Ohne Daten oder bei Ladefehler: freundlicher Hinweis, nie eine leere Seite.
- Beispieldaten in `beispiel/` sind erfunden (ausgedachte Namen), im Format des Vertrags, und werden mit „Beispieldaten“ gekennzeichnet.
- Handy und PC, hell und dunkel. Gestaltung im Stil der Marine der 1940er als Aktenablage auf Karton (Unterlage farblich passend zum Papier, Nutzer 24.11.2026) mit Akten, Formularen (Soldbuch), Seekarte, Stempeln und Schreibmaschinenschrift, nur mit CSS. Ohne Markenlogos oder Spielgrafiken und **ohne Hoheitszeichen, Adler, Hakenkreuze, Ordensbilder oder Farben historischer Orden**; Ordensnamen aus den Daten nur als Text. Hakenkreuze niemals verwenden oder anzeigen, auch nicht in Bildern, Schriften oder Vorlagen (Nutzer, 22.11.2026).

## Arbeitsweise
- Eigener Branch vom aktuellen `main` (`git checkout --no-track -b <name> origin/main`), kleine Commits.
- Kann die Session nicht pushen, veröffentlicht der Nutzer den Branch (GitHub Desktop); danach den Pull Request sofort anlegen. Gemergt wird nur vom Nutzer.
- Vor jedem Commit: `node test/format-test.js`. Änderungen an der Seite lokal ansehen (`node tools/serve.js`, dann http://localhost:8080/?beispiel), auch in Handybreite.
- Ergebnisse ehrlich trennen: statisch geprüft, automatisiert getestet, im Browser angesehen, vom Nutzer bestätigt.

## Verbote
- Keine Secrets, Tokens oder privaten Adressen in Repository, Issues oder Pull Requests. Das Token zum Veröffentlichen liegt nur beim Server.
- Keine echten Spielstände oder Laufzeitdateien des Servers ins Repository.
- Nichts erfinden, was als echt gelten könnte: Unklares als `[UNGEKLÄRT]` markieren und nachfragen.
