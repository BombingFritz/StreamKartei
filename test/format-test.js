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
    // Stufe 1c: Feindfahrten der Person (Anzahl, 0 möglich; null ohne Verlauf)
    pruefe(p.patrols === null || (Number.isInteger(p.patrols) && p.patrols >= 0), wo + ': patrols ganze Zahl ab 0 oder null');
    // Stufe 1b: Akte
    pruefe(p.background === null || (typeof p.background === 'string' && p.background.trim() !== ''), wo + ': background Text oder null');
    pruefe(istTextListe(p.decorationNames), wo + ': decorationNames Textliste');
    pruefe(Array.isArray(p.decorationNames) && p.decorations !== null && p.decorationNames.length <= p.decorations, wo + ': nicht mehr Ordensnamen als decorations');
    pruefe(Array.isArray(p.accomplishments) && p.accomplishments.every(a =>
        a && typeof a === 'object' && istTextOderNull(a.kind) && typeof a.text === 'string' && a.text.trim() !== ''), wo + ': accomplishments [{kind, text}]');
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

const BOOT_ZAHLEN = ['tonnageSunk', 'merchantShipsSunk', 'warshipsSunk', 'aircraftShotDown'];
const KARRIERE_ZAHLEN = ['currentPatrol', 'torpedoesFired', 'torpedoHits', 'farthestTorpedoHitM', 'deckGunShots', 'deckGunHits',
    'flakShots', 'flakHits', 'distanceTravelled', 'fuelConsumedLitres', 'maximumDepthM', 'hoursUnderWater', 'hoursAtSea', 'casualties'];

