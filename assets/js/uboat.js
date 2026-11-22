/* UBOAT-Seite: Besatzung und Ehrentafel aus uboat/crew.json. */
(function () {
    'use strict';
    var K = window.Kartei;
    var el = K.el;
    var wurzel = new URL('../', location.href);

    var hinweise = document.getElementById('hinweise');
    var seite = document.getElementById('seite');
    var gruppenZiel = document.getElementById('gruppen');
    var gefalleneZiel = document.getElementById('gefallene');
    var suche = document.getElementById('suche');
    var filterForm = document.getElementById('filter');
    var ergebnisZeile = document.getElementById('filter-ergebnis');
    var crewAnzahl = document.getElementById('crew-anzahl');

    // Links zur Startseite behalten den Beispielmodus.
    ['zur-start', 'zur-start-fuss'].forEach(function (id) {
        var a = document.getElementById(id);
        if (a) a.setAttribute('href', K.mitModus('../'));
    });

    var karten = [];      // {knoten, suchtext, ort, gruppe}
    var tafeln = [];      // {knoten, suchtext}
    var gruppenKnoten = []; // {knoten, zaehler, schluessel}

    // ------------------------------------------------------------ Kopf

    function setzeZeit(id, datum, mitAlter) {
        var dd = document.getElementById(id);
        dd.textContent = '';
        if (!datum) { dd.textContent = 'unbekannt'; return; }
        dd.appendChild(el('time', { datetime: datum.toISOString(), text: K.formatZeitpunkt(datum) }));
        if (mitAlter) dd.appendChild(el('span', { className: 'alter', text: ' (' + K.formatVorher(datum) + ')' }));
    }

    function zeigeKopf(daten) {
        setzeZeit('stand-gespeichert', daten.savedAt, true);
        setzeZeit('stand-veroeffentlicht', daten.publishedAt, false);
        if (daten.gameVersion) {
            document.getElementById('stand-version').textContent = daten.gameVersion;
            document.getElementById('stand-version-zeile').hidden = false;
        }
    }

    // ------------------------------------------------------- Bausteine

    function marken(titel, liste, art) {
        if (!liste.length) return null;
        return el('div', { className: 'merkmale' },
            el('h4', { className: 'merkmale-titel', text: titel }),
            el.apply(null, ['ul', { className: 'marken marken-' + art }].concat(
                liste.map(function (t) { return el('li', { text: t }); }))));
    }

    function dienstText(p) {
        var teile = [];
        if (p.typeLabel) teile.push(p.typeLabel);
        if (p.classLabel && p.classLabel !== p.typeLabel) teile.push(p.classLabel);
        return teile.join(' · ') || 'ohne Angabe';
    }

    function jahrgang(p) {
        return p.born ? 'Jahrgang ' + p.born.jahr : null;
    }

    function stufeZeile(p) {
        if (!K.zeigtStufe(p)) return null;
        var kinder = [];
        if (p.level !== null) kinder.push(el('span', { className: 'wert' }, 'Stufe ', el('b', { text: String(p.level) })));
        if (p.experiencePoints !== null) {
            var ep = el('span', { className: 'wert' }, el('b', { text: p.experiencePoints.toLocaleString('de-DE') }), ' EP');
            kinder.push(ep);
            if (p.experiencePointsFromLastPatrol) {
                kinder.push(el('span', { className: 'wert wert-plus', title: 'EP aus der letzten Feindfahrt' },
                    '+' + p.experiencePointsFromLastPatrol.toLocaleString('de-DE') + ' letzte Feindfahrt'));
            }
        }
        if (!kinder.length) return null;
        return el.apply(null, ['p', { className: 'karte-stufe' }].concat(kinder));
    }

    /** Orden mit Namen; ohne Namen nur die Anzahl wie bisher. */
    function orden(p) {
        if (p.decorationNames.length) {
            var block = marken('Orden', p.decorationNames, 'orden');
            if (p.decorations !== null && p.decorations > p.decorationNames.length) {
                block.appendChild(el('p', { className: 'merkmale-zusatz', text: 'insgesamt ' + K.auszeichnungenText(p.decorations) }));
            }
            return block;
        }
        return auszeichnungen(p);
    }

    function leistungsGruppe(g) {
        return el('div', { className: 'leistungen leistungen-' + g.schluessel },
            el('h5', { className: 'leistungen-titel' }, g.titel, ' ', el('span', { className: 'anzahl', text: '(' + g.anzahl + ')' })),
            el.apply(null, ['ul', { className: 'leistungen-liste' }].concat(g.eintraege.map(function (e) {
                return el('li', null,
                    e.anzahl > 1 ? el('span', { className: 'leistung-mal', text: e.anzahl + ' × ' }) : null,
                    el('span', { text: e.text }));
            }))));
    }

    /** Aufklappbare Akte: Lebenslauf und Leistungen. Null, wenn nichts da ist. */
    function akte(p) {
        var hatLebenslauf = p.lebenslauf.length > 0;
        var anzahl = p.accomplishments.length;
        if (!hatLebenslauf && !anzahl) return null;
        var teile = [];
        if (hatLebenslauf) teile.push('Lebenslauf');
        if (anzahl) teile.push(anzahl === 1 ? '1 Leistung' : anzahl + ' Leistungen');
        var inhalt = [];
        if (hatLebenslauf) {
            inhalt.push(el.apply(null, ['div', { className: 'lebenslauf' }, el('h4', { className: 'merkmale-titel', text: 'Lebenslauf' })]
                .concat(p.lebenslauf.map(function (absatz) { return el('p', { text: absatz }); }))));
        }
        if (anzahl) {
            inhalt.push(el.apply(null, ['div', { className: 'leistungen-block' }, el('h4', { className: 'merkmale-titel', text: 'Leistungen' })]
                .concat(K.gruppiereLeistungen(p.accomplishments).map(leistungsGruppe))));
        }
        return el.apply(null, ['details', { className: 'akte' },
            el('summary', null, el('span', { className: 'akte-wort', text: 'Akte' }), ' ', el('span', { className: 'akte-inhalt', text: teile.join(' · ') }))]
            .concat(inhalt));
    }

    function auszeichnungen(p) {
        var t = K.auszeichnungenText(p.decorations);
        if (!t) return null;
        var spangen = el('span', { className: 'spangen', 'aria-hidden': 'true' });
        for (var i = 0; i < Math.min(p.decorations, 6); i++) spangen.appendChild(el('i'));
        return el('p', { className: 'karte-auszeichnung' }, spangen, el('span', { text: t }));
    }

    function zustand(p) {
        var liste = el('ul', { className: 'zustand' });
        if (p.statusLabel) {
            var art = p.statusLabel === 'an Bord' ? 'bord' : (p.statusLabel === 'in Reserve' ? 'reserve' : 'sonst');
            liste.appendChild(el('li', { className: 'plakette plakette-' + art, text: p.statusLabel }));
        }
        if (p.woundLabel) {
            liste.appendChild(el('li', { className: 'plakette plakette-wunde', text: p.woundLabel }));
        }
        return liste.childNodes.length ? liste : null;
    }

    function karte(p) {
        var kopf = el('div', { className: 'karte-kopf' },
            el('h3', { className: 'karte-name', text: p.name }),
            zustand(p));
        var dienst = el('p', { className: 'karte-dienst' },
            el('span', { text: dienstText(p) }),
            jahrgang(p) ? el('span', { className: 'karte-jahrgang', title: K.formatKalenderdatum(p.born), text: jahrgang(p) }) : null);
        var klasse = 'karte';
        if (p.woundLabel) klasse += ' karte-verwundet';
        if (p.statusLabel === 'in Reserve') klasse += ' karte-reserve';
        return el('article', { className: klasse },
            kopf, dienst, stufeZeile(p), orden(p),
            marken('Charakter', p.traits, 'charakter'),
            marken('Fähigkeiten', p.skills, 'faehigkeit'),
            akte(p));
    }

    function tafelEintrag(p) {
        var zeile = [dienstText(p)];
        if (p.born) zeile.push('Jahrgang ' + p.born.jahr);
        var t = K.auszeichnungenText(p.decorations);
        if (t && !p.decorationNames.length) zeile.push(t);
        var merkmale = p.traits.concat(p.skills);
        var tafelAkte = akte(p);
        if (tafelAkte) tafelAkte.className += ' akte-tafel';
        return el('li', { className: 'tafel' },
            el('p', { className: 'tafel-name', text: p.name }),
            el('p', { className: 'tafel-dienst', text: zeile.join(' · ') }),
            el('p', { className: 'tafel-tod' }, 'gefallen am ',
                el('time', { datetime: p.died ? [p.died.jahr, ('0' + p.died.monat).slice(-2), ('0' + p.died.tag).slice(-2)].join('-') : null,
                    text: K.formatKalenderdatum(p.died) })),
            p.decorationNames.length ? el('p', { className: 'tafel-orden', text: p.decorationNames.join(' · ') }) : null,
            merkmale.length ? el('p', { className: 'tafel-merkmale', text: merkmale.join(', ') }) : null,
            tafelAkte);
    }

    // ------------------------------------------------- Boot und Karriere

    /** Kennzahl: großer Wert, kleine Beschriftung, optional Zusatz. */
    function kennzahl(beschriftung, wert, zusatz) {
        return el('div', { className: 'kennzahl' },
            el('dt', { text: beschriftung }),
            el('dd', null, el('span', { className: 'kennzahl-wert', text: wert }),
                zusatz ? el('span', { className: 'kennzahl-zusatz', text: ' ' + zusatz }) : null));
    }

    function trefferText(treffer, gesamt) {
        if (treffer === null && gesamt === null) return null;
        var q = K.quote(treffer, gesamt);
        return {
            wert: K.formatZahl(treffer) + ' von ' + K.formatZahl(gesamt),
            zusatz: q === null ? null : '(' + q + ' %)'
        };
    }

    function zeigeBoot(daten) {
        var b = daten.boat;
        var c = daten.career;
        var bootKarte = document.getElementById('boot-karte');
        var karriereZiel = document.getElementById('karriere');
        bootKarte.textContent = '';
        karriereZiel.textContent = '';

        if (b) {
            var zeilen = [];
            if (b.typeLabel) zeilen.push(b.typeLabel);
            if (b.commissioned) zeilen.push('in Dienst gestellt am ' + K.formatKalenderdatum(b.commissioned));
            var zahlen = el('dl', { className: 'kennzahlen' });
            if (b.tonnageSunk !== null) zahlen.appendChild(kennzahl('Versenkte Tonnage', K.formatZahl(b.tonnageSunk), 'BRT'));
            if (b.merchantShipsSunk !== null) zahlen.appendChild(kennzahl('Handelsschiffe versenkt', K.formatZahl(b.merchantShipsSunk)));
            if (b.warshipsSunk !== null) zahlen.appendChild(kennzahl('Kriegsschiffe versenkt', K.formatZahl(b.warshipsSunk)));
            if (b.aircraftShotDown !== null) zahlen.appendChild(kennzahl('Flugzeuge abgeschossen', K.formatZahl(b.aircraftShotDown)));
            bootKarte.appendChild(el('p', { className: 'boot-name', text: b.name || 'Boot ohne Namen' }));
            if (zeilen.length) bootKarte.appendChild(el('p', { className: 'boot-zeile', text: zeilen.join(' · ') }));
            if (zahlen.childNodes.length) bootKarte.appendChild(zahlen);
            bootKarte.hidden = false;
        } else {
            bootKarte.hidden = true;
        }

        if (c) {
            var liste = el('dl', { className: 'kennzahlen kennzahlen-klein' });
            var dazu = function (beschriftung, wert, zusatz) {
                if (wert === null || wert === undefined) return;
                liste.appendChild(kennzahl(beschriftung, wert, zusatz));
            };
            dazu('Karriere seit', c.startDate ? K.formatKalenderdatum(c.startDate) : null);
            dazu('Auftrag Nr.', c.currentPatrol !== null ? K.formatZahl(c.currentPatrol) : null);
            var torpedo = trefferText(c.torpedoHits, c.torpedoesFired);
            if (torpedo) dazu('Torpedotreffer', torpedo.wert, torpedo.zusatz);
            dazu('Weitester Torpedotreffer', c.farthestTorpedoHitM !== null ? K.formatZahl(c.farthestTorpedoHitM) : null, 'm');
            var deck = trefferText(c.deckGunHits, c.deckGunShots);
            if (deck) dazu('Treffer Deckgeschütz', deck.wert, deck.zusatz);
            var flak = trefferText(c.flakHits, c.flakShots);
            if (flak) dazu('Treffer Flak', flak.wert, flak.zusatz);
            dazu('Größte Tiefe', c.maximumDepthM !== null ? K.formatZahl(c.maximumDepthM) : null, 'm');
            dazu('Stunden auf See', c.hoursAtSea !== null ? K.formatZahl(c.hoursAtSea, 1) : null, 'h');
            dazu('davon getaucht', c.hoursUnderWater !== null ? K.formatZahl(c.hoursUnderWater, 1) : null, 'h');
            dazu('Treibstoff verbraucht', c.fuelConsumedLitres !== null ? K.formatZahl(c.fuelConsumedLitres) : null, 'l');
            dazu('Verluste', c.casualties !== null ? K.formatZahl(c.casualties) : null);
            // distanceTravelled: Einheit laut Spec noch ungeklärt, daher nicht angezeigt.
            if (liste.childNodes.length) {
                karriereZiel.appendChild(el('h3', { className: 'unter-titel', text: 'Karriere' }));
                karriereZiel.appendChild(liste);
                karriereZiel.appendChild(el('p', { className: 'fussnote', text: 'Stunden auf See bis zum letzten Einlaufen, ohne die laufende Fahrt.' }));
            }
            karriereZiel.hidden = !liste.childNodes.length;
        } else {
            karriereZiel.hidden = true;
        }

        var tafelnZiel = document.getElementById('gedenktafeln');
        var tafelnListe = document.getElementById('gedenktafeln-liste');
        tafelnListe.textContent = '';
        daten.plaques.forEach(function (t) {
            tafelnListe.appendChild(el('li', null,
                el('span', { className: 'gedenktafel-boot', text: t.boat || 'Boot unbekannt' }),
                t.port ? el('span', { className: 'gedenktafel-ort', text: t.port }) : null));
        });
        tafelnZiel.hidden = daten.plaques.length === 0;

        var sichtbar = !bootKarte.hidden || !karriereZiel.hidden || !tafelnZiel.hidden;
        document.getElementById('boot').hidden = !sichtbar;
        document.getElementById('sprung-boot').hidden = !sichtbar;
    }

    // ------------------------------------------------------ Versenkungen

    function zelle(beschriftung, inhalt, klasse) {
        var td = el('td', { 'data-label': beschriftung, className: klasse || null });
        if (inhalt === null || inhalt === undefined || inhalt === '') {
            td.appendChild(el('span', { className: 'leer-wert', text: '–' }));
            td.className = (td.className ? td.className + ' ' : '') + 'zelle-leer';
        } else if (typeof inhalt === 'string') {
            td.textContent = inhalt;
        } else {
            td.appendChild(inhalt);
        }
        return td;
    }

    function zeigeVersenkungen(liste) {
        var abschnitt = document.getElementById('versenkungen');
        var ziel = document.getElementById('versenkungen-liste');
        ziel.textContent = '';
        document.getElementById('sprung-versenkungen').hidden = liste.length === 0;
        abschnitt.hidden = liste.length === 0;
        if (!liste.length) return;

        var versenkt = liste.filter(function (s) { return !s.damagedOnly; }).length;
        var beschaedigt = liste.length - versenkt;
        document.getElementById('versenkungen-anzahl').textContent = '(' + liste.length + ')';
        var satz = (versenkt === 1 ? '1 Schiff' : versenkt + ' Schiffe') + ' versenkt';
        if (beschaedigt) satz += ', ' + beschaedigt + ' beschädigt';
        var brt = K.summeBrt(liste);
        if (brt) satz += ', zusammen ' + K.formatZahl(brt) + ' BRT mit bekannter Größe';
        document.getElementById('versenkungen-satz').textContent = satz + '. Reihenfolge wie im Spielstand.';

        liste.forEach(function (s, i) {
            var schiff = el('span', { className: s.name ? 'schiff-name' : 'schiff-name schiff-unbekannt', text: K.schiffsname(s) });
            var schiffZelle = el('span', null, schiff,
                s.damagedOnly ? el('span', { className: 'plakette plakette-beschaedigt', text: 'beschädigt' }) : null);
            var zeile = el('tr', { className: s.damagedOnly ? 'nur-beschaedigt' : null },
                zelle('Nr.', String(i + 1), 'zahl spalte-nr'),
                zelle('Datum', s.date ? K.formatKalenderdatum(s.date) : null, 'spalte-datum'),
                zelle('Schiff', schiffZelle, 'spalte-schiff'),
                zelle('Art', s.kindLabel),
                zelle('BRT', s.grt !== null ? K.formatZahl(s.grt) : null, 'zahl'),
                zelle('Ladung', s.cargoLabel),
                zelle('Geleitzug', s.convoy || 'Einzelfahrer'),
                zelle('Ziel', s.destination),
                zelle('Auftrag', s.patrol !== null ? K.formatZahl(s.patrol) : null, 'zahl'));
            ziel.appendChild(zeile);
        });
    }

    // ------------------------------------------------------- Aufbau

    function zeigeCrew(crew) {
        gruppenZiel.textContent = '';
        karten = [];
        gruppenKnoten = [];
        crewAnzahl.textContent = crew.length ? '(' + crew.length + ')' : '';
        if (!crew.length) {
            gruppenZiel.appendChild(K.hinweis('info', 'Keine Besatzung im Spielstand.',
                'Im gelesenen Spielstand ist niemand an Bord oder in Reserve.'));
            filterForm.hidden = true;
            return;
        }
        K.gruppiereCrew(crew).forEach(function (g) {
            var zaehler = el('span', { className: 'anzahl' });
            var raster = el('div', { className: 'karten' });
            var abschnitt = el('section', { className: 'gruppe gruppe-' + g.schluessel, 'aria-label': g.titel },
                el('h3', { className: 'gruppe-titel' }, el('span', { text: g.titel }), ' ', zaehler),
                raster);
            g.personen.forEach(function (p) {
                var k = karte(p);
                raster.appendChild(k);
                karten.push({ knoten: k, suchtext: K.suchform(p.name), ort: p.statusLabel, gruppe: g.schluessel });
            });
            gruppenKnoten.push({ knoten: abschnitt, zaehler: zaehler, schluessel: g.schluessel, gesamt: g.personen.length });
            gruppenZiel.appendChild(abschnitt);
        });
        gruppenZiel.appendChild(el('p', { className: 'leer', id: 'crew-leer', hidden: true, text: 'Niemand passt zu dieser Suche.' }));
    }

    function zeigeGefallene(fallen) {
        gefalleneZiel.textContent = '';
        tafeln = [];
        var vorhandenerLeer = document.getElementById('tafel-leer');
        if (vorhandenerLeer) vorhandenerLeer.remove();
        if (!fallen.length) {
            gefalleneZiel.hidden = true;
            gefalleneZiel.parentNode.appendChild(el('p', { className: 'tafel-ohne', id: 'tafel-leer', text: 'In diesem Spielstand ist bisher niemand gefallen.' }));
            return;
        }
        gefalleneZiel.hidden = false;
        K.sortiereGefallene(fallen).forEach(function (p) {
            var e = tafelEintrag(p);
            gefalleneZiel.appendChild(e);
            tafeln.push({ knoten: e, suchtext: K.suchform(p.name) });
        });
        gefalleneZiel.parentNode.appendChild(el('p', { className: 'tafel-ohne', id: 'tafel-leer', hidden: true, text: 'Kein Gefallener passt zu dieser Suche.' }));
    }

    // ------------------------------------------------------- Filter

    function aktuellerOrt() {
        var gewaehlt = filterForm.querySelector('input[name="ort"]:checked');
        return gewaehlt ? gewaehlt.value : '';
    }

    function filtere() {
        var s = K.suchform(suche.value);
        var ort = aktuellerOrt();
        var sichtbar = 0;
        var jeGruppe = {};
        karten.forEach(function (k) {
            var passt = (!s || k.suchtext.indexOf(s) >= 0) && (!ort || k.ort === ort);
            k.knoten.hidden = !passt;
            if (passt) { sichtbar++; jeGruppe[k.gruppe] = (jeGruppe[k.gruppe] || 0) + 1; }
        });
        gruppenKnoten.forEach(function (g) {
            var n = jeGruppe[g.schluessel] || 0;
            g.knoten.hidden = n === 0;
            g.zaehler.textContent = n === g.gesamt ? '(' + n + ')' : '(' + n + ' von ' + g.gesamt + ')';
        });
        var leer = document.getElementById('crew-leer');
        if (leer) leer.hidden = sichtbar > 0 || !karten.length;

        var tafelSichtbar = 0;
        tafeln.forEach(function (t) {
            var passt = !s || t.suchtext.indexOf(s) >= 0;
            t.knoten.hidden = !passt;
            if (passt) tafelSichtbar++;
        });
        var tafelLeer = document.getElementById('tafel-leer');
        if (tafelLeer && tafeln.length) tafelLeer.hidden = tafelSichtbar > 0;

        var aktiv = s || ort;
        if (!aktiv) {
            ergebnisZeile.textContent = '';
        } else {
            var satz = sichtbar + ' von ' + karten.length + ' in der Besatzung';
            if (s && tafeln.length) satz += ', ' + tafelSichtbar + ' von ' + tafeln.length + ' auf der Ehrentafel';
            ergebnisZeile.textContent = satz + '.';
        }
    }

    filterForm.addEventListener('submit', function (e) { e.preventDefault(); suche.blur(); });
    filterForm.addEventListener('input', filtere);
    filterForm.addEventListener('change', filtere);

    // Suche aus der Adresse übernehmen (#suche=Name), damit man einen Link teilen kann.
    function sucheAusAdresse() {
        var m = /(?:^|[#&])suche=([^&]*)/.exec(location.hash);
        if (m) {
            try { suche.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { /* ungültig: ignorieren */ }
        }
    }

    // ------------------------------------------------------- Laden

    function zeige(ergebnis) {
        var daten = K.normalisiereUboat(ergebnis.json);
        hinweise.textContent = '';
        if (ergebnis.beispiel) hinweise.appendChild(K.beispielHinweis(ergebnis.grund));
        var schema = K.schemaHinweis(daten.schema);
        if (schema) hinweise.appendChild(schema);
        if (K.istAlt(daten.savedAt)) {
            hinweise.appendChild(K.hinweis('info', 'Länger nicht gespielt.',
                daten.savedAt
                    ? 'Der letzte Spielstand ist vom ' + K.formatZeitpunkt(daten.savedAt) + ' (' + K.formatVorher(daten.savedAt) + '). Seitdem kann sich im Spiel einiges geändert haben.'
                    : 'Wann der Spielstand gespeichert wurde, ist nicht bekannt.'));
        }

        zeigeKopf(daten);
        zeigeBoot(daten);
        zeigeCrew(daten.crew);
        zeigeVersenkungen(daten.sinkings);
        zeigeGefallene(daten.fallen);
        seite.hidden = false;
        sucheAusAdresse();
        filtere();
    }

    function lade() {
        hinweise.textContent = '';
        hinweise.appendChild(el('p', { className: 'laedt', text: 'Lade die Besatzungsliste …' }));
        K.ladeDaten('uboat/crew.json', wurzel).then(zeige).catch(function (fehler) {
            hinweise.textContent = '';
            seite.hidden = true;
            ['stand-gespeichert', 'stand-veroeffentlicht'].forEach(function (id) {
                document.getElementById(id).textContent = 'unbekannt';
            });
            hinweise.appendChild(K.fehlerHinweis(fehler, lade));
            if (window.console) console.warn('Stream-Kartei:', fehler);
        });
    }

    lade();
})();
