/*
 * Stream-Kartei – gemeinsame Hilfen für alle Seiten.
 *
 * Läuft im Browser (als window.Kartei) und in Node (require, für die Tests).
 * Kein Build-Schritt, keine Abhängigkeiten.
 *
 * Das Datenformat gehört dem Server (Spec docs/specs/stream-kartei.md im
 * Repository BombingFritz/Twitch-Companion-JS-server). Hier wird es nur
 * gelesen und vorsichtig aufbereitet; unbekannte Felder werden ignoriert.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.Kartei = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /** Unterstützte Version des Datenformats. Höher: Hinweis anzeigen. */
    var SCHEMA_VERSION = 1;

    /** Hier legt der Server die Daten ab (Zweig `data`). */
    var DATEN_BASIS = 'https://raw.githubusercontent.com/BombingFritz/StreamKartei/data/';

    /** Ab diesem Alter des Spielstands: Hinweis „länger nicht gespielt“. */
    var ALT_AB_MS = 7 * 24 * 60 * 60 * 1000;

    var ZEITZONE = 'Europe/Berlin';

    /** Seiten, die es schon gibt (Schlüssel = `game` aus index.json). */
    var SPIELSEITEN = { uboat: 'uboat/' };

    // ---------------------------------------------------------------- Werte

    function text(wert) {
        if (wert === null || wert === undefined) return null;
        var s = String(wert).trim();
        return s === '' ? null : s;
    }

    function zahl(wert) {
        if (typeof wert === 'number' && isFinite(wert)) return wert;
        if (typeof wert === 'string' && wert.trim() !== '' && isFinite(Number(wert))) return Number(wert);
        return null;
    }

    function textListe(wert) {
        if (!Array.isArray(wert)) return [];
        var liste = [];
        for (var i = 0; i < wert.length; i++) {
            var t = text(wert[i]);
            if (t !== null) liste.push(t);
        }
        return liste;
    }

    /** ISO-Zeitpunkt → Date oder null. */
    function zeitpunkt(wert) {
        var t = text(wert);
        if (t === null) return null;
        var d = new Date(t);
        return isNaN(d.getTime()) ? null : d;
    }

    /** `JJJJ-MM-TT` → {jahr, monat, tag} oder null (ohne Zeitzonen-Verschiebung). */
    function kalenderdatum(wert) {
        var t = text(wert);
        if (t === null) return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
        if (!m) return null;
        var jahr = Number(m[1]), monat = Number(m[2]), tag = Number(m[3]);
        if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
        return { jahr: jahr, monat: monat, tag: tag };
    }

    // ------------------------------------------------------------ Anzeige

    var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
        'August', 'September', 'Oktober', 'November', 'Dezember'];

    /** Date → „21. November 2026, 10:35 Uhr“ (deutsche Zeit). */
    function formatZeitpunkt(datum) {
        if (!datum) return 'unbekannt';
        var teile = {};
        new Intl.DateTimeFormat('de-DE', {
            timeZone: ZEITZONE, day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(datum).forEach(function (p) { teile[p.type] = p.value; });
        return teile.day + '. ' + teile.month + ' ' + teile.year + ', ' +
            teile.hour + ':' + teile.minute + ' Uhr';
    }

    /** {jahr, monat, tag} → „3. Mai 1942“. */
    function formatKalenderdatum(d) {
        if (!d) return 'unbekannt';
        return d.tag + '. ' + MONATE[d.monat - 1] + ' ' + d.jahr;
    }

    /** Abstand zu jetzt → „vor 3 Stunden“, „vor 2 Tagen“, „gerade eben“. */
    function formatVorher(datum, jetzt) {
        if (!datum) return '';
        var ms = (jetzt || new Date()).getTime() - datum.getTime();
        if (ms < 0) ms = 0;
        var min = Math.floor(ms / 60000);
        if (min < 1) return 'gerade eben';
        if (min < 60) return 'vor ' + min + (min === 1 ? ' Minute' : ' Minuten');
        var std = Math.floor(min / 60);
        if (std < 24) return 'vor ' + std + (std === 1 ? ' Stunde' : ' Stunden');
        var tage = Math.floor(std / 24);
        if (tage < 60) return 'vor ' + tage + (tage === 1 ? ' Tag' : ' Tagen');
        var monate = Math.floor(tage / 30);
        if (monate < 24) return 'vor ' + monate + ' Monaten';
        return 'vor ' + Math.floor(tage / 365) + ' Jahren';
    }

    function istAlt(datum, jetzt) {
        if (!datum) return true;
        return (jetzt || new Date()).getTime() - datum.getTime() > ALT_AB_MS;
    }

    /** Für die Suche: Kleinbuchstaben, Umlaute aufgelöst, nur a–z und 0–9. */
    function suchform(wert) {
        return String(wert || '').toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function vergleicheNamen(a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'de', { sensitivity: 'base' });
    }

    /** 1, wenn die Person in Reserve ist, sonst 0 (zum Sortieren). */
    function istReserve(p) {
        return p && p.statusLabel === 'in Reserve' ? 1 : 0;
    }

    // ------------------------------------------------------ Daten aufbereiten

    function schemaInfo(json) {
        var v = zahl(json && json.schemaVersion);
        return { version: v, neuer: v !== null && v > SCHEMA_VERSION };
    }

    /** index.json → {schema, publishedAt, games: [...]}. Wirft bei unbrauchbarer Form. */
    function normalisiereIndex(json) {
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('index.json ist kein Objekt');
        }
        var spiele = Array.isArray(json.games) ? json.games : [];
        return {
            schema: schemaInfo(json),
            publishedAt: zeitpunkt(json.publishedAt),
            games: spiele.filter(function (g) { return g && typeof g === 'object'; }).map(function (g) {
                var game = text(g.game);
                return {
                    game: game,
                    title: text(g.title) || game || 'Unbekanntes Spiel',
                    path: text(g.path),
                    savedAt: zeitpunkt(g.savedAt),
                    publishedAt: zeitpunkt(g.publishedAt),
                    seite: game && Object.prototype.hasOwnProperty.call(SPIELSEITEN, game) ? SPIELSEITEN[game] : null
                };
            })
        };
    }

    /**
     * Lebenslauf → Absätze. Entfernt `_x000D_` (so kodiert das Spiel teils
     * Wagenrückläufe) und teilt an Leerzeilen bzw. Zeilenumbrüchen.
     */
    function absaetze(wert) {
        var t = text(wert);
        if (t === null) return [];
        return t.replace(/_x000D_/gi, '\n').replace(/\r\n?/g, '\n')
            .split(/\n+/)
            .map(function (s) { return s.replace(/[ \t]+/g, ' ').trim(); })
            .filter(function (s) { return s !== ''; });
    }

    /** Nicht negative ganze Zahl oder null. */
    function ganzzahlOderNull(wert) {
        var n = zahl(wert);
        return n !== null && n >= 0 && Math.floor(n) === n ? n : null;
    }

    /**
     * Feindfahrten einer Person (Feld `patrols`, Stufe 1c): „3 Feindfahrten“,
     * „1 Feindfahrt“, „noch keine Feindfahrt“; null ohne Verlauf → nicht anzeigen.
     */
    function feindfahrtenText(n) {
        if (n === null || n === undefined) return null;
        if (n === 0) return 'noch keine Feindfahrt';
        return n === 1 ? '1 Feindfahrt' : n + ' Feindfahrten';
    }

    function leistungen(liste) {
        if (!Array.isArray(liste)) return [];
        var ergebnis = [];
        liste.forEach(function (a) {
            if (!a || typeof a !== 'object') return;
            var t = text(a.text);
            if (t === null) return;
            ergebnis.push({ kind: text(a.kind), text: t });
        });
        return ergebnis;
    }

    function normalisierePerson(p) {
        return {
            patrols: ganzzahlOderNull(p.patrols),
            lebenslauf: absaetze(p.background),
            decorationNames: textListe(p.decorationNames),
            accomplishments: leistungen(p.accomplishments),
            name: text(p.name) || 'Unbekannt',
            typeLabel: text(p.typeLabel),
            classLabel: text(p.classLabel),
            level: zahl(p.level),
            experiencePoints: zahl(p.experiencePoints),
            experiencePointsFromLastPatrol: zahl(p.experiencePointsFromLastPatrol),
            born: kalenderdatum(p.born),
            died: kalenderdatum(p.died),
            decorations: zahl(p.decorations),
            statusLabel: text(p.statusLabel),
            woundLabel: text(p.woundLabel),
            traits: textListe(p.traits),
            skills: textListe(p.skills)
        };
    }

    function personen(liste) {
        if (!Array.isArray(liste)) return [];
        return liste.filter(function (p) { return p && typeof p === 'object'; }).map(normalisierePerson);
    }

    /** uboat/crew.json → aufbereitete Daten. Wirft bei unbrauchbarer Form. */
    function normalisiereUboat(json) {
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('crew.json ist kein Objekt');
        }
        return {
            schema: schemaInfo(json),
            game: text(json.game),
            savedAt: zeitpunkt(json.savedAt),
            publishedAt: zeitpunkt(json.publishedAt),
            gameVersion: text(json.gameVersion),
            crew: personen(json.crew),
            fallen: personen(json.fallen),
            boat: boot(json.boat),
            career: karriere(json.career),
            plaques: gedenktafeln(json.plaques),
            sinkings: versenkungen(json.sinkings)
        };
    }

    function istObjekt(wert) {
        return !!wert && typeof wert === 'object' && !Array.isArray(wert);
    }

    /** `boat` → aufbereitet oder null. */
    function boot(b) {
        if (!istObjekt(b)) return null;
        return {
            name: text(b.name),
            typeLabel: text(b.typeLabel),
            commissioned: kalenderdatum(b.commissioned),
            tonnageSunk: zahl(b.tonnageSunk),
            merchantShipsSunk: zahl(b.merchantShipsSunk),
            warshipsSunk: zahl(b.warshipsSunk),
            aircraftShotDown: zahl(b.aircraftShotDown)
        };
    }

    var KARRIERE_ZAHLEN = ['currentPatrol', 'torpedoesFired', 'torpedoHits', 'farthestTorpedoHitM',
        'deckGunShots', 'deckGunHits', 'flakShots', 'flakHits', 'distanceTravelled',
        'fuelConsumedLitres', 'maximumDepthM', 'hoursUnderWater', 'hoursAtSea', 'casualties'];

    /** `career` → aufbereitet oder null. */
    function karriere(c) {
        if (!istObjekt(c)) return null;
        var k = { startDate: kalenderdatum(c.startDate) };
        KARRIERE_ZAHLEN.forEach(function (f) { k[f] = zahl(c[f]); });
        return k;
    }

    function gedenktafeln(liste) {
        if (!Array.isArray(liste)) return [];
        return liste.filter(istObjekt).map(function (t) {
            return { boat: text(t.boat), port: text(t.port) };
        }).filter(function (t) { return t.boat || t.port; });
    }

    /** `sinkings` → aufbereitet, Reihenfolge wie geliefert (Spielreihenfolge). */
    function versenkungen(liste) {
        if (!Array.isArray(liste)) return [];
        return liste.filter(istObjekt).map(function (s) {
            return {
                name: text(s.name),
                grt: zahl(s.grt),
                kindLabel: text(s.kindLabel),
                cargoLabel: text(s.cargoLabel),
                convoy: text(s.convoy),
                destination: text(s.destination),
                patrol: zahl(s.patrol),
                date: kalenderdatum(s.date),
                damagedOnly: s.damagedOnly === true
            };
        });
    }

    function schiffsname(s) {
        return s.name || 'unbekanntes Schiff';
    }

    /** Summe der BRT der versenkten (nicht nur beschädigten) Schiffe mit bekannter Größe. */
    function summeBrt(liste) {
        return liste.reduce(function (summe, s) {
            return summe + (!s.damagedOnly && s.grt ? s.grt : 0);
        }, 0);
    }

    /** Arten der Leistungen (englischer Schlüssel des Spiels) → Gruppe auf der Seite. */
    var LEISTUNGS_GRUPPEN = [
        { schluessel: 'versenkung', titel: 'Versenkungen', passt: function (k) { return /^Sunk Ship /.test(k) && k !== 'Sunk Ship Participation'; } },
        { schluessel: 'beteiligung', titel: 'Beteiligung an Versenkungen', passt: function (k) { return k === 'Sunk Ship Participation'; } },
        { schluessel: 'torpedo', titel: 'Torpedo-Ziellösungen', passt: function (k) { return k === 'Torpedo Course'; } },
        { schluessel: 'auftrag', titel: 'Abgeschlossene Aufträge', passt: function (k) { return k === 'Assignment Completed'; } },
        { schluessel: 'medizin', titel: 'Sanitätsdienst', passt: function (k) { return k === 'Medical'; } }
    ];

    /**
     * Leistungen → [{schluessel, titel, anzahl, eintraege: [{text, anzahl}]}].
     * Feste Reihenfolge, Unbekanntes unter „Weitere Leistungen“.
     * Gleiche Texte werden zusammengefasst („12 ×“).
     */
    function gruppiereLeistungen(liste) {
        var gruppen = LEISTUNGS_GRUPPEN.map(function (g) {
            return { schluessel: g.schluessel, titel: g.titel, passt: g.passt, anzahl: 0, eintraege: [] };
        });
        var weitere = { schluessel: 'weitere', titel: 'Weitere Leistungen', passt: null, anzahl: 0, eintraege: [] };
        (liste || []).forEach(function (a) {
            var ziel = weitere;
            for (var i = 0; i < gruppen.length; i++) {
                if (a.kind && gruppen[i].passt(a.kind)) { ziel = gruppen[i]; break; }
            }
            ziel.anzahl++;
            for (var j = 0; j < ziel.eintraege.length; j++) {
                if (ziel.eintraege[j].text === a.text) { ziel.eintraege[j].anzahl++; return; }
            }
            ziel.eintraege.push({ text: a.text, anzahl: 1 });
        });
        gruppen.push(weitere);
        return gruppen.filter(function (g) { return g.anzahl > 0; }).map(function (g) {
            return { schluessel: g.schluessel, titel: g.titel, anzahl: g.anzahl, eintraege: g.eintraege };
        });
    }

    /** Zahl deutsch, z. B. 1.057,4. */
    function formatZahl(n, nachkomma) {
        if (n === null || n === undefined || !isFinite(n)) return '–';
        var stellen = nachkomma || 0;
        return Number(n).toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
    }

    /** Anteil in Prozent, gerundet, oder null. */
    function quote(treffer, gesamt) {
        if (treffer === null || gesamt === null || !gesamt) return null;
        return Math.round(treffer / gesamt * 100);
    }

    /** Gruppen der UBOAT-Crew in fester Reihenfolge. */
    var UBOAT_GRUPPEN = [
        { schluessel: 'kommandant', typ: 'Kommandant', titel: 'Kommandant', titelMehrzahl: 'Kommandanten' },
        { schluessel: 'offiziere', typ: 'Offizier', titel: 'Offizier', titelMehrzahl: 'Offiziere' },
        { schluessel: 'matrosen', typ: 'Matrose', titel: 'Matrose', titelMehrzahl: 'Matrosen' }
    ];

    /** Crew → [{schluessel, titel, personen}], leere Gruppen entfallen, Unbekanntes unter „Weitere“. */
    function gruppiereCrew(crew) {
        var gruppen = UBOAT_GRUPPEN.map(function (g) {
            return { schluessel: g.schluessel, typ: g.typ, titel: g.titel, titelMehrzahl: g.titelMehrzahl, personen: [] };
        });
        var weitere = { schluessel: 'weitere', typ: null, titel: 'Weitere', titelMehrzahl: 'Weitere', personen: [] };
        crew.forEach(function (p) {
            var ziel = null;
            for (var i = 0; i < gruppen.length; i++) {
                if (gruppen[i].typ === p.typeLabel) { ziel = gruppen[i]; break; }
            }
            (ziel || weitere).personen.push(p);
        });
        gruppen.push(weitere);
        return gruppen.filter(function (g) { return g.personen.length > 0; }).map(function (g) {
            // Erst wer an Bord ist, die Reserve ans Ende; innerhalb nach Name.
            g.personen.sort(function (a, b) {
                return (istReserve(a) - istReserve(b)) || vergleicheNamen(a, b);
            });
            if (g.personen.length > 1) g.titel = g.titelMehrzahl;
            return g;
        });
    }

    /** Stufe und EP nur bei Offizieren und Kommandant. */
    function zeigtStufe(p) {
        return p.typeLabel === 'Offizier' || p.typeLabel === 'Kommandant';
    }

    /** Gefallene: zuletzt Gefallene zuerst, dann nach Name. */
    function sortiereGefallene(liste) {
        function schluessel(p) {
            return p.died ? p.died.jahr * 10000 + p.died.monat * 100 + p.died.tag : -1;
        }
        return liste.slice().sort(function (a, b) {
            return (schluessel(b) - schluessel(a)) || vergleicheNamen(a, b);
        });
    }

    function auszeichnungenText(n) {
        if (!n || n <= 0) return null;
        return n === 1 ? '1 Auszeichnung' : n + ' Auszeichnungen';
    }

    // -------------------------------------------------------------- Laden

    /**
     * Ermittelt die Datenquelle aus der Adresse.
     * `?beispiel` erzwingt die Beispieldaten.
     */
    function beispielErzwungen(suche) {
        return new URLSearchParams(suche || '').has('beispiel');
    }

    function HttpFehler(status, url) {
        var e = new Error('HTTP ' + status + ' für ' + url);
        e.status = status;
        return e;
    }

    function holeJson(url) {
        return fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (antwort) {
            if (!antwort.ok) throw HttpFehler(antwort.status, url);
            return antwort.json();
        });
    }

    /**
     * Lädt eine Datendatei (Pfad relativ zum Zweig `data`, z. B. „uboat/crew.json“).
     * Ergebnis: {json, beispiel: bool, grund: 'erzwungen'|'fehlt'|null}.
     * Fehlt die echte Datei (404), kommen die Beispieldaten aus `beispiel/`.
     * Andere Fehler werden weitergereicht.
     *
     * @param {string} pfad     z. B. 'index.json'
     * @param {string} wurzel   Adresse der Website-Wurzel (für beispiel/), z. B. new URL('../', location.href)
     */
    function ladeDaten(pfad, wurzel) {
        var beispielUrl = new URL('beispiel/' + pfad, wurzel).href;
        if (beispielErzwungen(location.search)) {
            return holeJson(beispielUrl).then(function (json) {
                return { json: json, beispiel: true, grund: 'erzwungen' };
            });
        }
        return holeJson(DATEN_BASIS + pfad).then(function (json) {
            return { json: json, beispiel: false, grund: null };
        }, function (fehler) {
            if (fehler && fehler.status === 404) {
                return holeJson(beispielUrl).then(function (json) {
                    return { json: json, beispiel: true, grund: 'fehlt' };
                });
            }
            throw fehler;
        });
    }

    /** Hängt `?beispiel` an einen Link, wenn die aktuelle Seite im Beispielmodus ist. */
    function mitModus(href) {
        if (typeof location === 'undefined' || !beispielErzwungen(location.search)) return href;
        return href + (href.indexOf('?') >= 0 ? '&' : '?') + 'beispiel';
    }

    // ------------------------------------------------------- DOM-Helfer

    /**
     * Element bauen. Texte immer per textContent, nie als HTML.
     * el('p', {className: 'x'}, 'Text', kindElement)
     */
    function el(tag, eigenschaften) {
        var knoten = document.createElement(tag);
        if (eigenschaften) {
            Object.keys(eigenschaften).forEach(function (k) {
                var v = eigenschaften[k];
                if (v === null || v === undefined || v === false) return;
                if (k === 'className') knoten.className = v;
                else if (k === 'text') knoten.textContent = v;
                else if (k.indexOf('data-') === 0 || k.indexOf('aria-') === 0 || k === 'role' || k === 'title' || k === 'href' || k === 'datetime' || k === 'hidden') knoten.setAttribute(k, v === true ? '' : v);
                else knoten[k] = v;
            });
        }
        for (var i = 2; i < arguments.length; i++) {
            var kind = arguments[i];
            if (kind === null || kind === undefined || kind === false) continue;
            knoten.appendChild(typeof kind === 'string' ? document.createTextNode(kind) : kind);
        }
        return knoten;
    }

    /** Hinweisfeld: art = 'info' | 'warnung' | 'fehler' | 'beispiel'. */
    function hinweis(art, titel, satz) {
        var kinder = [el('strong', { text: titel })];
        if (satz) kinder.push(typeof satz === 'string' ? el('span', { text: ' ' + satz }) : satz);
        return el.apply(null, ['div', { className: 'hinweis hinweis-' + art, role: art === 'fehler' ? 'alert' : 'status' }].concat(kinder));
    }

    function beispielHinweis(grund) {
        var satz = grund === 'erzwungen'
            ? 'Erfundene Namen und Werte zum Ausprobieren, kein echter Spielstand.'
            : 'Es sind noch keine echten Daten veröffentlicht. Bis dahin zeigt die Seite erfundene Namen und Werte.';
        var box = hinweis('beispiel', 'Beispieldaten.', satz);
        if (grund === 'erzwungen') {
            box.appendChild(document.createTextNode(' '));
            box.appendChild(el('a', { href: location.pathname, text: 'Echte Daten ansehen' }));
        }
        return box;
    }

    function schemaHinweis(schema) {
        if (!schema.neuer) return null;
        return hinweis('warnung', 'Neueres Datenformat.',
            'Die Daten haben Version ' + schema.version + ', diese Seite kennt Version ' + SCHEMA_VERSION +
            '. Vielleicht fehlt etwas oder wird falsch angezeigt, bis die Seite aktualisiert ist.');
    }

    function fehlerText(fehler) {
        if (fehler && fehler.status) return 'Der Abruf ist gescheitert (Fehler ' + fehler.status + ').';
        if (fehler && fehler.name === 'SyntaxError') return 'Die Daten sind beschädigt und ließen sich nicht lesen.';
        return 'Die Daten ließen sich nicht laden. Vielleicht ist gerade keine Verbindung da.';
    }

    function fehlerHinweis(fehler, nochmal) {
        var box = hinweis('fehler', 'Gerade nichts zu sehen.', fehlerText(fehler));
        var leiste = el('p', { className: 'hinweis-aktionen' });
        if (nochmal) {
            var knopf = el('button', { type: 'button', className: 'knopf', text: 'Erneut versuchen' });
            knopf.addEventListener('click', nochmal);
            leiste.appendChild(knopf);
        }
        if (!beispielErzwungen(location.search)) {
            leiste.appendChild(el('a', { href: '?beispiel', text: 'Beispieldaten ansehen' }));
        }
        box.appendChild(leiste);
        return box;
    }

    return {
        SCHEMA_VERSION: SCHEMA_VERSION,
        DATEN_BASIS: DATEN_BASIS,
        ALT_AB_MS: ALT_AB_MS,
        SPIELSEITEN: SPIELSEITEN,
        text: text,
        zahl: zahl,
        zeitpunkt: zeitpunkt,
        kalenderdatum: kalenderdatum,
        formatZeitpunkt: formatZeitpunkt,
        formatKalenderdatum: formatKalenderdatum,
        formatVorher: formatVorher,
        istAlt: istAlt,
        suchform: suchform,
        normalisiereIndex: normalisiereIndex,
        normalisiereUboat: normalisiereUboat,
        gruppiereCrew: gruppiereCrew,
        istReserve: istReserve,
        zeigtStufe: zeigtStufe,
        sortiereGefallene: sortiereGefallene,
        auszeichnungenText: auszeichnungenText,
        absaetze: absaetze,
        feindfahrtenText: feindfahrtenText,
        gruppiereLeistungen: gruppiereLeistungen,
        schiffsname: schiffsname,
        summeBrt: summeBrt,
        formatZahl: formatZahl,
        quote: quote,
        beispielErzwungen: beispielErzwungen,
        ladeDaten: ladeDaten,
        mitModus: mitModus,
        el: el,
        hinweis: hinweis,
        beispielHinweis: beispielHinweis,
        schemaHinweis: schemaHinweis,
        fehlerHinweis: fehlerHinweis
    };
});