/** Stufe 1b: boat, career, plaques, sinkings. */
function pruefeBootUndKarriere(j, name) {
    const b = j.boat;
    pruefe(b === null || (typeof b === 'object' && !Array.isArray(b)), name + ': boat Objekt oder null');
    if (b) {
        pruefe(istTextOderNull(b.name) && istTextOderNull(b.typeLabel), name + ': boat name/typeLabel Text oder null');
        pruefe(b.commissioned === null || istTag(b.commissioned), name + ': boat.commissioned JJJJ-MM-TT oder null');
        BOOT_ZAHLEN.forEach(f => pruefe(istZahlOderNull(b[f]), name + ': boat.' + f + ' Zahl oder null'));
    }
    const c = j.career;
    pruefe(c === null || (typeof c === 'object' && !Array.isArray(c)), name + ': career Objekt oder null');
    if (c) {
        pruefe(c.startDate === null || istTag(c.startDate), name + ': career.startDate JJJJ-MM-TT oder null');
        KARRIERE_ZAHLEN.forEach(f => pruefe(istZahlOderNull(c[f]), name + ': career.' + f + ' Zahl oder null'));
        pruefe(c.torpedoHits === null || c.torpedoesFired === null || c.torpedoHits <= c.torpedoesFired, name + ': nicht mehr Torpedotreffer als Schüsse');
    }
    pruefe(Array.isArray(j.plaques) && j.plaques.every(t => t && istTextOderNull(t.boat) && istTextOderNull(t.port)), name + ': plaques [{boat, port}]');
    pruefe(Array.isArray(j.sinkings), name + ': sinkings Liste');
    (j.sinkings || []).forEach((s, i) => {
        const wo = name + ' sinkings[' + i + ']';
        pruefe(istTextOderNull(s.name), wo + ': name Text oder null');
        pruefe(istZahlOderNull(s.grt) && istZahlOderNull(s.patrol), wo + ': grt/patrol Zahl oder null');
        ['kindLabel', 'cargoLabel', 'convoy', 'destination'].forEach(f => pruefe(istTextOderNull(s[f]), wo + ': ' + f + ' Text oder null'));
        pruefe(s.date === null || istTag(s.date), wo + ': date JJJJ-MM-TT oder null');
        pruefe(typeof s.damagedOnly === 'boolean', wo + ': damagedOnly Wahrheitswert');
    });

    // Aktive Mods (Spec „Aktive Mods“): Liste oder null; Feld darf in alten Veröffentlichungen fehlen
    if (j.mods !== undefined && j.mods !== null) {
        pruefe(Array.isArray(j.mods), name + ': mods Liste oder null');
        (Array.isArray(j.mods) ? j.mods : []).forEach((m, i) => {
            const wo = name + ' mods[' + i + '] ' + (m && m.id);
            pruefe(m && typeof m.id === 'string' && m.id !== '' && typeof m.name === 'string' && m.name !== '', wo + ': id und name');
            pruefe(['game', 'dlc', 'workshop', 'other'].includes(m.kind), wo + ': kind bekannt');
            pruefe(m.workshopId === null || /^\d+$/.test(m.workshopId), wo + ': workshopId Ziffern oder null');
            pruefe((m.kind === 'workshop') === /^steam:\d+$/.test(m.id), wo + ': workshop genau bei steam:-ID');
            if (m.kind === 'workshop') pruefe(m.id === 'steam:' + m.workshopId, wo + ': workshopId passt zur id');
            if (m.kind === 'dlc') pruefe(/^uboat\.dlc\./.test(m.id), wo + ': DLC-ID beginnt mit uboat.dlc.');
            if (m.kind === 'game') pruefe(m.id === 'uboat', wo + ': Spiel hat id uboat');
        });
        pruefe(Array.isArray(j.mods) && j.mods.some(m => m.id === 'uboat'), name + ': mods enthält uboat');
    }
}

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
    pruefeBootUndKarriere(j, name);

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
        // Stufe 1b: die Beispiele decken die Sonderfälle ab
        const kommandant = crew.find(p => p.typeLabel === 'Kommandant');
        pruefe(kommandant && kommandant.accomplishments.length >= 20, name + ': Kommandant mit langer Liste von Leistungen');
        pruefe(crew.some(p => p.background) && crew.some(p => p.background === null), name + ': mit und ohne Lebenslauf');
        pruefe(crew.some(p => p.background && p.background.includes('\n')), name + ': Lebenslauf mit Absätzen');
        pruefe(crew.some(p => p.decorations > 0 && p.decorationNames.length === 0), name + ': Orden ohne Namen (Rückfall auf Anzahl)');
        pruefe(crew.some(p => p.accomplishments.some(a => !['Sunk Ship Freighter', 'Sunk Ship Tanker', 'Sunk Ship Destroyer', 'Sunk Ship Participation',
            'Torpedo Course', 'Assignment Completed', 'Medical'].includes(a.kind))), name + ': Leistung unbekannter Art');
        pruefe(j.boat && j.career && j.plaques.length > 0, name + ': mit Boot, Karriere und Gedenktafel');
        // Stufe 1c: alle Fälle von patrols
        const fahrten = crew.map(p => p.patrols);
        pruefe(fahrten.includes(0) && fahrten.includes(1) && fahrten.some(n => n > 1) && fahrten.includes(null), name + ': patrols mit 0, 1, mehreren und null');
        pruefe(crew.every(p => p.patrols === null || p.patrols <= j.career.currentPatrol), name + ': niemand hat mehr Feindfahrten als das Boot');
        pruefe((j.fallen || []).every(p => 'patrols' in p), name + ': auch Gefallene haben patrols');
        // Aktive Mods: alle Arten vertreten
        const arten = (j.mods || []).map(m => m.kind);
        pruefe(['game', 'dlc', 'workshop', 'other'].every(a => arten.includes(a)), name + ': mods mit allen Arten');
        const s = j.sinkings || [];
        pruefe(s.length >= 8, name + ': mehrere Versenkungen');
        pruefe(s.some(x => x.name === null) && s.some(x => x.damagedOnly) && s.some(x => x.date === null) && s.some(x => x.convoy === null) && s.some(x => x.kindLabel === null),
            name + ': Versenkungen mit fehlenden Werten und nur beschädigt');
        const versenkt = s.filter(x => !x.damagedOnly);
        pruefe(j.boat.tonnageSunk === versenkt.reduce((a, x) => a + (x.grt || 0), 0), name + ': Tonnage passt zu den Versenkungen');
        pruefe(K.summeBrt(K.normalisiereUboat(j).sinkings) === j.boat.tonnageSunk, name + ': summeBrt passt');
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
    // Reserve je Gruppe am Ende, sonst nach Name (Nutzer, 22.11.2026)
    voll.forEach(gr => {
        const reserveAb = gr.personen.findIndex(p => K.istReserve(p) === 1);
        pruefe(reserveAb === -1 || gr.personen.slice(reserveAb).every(p => K.istReserve(p) === 1), 'Gruppe ' + gr.schluessel + ': Reserve am Ende');
    });
    const gemischt = K.gruppiereCrew(K.normalisiereUboat({ crew: [
        { name: 'Anton', typeLabel: 'Matrose', statusLabel: 'in Reserve' },
        { name: 'Berta', typeLabel: 'Matrose', statusLabel: 'an Bord' },
        { name: 'Cäsar', typeLabel: 'Matrose', statusLabel: 'in Reserve' },
        { name: 'Dora', typeLabel: 'Matrose', statusLabel: 'an Bord' },
        { name: 'Emil', typeLabel: 'Matrose', statusLabel: null }
    ] }).crew)[0].personen.map(p => p.name).join(',');
    pruefe(gemischt === 'Berta,Dora,Emil,Anton,Cäsar', 'Reihenfolge: an Bord und ohne Angabe nach Name, dann Reserve nach Name (' + gemischt + ')');
    pruefe(voll[2].personen.some(p => K.istReserve(p) === 1), 'Beispiel: Matrosen mit Reserve');

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

    // Stufe 1b: alte Daten ohne die neuen Felder bleiben lesbar
    const alt = K.normalisiereUboat({ schemaVersion: 1, crew: [{ name: 'A', typeLabel: 'Matrose', decorations: 1 }] });
    pruefe(alt.boat === null && alt.career === null && alt.plaques.length === 0 && alt.sinkings.length === 0, 'ohne Boot und Karriere: null bzw. leer');
    pruefe(alt.crew[0].lebenslauf.length === 0 && alt.crew[0].decorationNames.length === 0 && alt.crew[0].accomplishments.length === 0, 'ohne Akte: leer');

    // Stufe 1c: Feindfahrten je Person
    pruefe(alt.crew[0].patrols === null, 'ohne patrols: null');
    const pf = K.normalisiereUboat({ crew: [{ name: 'A', patrols: 3 }, { name: 'B', patrols: 0 }, { name: 'C', patrols: -1 }, { name: 'D', patrols: 1.5 }, { name: 'E', patrols: '2' }] }).crew.map(p => p.patrols);
    pruefe(pf.join(',') === '3,0,,,2', 'patrols: ganze Zahlen ab 0, sonst null (' + pf.join(',') + ')');
    pruefe(K.feindfahrtenText(3) === '3 Feindfahrten' && K.feindfahrtenText(1) === '1 Feindfahrt' && K.feindfahrtenText(0) === 'noch keine Feindfahrt' && K.feindfahrtenText(null) === null, 'Feindfahrten als Text');

    // Lebenslauf: _x000D_ aus dem Spiel und Zeilenumbrüche
    const abs = K.absaetze('Erster Satz._x000D__x000D__x000D_\r\nZweiter   Absatz.\n\n_x000D_');
    pruefe(abs.length === 2 && abs[0] === 'Erster Satz.' && abs[1] === 'Zweiter Absatz.', 'Lebenslauf: _x000D_ entfernt, Absätze getrennt');
    pruefe(K.absaetze(null).length === 0 && K.absaetze('   ').length === 0, 'Lebenslauf leer');

    // Leistungen gruppieren
    const lg = K.gruppiereLeistungen([
        { kind: 'Torpedo Course', text: 'T1' }, { kind: 'Sunk Ship Freighter', text: 'V1' },
        { kind: 'Assignment Completed', text: 'Auftrag abgeschlossen.' }, { kind: 'Assignment Completed', text: 'Auftrag abgeschlossen.' },
        { kind: 'Sunk Ship Participation', text: 'B1' }, { kind: 'Sunk Ship Submarine', text: 'V2' },
        { kind: 'Neu', text: 'X' }, { kind: null, text: 'Y' }, { kind: 'Medical', text: 'M' }
    ]);
    pruefe(lg.map(g => g.schluessel).join(',') === 'versenkung,beteiligung,torpedo,auftrag,medizin,weitere', 'Leistungen: feste Reihenfolge, Unbekanntes zuletzt');
    pruefe(lg[0].anzahl === 2, 'Leistungen: neue „Sunk Ship …“-Arten zählen als Versenkung');
    pruefe(lg[3].anzahl === 2 && lg[3].eintraege.length === 1 && lg[3].eintraege[0].anzahl === 2, 'Leistungen: gleiche Texte zusammengefasst');
    pruefe(lg[5].anzahl === 2, 'Leistungen: unbekannte und fehlende Art unter „Weitere“');
    const leist = K.normalisiereUboat({ crew: [{ name: 'A', accomplishments: [null, { kind: 'X' }, { kind: 'Y', text: ' ok ' }, 'Unsinn'] }] }).crew[0].accomplishments;
    pruefe(leist.length === 1 && leist[0].text === 'ok', 'Leistungen ohne Text werden übersprungen');

    // Boot, Karriere, Versenkungen
    const bk = K.normalisiereUboat({ boat: { name: 'U-1', commissioned: 'Unsinn', tonnageSunk: '12' }, career: [], plaques: [null, {}, { port: 'Kiel' }],
        sinkings: [{ name: null, grt: null, damagedOnly: 'ja' }, { name: 'B', grt: 100 }, { name: 'C', grt: 50, damagedOnly: true }, 'Unsinn'] });
    pruefe(bk.boat.name === 'U-1' && bk.boat.commissioned === null && bk.boat.tonnageSunk === 12, 'Boot: Werte aufbereitet');
    pruefe(bk.career === null, 'Karriere als Liste wird null');
    pruefe(bk.plaques.length === 1 && bk.plaques[0].port === 'Kiel', 'Gedenktafeln: leere Einträge entfallen');
    pruefe(bk.sinkings.length === 3 && bk.sinkings[0].damagedOnly === false, 'Versenkungen: damagedOnly nur bei true');
    pruefe(K.schiffsname(bk.sinkings[0]) === 'unbekanntes Schiff' && K.schiffsname(bk.sinkings[1]) === 'B', 'Schiff ohne Namen');
    pruefe(K.summeBrt(bk.sinkings) === 100, 'BRT ohne beschädigte und unbekannte');
    pruefe(K.formatZahl(1057.4, 1) === '1.057,4' && K.formatZahl(209034) === '209.034' && K.formatZahl(null) === '–', 'Zahlen deutsch');
    pruefe(K.quote(35, 51) === 69 && K.quote(1, 0) === null && K.quote(null, 5) === null, 'Trefferquote');

    // Aktive Mods
    pruefe(K.normalisiereUboat({}).mods === null && K.normalisiereUboat({ mods: null }).mods === null && K.normalisiereUboat({ mods: 'x' }).mods === null, 'mods fehlt/null/kaputt: null');
    const md = K.normalisiereUboat({ mods: [
        { id: 'uboat', name: 'uboat', kind: 'game', workshopId: null },
        { id: 'uboat.dlc.type-ix', kind: 'dlc' },
        { id: 'steam:42', name: 'Eine Mod', kind: 'workshop', workshopId: '42' },
        { id: 'steam:43', name: 'Falsche Nummer', kind: 'workshop', workshopId: '43; javascript:' },
        { id: 'lokal', kind: 'neu' }, null, { name: 'ohne id' }
    ] }).mods;
    pruefe(md.length === 5, 'mods: Einträge ohne id entfallen');
    pruefe(md[1].name === 'uboat.dlc.type-ix' && md[4].kind === 'other' && md[3].workshopId === null, 'mods: Name aus id, unbekannte Art „other“, ungültige workshopId null');
    pruefe(K.dlcName('uboat.dlc.type-ix') === 'Typ IX' && K.dlcName('uboat.dlc.type-viic41') === 'Typ VIIC41' && K.dlcName('uboat.dlc.wolf-pack') === 'Wolf Pack', 'DLC-Namen hübsch');
    pruefe(K.steamLink('42') === 'https://steamcommunity.com/sharedfiles/filedetails/?id=42' && K.steamLink(null) === null, 'Steam-Link');
    const mg = K.gruppiereMods(md);
    pruefe(mg.map(g => g.schluessel).join(',') === 'dlc,workshop,other', 'Mods gruppiert: DLC, Workshop, Sonstige; Spiel entfällt');
    pruefe(mg[0].mods[0].name === 'Typ IX' && mg[1].mods[0].link && !mg[1].mods[1].link, 'Mods: DLC-Name, Link nur mit gültiger Nummer');
    pruefe(K.gruppiereMods(null).length === 0, 'Mods null: keine Gruppen');

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
    // Kopf (Nutzer, 24.11.2026): kein „Stream-Kartei“ mehr als Text, Stempel „Streng geheim“,
    // Überschrift der Startseite „Aktenauskunft der Kriegsmarine“ (Tab-Titel seit 24.11.2026 „Streamkartei - BombingFritz“)
    ['index.html', 'uboat/index.html'].forEach(d => {
        const kopf = (fs.readFileSync(path.join(WURZEL, d), 'utf8').match(/<header[\s\S]*?<\/header>/) || [''])[0];
        pruefe(!/Stream-Kartei/.test(kopf), d + ': kein „Stream-Kartei“ im Kopf');
    });
    pruefe(/<h1>Aktenauskunft der Kriegsmarine<\/h1>/.test(fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8')), 'Startseite: Titel „Aktenauskunft der Kriegsmarine“');
    pruefe(/content: "Streng geheim"/.test(fs.readFileSync(path.join(WURZEL, 'assets/css/kartei.css'), 'utf8')), 'Stempel „Streng geheim“');

    // Wünsche des Nutzers vom 22.11.2026 für die UBOAT-Seite
    const uboatHtml = fs.readFileSync(path.join(WURZEL, 'uboat/index.html'), 'utf8');
    const uboatJs = fs.readFileSync(path.join(WURZEL, 'assets/js/uboat.js'), 'utf8');
    pruefe(/id="suche"/.test(uboatHtml), 'UBOAT: dezente Namenssuche im Filterblatt (Nutzer, 24.11.2026; ersetzt „keine Namenssuche“ vom 22.11.)');
    pruefe(!/gedenktafel/i.test(uboatHtml) && !/\.plaques\b/.test(uboatJs), 'UBOAT: keine Gedenktafeln');
    pruefe(uboatHtml.includes('Gefallene Besatzungsmitglieder'), 'UBOAT: Text der Ehrentafel');
    pruefe(uboatHtml.indexOf('id="karriere"') < uboatHtml.indexOf('id="besatzung"'), 'UBOAT: Leistungen (Karriere) vor der Besatzung (Nutzer, 24.11.2026)');
    pruefe(!/stempel-(bord|reserve)/.test(uboatJs), 'UBOAT: keine Stempel für an Bord und in Reserve');
    pruefe(/el\('details', \{ className: 'gruppe /.test(uboatJs) && !/'gruppe[^']*', open/.test(uboatJs), 'UBOAT: Gruppen aufklappbar und beim Laden zu');
    pruefe(/currentPatrol/.test(uboatJs) && /Feindfahrt/.test(uboatJs), 'UBOAT: Feindfahrt beim Boot');

    if (fehler === vorher) ok('Seiten ohne innerHTML, Cookies und fremde Skripte; UBOAT-Aufbau wie gewünscht');
})();

console.log((fehler ? 'FEHLER: ' + fehler : 'Alles in Ordnung') + ' (' + geprueft + ' Prüfungen)');
process.exit(fehler ? 1 : 0);
