# Fuentes requeridas para generación de PDF (pdfmake)

`pdfmake` genera PDFs en el servidor a través de `pdfmake/src/printer`, que
usa `pdfkit` internamente y requiere archivos `.ttf` reales en disco (el
paquete npm solo incluye las fuentes en base64 dentro del bundle de
navegador, no como archivos sueltos para Node).

Coloca aquí las 4 variantes de **Roboto** (fuente libre de Google):

```
assets/fonts/Roboto-Regular.ttf
assets/fonts/Roboto-Medium.ttf
assets/fonts/Roboto-Italic.ttf
assets/fonts/Roboto-MediumItalic.ttf
```

Descárgalas desde https://fonts.google.com/specimen/Roboto (o desde
`node_modules/pdfmake/examples/fonts` si ya instalaste una versión de
pdfmake que las incluya como ejemplo).

Sin estos archivos, `ReportsService.generateTicketPdf` /
`generateSummaryPdf` lanzarán un error de `fs.readFileSync` al intentar
crear el documento.
