/* Startseite: Spiele aus index.json als Kacheln. */
(function () {
    'use strict';
    var K = window.Kartei;
    var el = K.el;
    var wurzel = new URL('./', location.href);
    var hinweise = document.getElementById('hinweise');
    var ziel = document.getElementById('spiele');

    function kachel(spiel) {
        var stand = el('p', { className: 'kachel-stand' },
            'Spielstand vom ',
            el('time', { datetime: spiel.savedAt ? spiel.savedAt.toISOString() : null, text: K.formatZeitpunkt(spiel.savedAt) }));
        var kinder = [
            el('h3', { className: 'kachel-titel', text: spiel.title }),
            stand
        ];
        if (spiel.savedAt) kinder.push(el('p', { className: 'kachel-alter', text: K.formatVorher(spiel.savedAt) }));
        if (spiel.seite) {
            kinder.push(el('span', { className: 'kachel-pfeil', 'aria-hidden': 'true', text: 'Zur Seite →' }));
            return el.apply(null, ['a', { className: 'kachel kachel-' + (spiel.game || 'spiel'), href: K.mitModus(spiel.seite) }].concat(kinder));
        }
        kinder.push(el('span', { className: 'kachel-pfeil', text: 'Seite folgt' }));
        return el.apply(null, ['div', { className: 'kachel kachel-ohne-seite' }].concat(kinder));
    }

    function zeige(ergebnis) {
        var daten = K.normalisiereIndex(ergebnis.json);
        hinweise.textContent = '';
        if (ergebnis.beispiel) hinweise.appendChild(K.beispielHinweis(ergebnis.grund));
        var schema = K.schemaHinweis(daten.schema);
        if (schema) hinweise.appendChild(schema);

        ziel.textContent = '';
        ziel.removeAttribute('aria-busy');
        if (daten.games.length === 0) {
            ziel.appendChild(K.hinweis('info', 'Noch nichts veröffentlicht.',
                'Sobald ein Spielstand eingelesen ist, erscheint das Spiel hier.'));
            return;
        }
        daten.games.forEach(function (spiel) { ziel.appendChild(kachel(spiel)); });
    }

    function lade() {
        ziel.setAttribute('aria-busy', 'true');
        ziel.textContent = '';
        ziel.appendChild(el('p', { className: 'laedt', text: 'Lade Spiele …' }));
        K.ladeDaten('index.json', wurzel).then(zeige).catch(function (fehler) {
            ziel.textContent = '';
            ziel.removeAttribute('aria-busy');
            ziel.appendChild(K.fehlerHinweis(fehler, lade));
            if (window.console) console.warn('Stream-Kartei:', fehler);
        });
    }

    lade();
})();
