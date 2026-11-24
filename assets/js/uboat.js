/* UBOAT-Seite: Boot, Besatzung, Karriere, Versenkungen und Ehrentafel aus uboat/crew.json. */
(function () {
    'use strict';
    var K = window.Kartei;
    var el = K.el;
    var wurzel = new URL('../', location.href);

    var hinweise = document.getElementById('hinweise');
    var seite = document.getElementById('seite');
    var gruppenZiel = document.getElementById('gruppen');
    var gefalleneZiel = document.getElementById('gefallene');
    var filterForm = document.getElementById('filter');
    var ergebnisZeile = document.getElementById('filter-ergebnis');
    var crewAnzahl = document.getElementById('crew-anzahl');
    var suchFeld = document.getElementById('suche');

    // Links zur Startseite behalten den Beispielmodus.
    ['zur-start', 'zur-start-fuss'].forEach(function (id) {
        var a = document.getElementById(id);
        if (a) a.setAttribute('href', K.mitModus('../'));
    });

    var karten = [];        // {knoten, ort, gruppe, reserve, name}
    var gruppenKnoten = []; // {knoten, zaehler, schluessel, gesamt, trenner}

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

    function dienstText(p) {
        var teile = [];
        if (p.typeLabel) teile.push(p.typeLabel);
        if (p.classLabel && p.classLabel !== p.typeLabel) teile.push(p.classLabel);
        return teile.join(' · ') || 'ohne Angabe';
    }

    /** Stufe und EP als Formularwert (nur Offiziere und Kommandant). */
    function stufeWert(p) {
        if (!K.zeigtStufe(p)) return null;
        var kinder = [];
        if (p.level !== null) kinder.push('Stufe ' + p.level);
        if (p.experiencePoints !== null) {
            if (kinder.length) kinder.push(' · ');
            kinder.push(K.formatZahl(p.experiencePoints) + ' EP');
            if (p.experiencePointsFromLastPatrol) {
                kinder.push(' ', el('span', { className: 'wert-plus', title: 'EP aus der letzten Feindfahrt',
                    text: '(+' + K.formatZahl(p.experiencePointsFromLastPatrol) + ' letzte Feindfahrt)' }));
            }
        }
        if (!kinder.length) return null;
        return el.apply(null, ['span', null].concat(kinder));
    }

    /** Orden mit Namen; ohne Namen nur die Anzahl. */
    function ordenWert(p) {
        if (p.decorationNames.length) {
            var t = p.decorationNames.join(', ');
            if (p.decorations !== null && p.decorations > p.decorationNames.length) t += ' (insgesamt ' + K.auszeichnungenText(p.decorations) + ')';
            return t;
        }
        return K.auszeichnungenText(p.decorations);
    }

    /** Eine nummerierte Zeile im Formular, wie im Soldbuch. */
    function formularZeile(nr, beschriftung, wert) {
        return el('div', { className: 'zeile' },
            el('dt', null, el('span', { className: 'zeile-nr', 'aria-hidden': 'true', text: String(nr) }), el('span', { text: beschriftung })),
            el('dd', null, wert));
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

    /**
     * Stempel nur für die Verwundung. „an Bord“ und „in Reserve“ zeigt die
     * Sortierung mit der Trennlinie (Wunsch des Nutzers, 22.11.2026).
     */
    function stempel(p) {
        if (!p.woundLabel) return null;
        return el('ul', { className: 'stempel-reihe' },
            el('li', { className: 'stempel stempel-wunde', text: p.woundLabel }));
    }

    /** Personenkarte im Stil einer Soldbuchseite. */
    function karte(p) {
        var zeilen = [['Dienst', dienstText(p)]];
        if (p.born) zeilen.push(['Jahrgang', el('span', { title: K.formatKalenderdatum(p.born), text: String(p.born.jahr) })]);
        var stufe = stufeWert(p);
        if (stufe) zeilen.push(['Stufe', stufe]);
        var orden = ordenWert(p);
        if (orden) zeilen.push(['Orden', orden]);
        // Leere Listen (z. B. noch nicht aufgedeckte Charakterzüge) ohne Zeile.
        if (p.traits.length) zeilen.push(['Charakter', p.traits.join(', ')]);
        if (p.skills.length) zeilen.push(['Fähigkeiten', p.skills.join(', ')]);
        var formular = el('dl', { className: 'formular' });
        zeilen.forEach(function (z, i) { formular.appendChild(formularZeile(i + 1, z[0], z[1])); });

        var klasse = 'karte';
        if (p.woundLabel) klasse += ' karte-verwundet';
        if (p.statusLabel === 'in Reserve') klasse += ' karte-reserve';
        return el('article', { className: klasse },
            el('div', { className: 'karte-kopf' },
                el('p', { className: 'karte-formular', 'aria-hidden': 'true', text: 'Soldbuch' }),
                stempel(p)),
            el('h3', { className: 'karte-name', text: p.name }),
            feindfahrten(p, 'karte-feindfahrten'),
            formular,
            akte(p));
    }

    /** Feindfahrten der Person, prominent unter dem Namen („wichtigster Datenpunkt“, Nutzer 22.11.2026). */
    function feindfahrten(p, klasse) {
        var t = K.feindfahrtenText(p.patrols);
        if (!t) return null;
        return el('p', { className: klasse + (p.patrols === 0 ? ' ' + klasse + '-keine' : '') }, t);
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
            feindfahrten(p, 'tafel-feindfahrten'),
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

    /**
     * Boot oben als Seekarte (Anordnung nach Entwurf des Nutzers, 24.11.2026):
     * erste Zeile Bootsnummer, Kommandant und Nummer der laufenden bzw. letzten
     * Feindfahrt (career.currentPatrol), darunter Typ, Indienststellung und
     * Stärke der Besatzung, dann die Kennzahlen. Gedenktafeln (plaques) zeigt
     * die Seite nicht (Wunsch des Nutzers, 22.11.2026).
     */
    function zeigeBoot(daten) {
        var b = daten.boat;
        var feindfahrt = daten.career ? daten.career.currentPatrol : null;
        var bootKarte = document.getElementById('boot-karte');
        bootKarte.textContent = '';
        var sichtbar = !!b || feindfahrt !== null;
        document.getElementById('boot').hidden = !sichtbar;
        document.getElementById('sprung-boot').hidden = !sichtbar;
        // Die Stärke der Besatzung steht in der Bootskarte, sonst am Titel der Liste.
        crewAnzahl.hidden = sichtbar && daten.crew.length > 0;
        if (!sichtbar) return;

        var kopf = el('div', { className: 'boot-kopf' });
        if (b) kopf.appendChild(el('p', { className: 'boot-name', text: b.name || 'Boot ohne Namen' }));
        var kommandant = kommandantName(daten.crew);
        if (kommandant) kopf.appendChild(el('p', { className: 'boot-kommandant', text: 'KptLn. ' + kommandant }));
        if (feindfahrt !== null) {
            kopf.appendChild(el('p', { className: 'boot-feindfahrt' },
                el('span', { className: 'boot-feindfahrt-nr', text: K.formatZahl(feindfahrt) + '.' }),
                ' ', el('span', { className: 'boot-feindfahrt-wort', text: 'Feindfahrt' })));
        }
        bootKarte.appendChild(kopf);

        var zeile = el('div', { className: 'boot-zeile' });
        var teile = [];
        if (b && b.typeLabel) teile.push(b.typeLabel);
        if (b && b.commissioned) teile.push('in Dienst gestellt am ' + K.formatKalenderdatum(b.commissioned));
        if (teile.length) zeile.appendChild(el('p', { className: 'boot-daten', text: teile.join(' · ') }));
        if (daten.crew.length) {
            zeile.appendChild(el('p', { className: 'boot-besatzung' },
                el('a', { href: '#besatzung', className: 'boot-besatzung-wort', text: 'Besatzung' }), ' ',
                el('span', { className: 'anzahl', text: '(' + daten.crew.length + ')' })));
        }
        if (zeile.childNodes.length) bootKarte.appendChild(zeile);

        if (!b) return;
        var zahlen = el('dl', { className: 'kennzahlen' });
        if (b.tonnageSunk !== null) zahlen.appendChild(kennzahl('Versenkte Tonnage', K.formatZahl(b.tonnageSunk), 'BRT'));
        if (b.merchantShipsSunk !== null) zahlen.appendChild(kennzahl('Handelsschiffe versenkt', K.formatZahl(b.merchantShipsSunk)));
        if (b.warshipsSunk !== null) zahlen.appendChild(kennzahl('Kriegsschiffe versenkt', K.formatZahl(b.warshipsSunk)));
        if (b.aircraftShotDown !== null) zahlen.appendChild(kennzahl('Flugzeuge abgeschossen', K.formatZahl(b.aircraftShotDown)));
        if (zahlen.childNodes.length) bootKarte.appendChild(zahlen);
    }

    /**
     * Name des Kommandanten, wer an Bord ist zuerst. Die Bootskarte setzt
     * „KptLn.“ davor: Das Spiel kennt keine Dienstgrade, ein U-Boot-Kommandant
     * war üblicherweise Kapitänleutnant (Nutzer, 24.11.2026).
     */
    function kommandantName(crew) {
        var k = crew.filter(function (p) { return p.typeLabel === 'Kommandant' && p.name; });
        if (!k.length) return null;
        var anBord = k.filter(function (p) { return p.statusLabel === 'an Bord'; });
        return (anBord.length ? anBord : k)[0].name;
    }

    /**
     * Bilanz der laufenden bzw. letzten Feindfahrt neben der Bootskarte,
     * berechnet aus sinkings[].patrol (Nutzer, 24.11.2026). Verluste je Fahrt
     * stehen nicht in den Daten und fehlen deshalb hier.
     */
    function zeigeFahrt(daten) {
        var blatt = document.getElementById('fahrt');
        var ziel = document.getElementById('fahrt-inhalt');
        ziel.textContent = '';
        var nr = daten.career ? daten.career.currentPatrol : null;
        blatt.hidden = nr === null;
        if (nr === null) return;
        document.getElementById('fahrt-titel').textContent = 'Bilanz der ' + K.formatZahl(nr) + '. Feindfahrt';

        var liste = daten.sinkings.filter(function (s) { return s.patrol === nr; });
        if (!liste.length) {
            ziel.appendChild(el('p', { className: 'fahrt-leer', text: 'Auf dieser Fahrt bisher keine Versenkungen.' }));
            return;
        }
        var versenkt = liste.filter(function (s) { return !s.damagedOnly; }).length;
        var beschaedigt = liste.length - versenkt;
        var zahlen = el('dl', { className: 'kennzahlen kennzahlen-klein fahrt-zahlen' });
        zahlen.appendChild(kennzahl('Schiffe versenkt', K.formatZahl(versenkt)));
        var brt = K.summeBrt(liste);
        if (brt) zahlen.appendChild(kennzahl('Tonnage', K.formatZahl(brt), 'BRT'));
        if (beschaedigt) zahlen.appendChild(kennzahl('beschädigt', K.formatZahl(beschaedigt)));
        var letzte = null;
        liste.forEach(function (s) { if (s.date) letzte = s; });
        if (letzte) zahlen.appendChild(kennzahl('Zuletzt', K.formatKalenderdatum(letzte.date)));
        ziel.appendChild(zahlen);
    }

    /**
     * Karriere als „Leistungen unter Kommandant …“ vor der Besatzung
     * (Nutzer, 24.11.2026).
     */
    function zeigeKarriere(c, crew) {
        var abschnitt = document.getElementById('karriere');
        var kommandant = kommandantName(crew);
        document.getElementById('karriere-titel').textContent =
            kommandant ? 'Leistungen unter Kommandant ' + kommandant : 'Leistungen';
        var ziel = document.getElementById('karriere-inhalt');
        ziel.textContent = '';
        var liste = el('dl', { className: 'kennzahlen kennzahlen-klein' });
        if (c) {
            var dazu = function (beschriftung, wert, zusatz) {
                if (wert === null || wert === undefined) return;
                liste.appendChild(kennzahl(beschriftung, wert, zusatz));
            };
            dazu('Übernahm das Kommando am', c.startDate ? K.formatKalenderdatum(c.startDate) : null);
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
        }
        var sichtbar = liste.childNodes.length > 0;
        if (sichtbar) {
            ziel.appendChild(liste);
            ziel.appendChild(el('p', { className: 'fussnote', text: 'Stunden auf See bis zum letzten Einlaufen, ohne die laufende Fahrt.' }));
        }
        abschnitt.hidden = !sichtbar;
        document.getElementById('sprung-karriere').hidden = !sichtbar;
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
                s.damagedOnly ? el('span', { className: 'stempel stempel-beschaedigt', text: 'beschädigt' }) : null);
            var zeile = el('tr', { className: s.damagedOnly ? 'nur-beschaedigt' : null },
                zelle('Nr.', String(i + 1), 'zahl spalte-nr'),
                zelle('Datum', s.date ? K.formatKalenderdatum(s.date) : null, 'spalte-datum'),
                zelle('Schiff', schiffZelle, 'spalte-schiff'),
                zelle('Art', s.kindLabel),
                zelle('BRT', s.grt !== null ? K.formatZahl(s.grt) : null, 'zahl'),
                zelle('Ladung', s.cargoLabel),
                zelle('Geleitzug', s.convoy || 'Einzelfahrer'),
                zelle('Ziel', s.destination),
                zelle('Feindfahrt', s.patrol !== null ? K.formatZahl(s.patrol) : null, 'zahl'));
            ziel.appendChild(zeile);
        });
    }

    // ------------------------------------------------------ Aktive Mods

    /**
     * Mods des Spielstands unten auf der Seite. Workshop-Mods verlinken auf
     * Steam; im Beispielmodus nicht, weil die Nummern dort erfunden sind.
     */
    function zeigeMods(mods, beispiel) {
        var abschnitt = document.getElementById('mods');
        var ziel = document.getElementById('mods-inhalt');
        ziel.textContent = '';
        var gruppen = K.gruppiereMods(mods);
        var anzahl = gruppen.reduce(function (n, g) { return n + g.mods.length; }, 0);
        abschnitt.hidden = anzahl === 0;
        document.getElementById('sprung-mods').hidden = anzahl === 0;
        if (!anzahl) return;
        document.getElementById('mods-anzahl').textContent = '(' + anzahl + ')';
        ziel.appendChild(el('p', { className: 'mods-satz', text: 'Beim Speichern im Spielstand aktiv, Reihenfolge wie im Spielstand.' }));
        gruppen.forEach(function (g) {
            ziel.appendChild(el('div', { className: 'mods-gruppe mods-' + g.schluessel },
                el('h3', { className: 'merkmale-titel' }, g.titel, ' ', el('span', { className: 'anzahl', text: '(' + g.mods.length + ')' })),
                el.apply(null, ['ol', { className: 'mods-liste' }].concat(g.mods.map(function (m) {
                    var inhalt = m.link && !beispiel
                        ? el('a', { href: m.link, target: '_blank', rel: 'noopener noreferrer', title: 'Im Steam Workshop ansehen', text: m.name })
                        : el('span', { text: m.name });
                    return el('li', null, inhalt);
                })))));
        });
    }

    // ------------------------------------------------------- Aufbau

    /**
     * Besatzung in Gruppen; jede Gruppe ist beim Laden zugeklappt und lässt
     * sich aufklappen (Wunsch des Nutzers, 22.11.2026).
     */
    function zeigeCrew(crew) {
        gruppenZiel.textContent = '';
        karten = [];
        gruppenKnoten = [];
        crewAnzahl.textContent = crew.length ? '(' + crew.length + ')' : '';
        filterForm.querySelector('.filter-ort').hidden = !crew.length;
        if (!crew.length) {
            gruppenZiel.appendChild(K.hinweis('info', 'Keine Besatzung im Spielstand.',
                'Im gelesenen Spielstand ist niemand an Bord oder in Reserve.'));
            return;
        }
        K.gruppiereCrew(crew).forEach(function (g) {
            var zaehler = el('span', { className: 'anzahl' });
            var raster = el('div', { className: 'karten' });
            var abschnitt = el('details', { className: 'gruppe gruppe-' + g.schluessel },
                el('summary', { className: 'gruppe-kopf' },
                    el('h3', { className: 'gruppe-titel' },
                        el('span', { className: 'gruppe-reiter' }, el('span', { className: 'gruppe-name', text: g.titel }), ' ', zaehler))),
                raster);
            // Die Reserve steht am Ende der Gruppe (Sortierung in gruppiereCrew),
            // davor eine Trennlinie, wenn es auch Leute an Bord gibt.
            var trenner = null;
            g.personen.forEach(function (p, i) {
                var reserve = K.istReserve(p) === 1;
                if (reserve && !trenner && i > 0) {
                    trenner = el('p', { className: 'reserve-trenner', text: 'in Reserve' });
                    raster.appendChild(trenner);
                }
                var k = karte(p);
                raster.appendChild(k);
                karten.push({ knoten: k, ort: p.statusLabel, gruppe: g.schluessel, reserve: reserve, name: suchText(p.name) });
            });
            gruppenKnoten.push({ knoten: abschnitt, zaehler: zaehler, schluessel: g.schluessel, gesamt: g.personen.length, trenner: trenner });
            gruppenZiel.appendChild(abschnitt);
        });
        gruppenZiel.appendChild(el('p', { className: 'leer', id: 'crew-leer', hidden: true, text: 'Niemand passt zu diesem Filter.' }));
    }

    function zeigeGefallene(fallen) {
        gefalleneZiel.textContent = '';
        var vorhandenerLeer = document.getElementById('tafel-leer');
        if (vorhandenerLeer) vorhandenerLeer.remove();
        if (!fallen.length) {
            gefalleneZiel.hidden = true;
            gefalleneZiel.parentNode.appendChild(el('p', { className: 'tafel-ohne', id: 'tafel-leer', text: 'In diesem Spielstand ist bisher niemand gefallen.' }));
            return;
        }
        gefalleneZiel.hidden = false;
        K.sortiereGefallene(fallen).forEach(function (p) {
            gefalleneZiel.appendChild(tafelEintrag(p));
        });
    }

    // ------------------------------------------------------- Filter (Aufenthalt und Name)

    /** Für die Suche: klein, ohne Akzente, damit „Muller“ auch „Müller“ findet. */
    function suchText(t) {
        t = String(t || '').toLowerCase();
        return t.normalize ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t;
    }

    function aktuellerOrt() {
        var gewaehlt = filterForm.querySelector('input[name="ort"]:checked');
        return gewaehlt ? gewaehlt.value : '';
    }

    function filtere() {
        var ort = aktuellerOrt();
        var suche = suchText(suchFeld.value.trim());
        var sichtbar = 0;
        var jeGruppe = {};
        var reserveJeGruppe = {};
        karten.forEach(function (k) {
            var passt = (!ort || k.ort === ort) && (!suche || k.name.indexOf(suche) !== -1);
            k.knoten.hidden = !passt;
            if (passt) {
                sichtbar++;
                jeGruppe[k.gruppe] = (jeGruppe[k.gruppe] || 0) + 1;
                if (k.reserve) reserveJeGruppe[k.gruppe] = (reserveJeGruppe[k.gruppe] || 0) + 1;
            }
        });
        gruppenKnoten.forEach(function (g) {
            var n = jeGruppe[g.schluessel] || 0;
            var r = reserveJeGruppe[g.schluessel] || 0;
            g.knoten.hidden = n === 0;
            // Trennlinie nur, wenn oben jemand an Bord und unten jemand in Reserve sichtbar ist.
            if (g.trenner) g.trenner.hidden = r === 0 || r === n;
            g.zaehler.textContent = n === g.gesamt ? '(' + n + ')' : '(' + n + ' von ' + g.gesamt + ')';
        });
        var leer = document.getElementById('crew-leer');
        if (leer) leer.hidden = sichtbar > 0 || !karten.length;
        ergebnisZeile.textContent = ort || suche ? sichtbar + ' von ' + karten.length + ' in der Besatzung.' : '';
        return ort || suche;
    }

    filterForm.addEventListener('submit', function (e) { e.preventDefault(); });
    function filterGeaendert() {
        // Wer gezielt filtert oder sucht, will das Ergebnis sehen: passende Gruppen aufklappen.
        if (filtere()) {
            gruppenKnoten.forEach(function (g) { if (!g.knoten.hidden) g.knoten.open = true; });
        }
    }
    filterForm.addEventListener('change', filterGeaendert);
    suchFeld.addEventListener('input', filterGeaendert);

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
        zeigeFahrt(daten);
        zeigeKarriere(daten.career, daten.crew);
        zeigeCrew(daten.crew);
        zeigeVersenkungen(daten.sinkings);
        zeigeGefallene(daten.fallen);
        zeigeMods(daten.mods, ergebnis.beispiel);
        seite.hidden = false;
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
