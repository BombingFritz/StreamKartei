#!/usr/bin/env node
/*
 * Kleiner statischer Server zum lokalen Testen, ohne Abhängigkeiten.
 *   node tools/serve.js [port]      → http://localhost:8080/
 * Nur für den eigenen Rechner (lauscht auf 127.0.0.1).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPEN = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

http.createServer((anfrage, antwort) => {
    let pfad;
    try {
        pfad = decodeURIComponent(new URL(anfrage.url, 'http://localhost').pathname);
    } catch (e) {
        antwort.writeHead(400); antwort.end('Ungültige Adresse'); return;
    }
    let datei = path.normalize(path.join(WURZEL, pfad));
    if (!datei.startsWith(WURZEL) || /[\\/]\.(git|claude)([\\/]|$)/.test(datei)) {
        antwort.writeHead(403); antwort.end('Verboten'); return;
    }
    fs.stat(datei, (fehler, info) => {
        if (!fehler && info.isDirectory()) {
            if (!pfad.endsWith('/')) {
                antwort.writeHead(301, { Location: pfad + '/' }); antwort.end(); return;
            }
            datei = path.join(datei, 'index.html');
        }
        fs.readFile(datei, (fehler2, inhalt) => {
            if (fehler2) { antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); antwort.end('Nicht gefunden'); return; }
            antwort.writeHead(200, {
                'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            antwort.end(inhalt);
        });
    });
}).listen(PORT, '127.0.0.1', () => {
    console.log('Stream-Kartei lokal: http://localhost:' + PORT + '/  (Beispieldaten: http://localhost:' + PORT + '/?beispiel)');
});
