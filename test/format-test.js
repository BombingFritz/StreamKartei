#!/usr/bin/env node
/*
 * Prüft die Beispieldaten gegen das Datenformat (Spec stream-kartei.md im
 * Server-Repository) und die Hilfen in assets/js/kartei.js.
 * Ohne Abhängigkeiten: node test/format-test.js
 * Optional eine echte Datei mitprüfen: node test/format-test.js <crew.json> [<index.json>]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const K = require('../assets/js/kartei.js');

const WURZEL = path.join(__dirname, '..');
let fehler = 0;
let geprueft = 0;

function pruefe(bedingung, text) {
    geprueft++;
    if (bedingung) return;
    fehler++;
    console.log('FAIL ' + text);
}
function ok(text) { console.log('OK   ' + text); }

function lies(datei) {
    return JSON.parse(fs.readFileSync(datei, 'utf8'));
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const TYPEN = ['Kommandant', 'Offizier', 'Matrose'];
const ORTE = ['an Bord', 'in Reserve'];
const WUNDEN = ['verwundet', 'im Krankenhaus'];
// Laut Spec nicht in den Daten:
const VERBOTEN = ['type', 'characterClass', 'status', 'wounded', 'login', 'twitch', 'twitchLogin', 'twitchName', 'userLogin', 'userName', 'displayName', 'source', 'file', 'fileName'];

function istIso(w) { return typeof w === 'string' && ISO.test(w) && !isNaN(new Date(w).getTime()); }
function istTag(w) { return typeof w === 'string' && TAG.test(w) && K.kalenderdatum(w) !== null; }
function istZahlOderNull(w) { return w === null || (typeof w === 'number' && isFinite(w)); }
function istTextOderNull(w) { return w === null || typeof w === 'string'; }
function istTextListe(w) { return Array.isArray(w) && w.every(x => typeof x === 'string' && x.trim() !== ''); }

function pruefeVerboten(obj, wo) {
    VERBOTEN.forEach(k => pruefe(!Object.prototype.hasOwnProperty.call(obj, k), wo + ': Feld „' + k + '“ gehört nicht in die Daten'));
}

function pruefePerson(p, wo, gefallen) {
    pruefe(typeof p.name === 'string' && p.name.trim() !== '', wo + ': name ist Text');
    pruefe(TYPEN.includes(p.typeLabel), wo + ': typeLabel bekannt (' + p.typeLabel + ')');
    pruefe(istTextOderNull(p.classLabel), wo + ': classLabel Text oder null');
    pruefe(istZahlOderNull(p.level), wo + ': level Zahl oder null');
    pruefe(p.born === null || istTag(p.born), wo + ': born JJJJ-MM-TT oder null');
    pruefe(istZahlOderNull(p.decorations), wo + ': decorations Zahl oder null');
    pruefe(istTextListe(p.traits), wo + ': traits Textliste');
    pruefe(istTextListe(p.skills), wo + ': skills Textliste');
    pruefeVerboten(p, wo);
    if (gefallen) {
        pruefe(istTag(p.died), wo + ': died JJJJ-MM-TT');
    } else {
        pruefe(istZahlOderNull(p.experiencePoints), wo + ': experiencePoints Zahl oder null');
        pruefe(istZahlOderNull(p.experiencePointsFromLastPatrol), wo + ': experiencePointsFromLastPatrol Zahl oder null');
        pruefe(ORTE.includes(p.statusLabel), wo + ': statusLabel an Bord/in Reserve (' + p.statusLabel + ')');
        pruefe(p.woundLabel === null || WUNDEN.includes(p.woundLabel), wo + ': woundLabel bekannt oder null');
        pruefe(!p.died, wo + ': Lebende haben kein died');
    }
}

function rang(p) { return TYPEN.indexOf(p.typeLabel); }

function pruefeCrewDatei(datei, alsBeispiel) {
    const name = path.relative(WURZEL, datei) || datei;
    const j = lies(datei);
    const vorher = fehler;
    pruefe(j.schemaVersion === 1, name + ': schemaVersion 1');
    pruefe(j.game === 'uboat', name + ': game uboat');
    pruefe(istIso(j.savedAt), name + ': savedAt ISO');
    pruefe(istIso(j.publishedAt), name + ': publishedAt ISO');
    pruefe(istTextOderNull(j.gameVersion), name + ': gameVersion Text oder null');
    pruefe(Array.isArray(j.crew), name + ': crew Liste');
    pruefe(Array.isArray(j.fallen), name + ': fallen Liste');
    pruefeVerboten(j, name);
    (j.crew || []).forEach((p, i) => pruefePerson(p, name + ' crew[' + i + '] ' + p.name, false));
    (j.fallen || []).forEach((p, i) => pruefePerson(p, name + ' fallen[' + i + '] ' + p.name, true));

    // Sortierung laut Spec: Kommandant, Offiziere, Matrosen; innerhalb nach Name.
    const crew = j.crew || [];
    for (let i = 1; i < crew.length; i++) {
        const a = crew[i - 1], b = crew[i];
        const inOrdnung = rang(a) < rang(b) ||
            (rang(a) === rang(b) && a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }) <= 0);
        pruefe(inOrdnung, name + ': Sortierung bei ' + a.name + ' → ' + b.name);
    }
    // Niemand gleichzeitig in crew und fallen.
    const lebende = new Set(crew.map(p => p.name));
    (j.fallen || []).forEach(p => pruefe(!lebende.has(p.name), name + ': ' + p.name + ' steht nicht in crew und fallen'));

    if (alsBeispiel) {
        pruefe(crew.length >= 20 && crew.length <= 30, name + ': etwa 25 Crewmitglieder (' + crew.length + ')');
        pruefe((j.fallen || []).length === 3, name + ': 3 Gefallene');
        pruefe(crew.some(p => p.typeLabel === 'Kommandant'), name + ': mit Kommandant');
        pruefe(crew.some(p => p.statusLabel === 'in Reserve'), name + ': mit Reserve');
        pruefe(crew.some(p => p.woundLabel === 'verwundet') && crew.some(p => p.woundLabel === 'im Krankenhaus'), name + ': mit beiden Verwundungen');
    }
    if (fehler === vorher) ok(name + ' (' + crew.length + ' Crew, ' + (j.fallen || []).length + ' Gefallene)');
    return j;
}

function pruefeIndexDatei(datei) {
    const name = path.relative(WURZEL, datei) || datei;
    const j = lies(datei);
    const vorher = fehler;
    pruefe(j.schemaVersion === 1, name + ': schemaVersion 1');
    pruefe(istIso(j.publishedAt), name + ': publishedAt ISO');
    pruefe(Array.isArray(j.games) && j.games.length > 0, name + ': games nicht leer');
    (j.games || []).forEach((g, i) => {
        const wo = name + ' games[' + i + ']';
        pruefe(typeof g.game === 'string' && /^[a-z0-9-]+$/.test(g.game), wo + ': game Schlüssel');
        pruefe(typeof g.title === 'string' && g.title !== '', wo + ': title');
        pruefe(typeof g.path === 'string' && !g.path.startsWith('/') && !g.path.includes('..'), wo + ': path relativ');
        pruefe(istIso(g.savedAt), wo + ': savedAt ISO');
        pruefe(istIso(g.publishedAt), wo + ': publishedAt ISO');
    });
    if (fehler === vorher) ok(name + ' (' + (j.games || []).length + ' Spiele)');
    return j;
}

// ------------------------------------------------------------ Beispieldaten

const index = pruefeIndexDatei(path.join(WURZEL, 'beispiel', 'index.json'));
const crew = pruefeCrewDatei(path.join(WURZEL, 'beispiel', 'uboat', 'crew.json'), true);
index.games.forEach(g => {
    const datei = path.join(WURZEL, 'beispiel', g.path);
    pruefe(fs.existsSync(datei), 'beispiel/' + g.path + ' existiert');
    if (g.game === 'uboat') {
        pruefe(g.savedAt === crew.savedAt, 'index.json und crew.json: gleiches savedAt');
    }
    pruefe(Object.prototype.hasOwnProperty.call(K.SPIELSEITEN, g.game), 'Seite für ' + g.game + ' vorhanden');
});

// Optional echte Dateien vom Server prüfen.
const extra = process.argv.slice(2);
if (extra[0]) pruefeCrewDatei(path.resolve(extra[0]), false);
if (extra[1]) pruefeIndexDatei(path.resolve(extra[1]));

// ------------------------------------------------------------ Hilfen

(function hilfen() {
    const vorher = fehler;
    // Aufbereitung verträgt fehlende und unbekannte Felder.
    const d = K.normalisiereUboat({
        schemaVersion: 2, neuesFeld: { x: 1 },
        crew: [{ name: 'A', typeLabel: 'Matrose', traits: null, skills: ['  ', 'Gutes Gehör'], extra: 'egal' }, null, 'Unsinn', { typeLabel: 'Passagier' }],
        fallen: 'keine Liste'
    });
    pruefe(d.schema.neuer === true && d.schema.version === 2, 'schemaVersion 2 wird als neuer erkannt');
    pruefe(d.crew.length === 2, 'ungültige Personen werden übersprungen');
    pruefe(d.crew[0].traits.length === 0 && d.crew[0].skills.length === 1, 'Listen werden bereinigt');
    pruefe(d.crew[1].name === 'Unbekannt', 'fehlender Name wird „Unbekannt“');
    pruefe(d.fallen.length === 0, 'fallen ohne Liste wird leer');
    pruefe(d.savedAt === null, 'fehlendes savedAt wird null');
    pruefe(K.istAlt(null), 'unbekanntes Alter gilt als alt');

    const g = K.gruppiereCrew(d.crew);
    pruefe(g.length === 2 && g[0].schluessel === 'matrosen' && g[1].schluessel === 'weitere', 'unbekannter Typ landet unter „Weitere“');
    pruefe(g[0].titel === 'Matrose', 'Gruppentitel in der Einzahl bei einer Person');

    const voll = K.gruppiereCrew(K.normalisiereUboat(crew).crew);
    pruefe(voll.map(x => x.schluessel).join(',') === 'kommandant,offiziere,matrosen', 'Gruppen in fester Reihenfolge');
    pruefe(voll[0].titel === 'Kommandant' && voll[1].titel === 'Offiziere', 'Gruppentitel');

    let warfFehler = false;
    try { K.normalisiereUboat([]); } catch (e) { warfFehler = true; }
    pruefe(warfFehler, 'crew.json als Liste wird abgelehnt');
    warfFehler = false;
    try { K.normalisiereIndex(null); } catch (e) { warfFehler = true; }
    pruefe(warfFehler, 'index.json null wird abgelehnt');

    const idx = K.normalisiereIndex({ schemaVersion: 1, games: [{ game: 'uboat', title: 'UBOAT' }, { game: 'rimworld' }, { game: 'constructor' }] });
    pruefe(idx.games[0].seite === 'uboat/', 'UBOAT hat eine Seite');
    pruefe(idx.games[1].seite === null && idx.games[1].title === 'rimworld', 'unbekanntes Spiel ohne Seite, Titel aus Schlüssel');
    pruefe(idx.games[2].seite === null, 'kein Zugriff auf Object-Prototyp über game');

    // Datum und Zeit
    pruefe(K.formatKalenderdatum(K.kalenderdatum('1942-03-02')) === '2. März 1942', 'Kalenderdatum deutsch');
    pruefe(K.kalenderdatum('1942-13-02') === null && K.kalenderdatum('Unsinn') === null, 'ungültiges Kalenderdatum wird null');
    pruefe(K.formatZeitpunkt(new Date('2026-11-20T21:47:12.000Z')) === '20. November 2026, 22:47 Uhr', 'Zeitpunkt in deutscher Zeit (Winter)');
    pruefe(K.formatZeitpunkt(new Date('2026-07-01T10:05:00.000Z')) === '1. Juli 2026, 12:05 Uhr', 'Zeitpunkt in deutscher Zeit (Sommer)');
    const jetzt = new Date('2026-11-21T12:00:00Z');
    pruefe(K.formatVorher(new Date('2026-11-21T11:59:40Z'), jetzt) === 'gerade eben', 'vorher: gerade eben');
    pruefe(K.formatVorher(new Date('2026-11-21T11:00:00Z'), jetzt) === 'vor 1 Stunde', 'vorher: Stunde');
    pruefe(K.formatVorher(new Date('2026-11-18T12:00:00Z'), jetzt) === 'vor 3 Tagen', 'vorher: Tage');
    pruefe(!K.istAlt(new Date('2026-11-15T12:00:00Z'), jetzt), '6 Tage: nicht alt');
    pruefe(K.istAlt(new Date('2026-11-14T11:59:00Z'), jetzt), 'über 7 Tage: alt');

    // Suche
    pruefe(K.suchform('Möwe') === 'moewe' && K.suchform('MOEWE') === 'moewe', 'Suche: Umlaute');
    pruefe(K.suchform('Kombüsen König!') === 'kombuesenkoenig', 'Suche: Leer- und Satzzeichen');
    pruefe(K.suchform('Schraubenschlüssel').indexOf(K.suchform('schlüssel')) >= 0, 'Suche: Teilwort');

    // Stufe nur bei Offizieren und Kommandant
    pruefe(K.zeigtStufe({ typeLabel: 'Offizier' }) && K.zeigtStufe({ typeLabel: 'Kommandant' }) && !K.zeigtStufe({ typeLabel: 'Matrose' }), 'Stufe nur bei Offizieren und Kommandant');

    // Ehrentafel: zuletzt Gefallene zuerst
    const tafel = K.sortiereGefallene(K.normalisiereUboat(crew).fallen).map(p => p.name);
    pruefe(tafel.join(',') === 'Morsezeichen,Wellenbrecher,Klabautermann', 'Ehrentafel-Reihenfolge');

    pruefe(K.auszeichnungenText(0) === null && K.auszeichnungenText(1) === '1 Auszeichnung' && K.auszeichnungenText(3) === '3 Auszeichnungen', 'Auszeichnungen');
    pruefe(K.beispielErzwungen('?beispiel') && K.beispielErzwungen('?a=1&beispiel=1') && !K.beispielErzwungen('?x=1'), 'Beispielmodus aus der Adresse');

    if (fehler === vorher) ok('Hilfen in assets/js/kartei.js');
})();

// ------------------------------------------------------------ Seiten

(function seiten() {
    const vorher = fehler;
    const dateien = ['index.html', 'uboat/index.html', 'assets/js/kartei.js', 'assets/js/start.js', 'assets/js/uboat.js'];
    dateien.forEach(d => {
        const inhalt = fs.readFileSync(path.join(WURZEL, d), 'utf8');
        pruefe(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(inhalt), d + ': kein HTML aus Daten');
        pruefe(!/document\.cookie|localStorage|sessionStorage|navigator\.sendBeacon/.test(inhalt), d + ': keine Cookies, kein Speicher, kein Beacon');
        if (d.endsWith('.html')) {
            const fremd = (inhalt.match(/<(script|link)[^>]+(src|href)="(https?:)?\/\/[^"]+"/g) || []);
            pruefe(fremd.length === 0, d + ': keine fremden Skripte oder Stile');
        }
    });
    if (fehler === vorher) ok('Seiten ohne innerHTML, Cookies und fremde Skripte');
})();

console.log((fehler ? 'FEHLER: ' + fehler : 'Alles in Ordnung') + ' (' + geprueft + ' Prüfungen)');
process.exit(fehler ? 1 : 0);
