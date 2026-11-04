# Himmelur v1.8

Sol og måne for valgt sted og dato: opp- og nedgang, høyde og retning nå, daglengde gjennom året, månefase, solverv og jevndøgn.

Appen er én fil, `index.html`, uten byggesteg. Åpne den direkte, eller bruk GitHub Pages.

## Tester
Appen er utviklet med test først (TDD) fra og med v1.7. Testene kjører appens eget skript i en simulert nettleser, så de prøver nøyaktig den koden som ligger i `index.html`.

```
npm test
```

Krever Node 22 eller nyere. Ingen avhengigheter.

| Fil | Hva den tester |
|---|---|
| `test/astronomy.test.js` | Sol, måne, faser, solverv og jevndøgn mot Meeus' eksempler og kjente tider, opp- og nedgang, midnattssol og mørketid |
| `test/helpers.test.js` | Tidssoner og sommertid, ukenummer, formatering, byliste, koordinater, avstand, lagret sted |
| `test/app.test.js` | Klokke, datovalg, kalender, årsslider, stedsvalg, GPS og at ingen tall blir NaN |
| `test/robusthet.test.js` | Ugyldig lagret sted, tastatur, «over horisont» ved oppgang og nedgang, to solnedganger samme døgn, tallrad under diagrammet, kalenderrader, sidens `<head>` |
| `test/release.test.js` | Versjonsnummer og endringslogg er like overalt |
| `test/harness.js` | Den simulerte nettleseren |

Ved ny versjon: skriv testen først, endre så appen, og oppdater versjon i `package.json`, overskriften i `index.html`, endringsloggen i info-vinduet og lista under.

## Versjoner
- **v1.8** – Rettelser: tåler ugyldig lagret sted, tastatur ignoreres i info-vinduet og med Alt/Ctrl/Cmd, «over horisont» skifter ved riktig tidspunkt, begge solnedgangene vises når midnattssolen tar slutt, maks høyde og daglengde under diagrammet med lesbar tekst på mobil, kalenderen viser bare nødvendige uker, ryddig `<head>`.
- **v1.7** – Ingen endringer i hvordan appen virker. Automatiske tester lagt til.
- **v1.6** – Kristiansand er standardby ved første besøk.
- **v1.5** – Døgnkurven står over årsslideren, og viser maks høyde for sol og måne og daglengde.
- **v1.4** – GPS-knapp for egen posisjon, med automatisk oppdatering når tilgang er gitt.
- **v1.3** – Nytt navn: Himmelur (tidligere Sol & Måne).
- **v1.2** – Årsslider med daglengdekurve, større kalender, døgnskive, neste solverv og jevndøgn, info-vindu.
- **v1.1** – Pilknapper for forrige og neste dag.
- **v1.0** – Første versjon.
