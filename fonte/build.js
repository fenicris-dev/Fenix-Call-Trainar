const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const versao = R('src/core.js').match(/FCT\.VERSAO = '([\d.]+)'/)[1];
const jspdf = fs.readFileSync(path.join(__dirname, 'vendor/node_modules/jspdf/dist/jspdf.umd.min.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const seguro = (s) => s.replace(/<\/script/gi, '<\\/script');
const iconeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#040798"/><stop offset="1" stop-color="#0076CE"/></linearGradient></defs><rect width="96" height="96" rx="20" fill="url(#g)"/><path d="M48 18c4 10 12 14 22 16-6 4-9 9-9 15 6-1 12-4 17-9-1 15-10 27-30 36C28 70 19 58 18 40c5 5 11 8 17 9 0-6-3-11-9-15 10-2 18-6 22-16z" fill="#fff"/></svg>';
const favicon = 'data:image/svg+xml;base64,' + Buffer.from(iconeSvg).toString('base64');
const manifest = { name: 'Fênix Call Trainer', short_name: 'Call Trainer', start_url: '.', display: 'standalone', background_color: '#041273', theme_color: '#040798', icons: [{ src: favicon, sizes: 'any', type: 'image/svg+xml' }] };
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#040798">
<title>Fênix Call Trainer</title>
<link rel="icon" href="${favicon}">
<link rel="manifest" href="data:application/manifest+json;base64,${Buffer.from(JSON.stringify(manifest)).toString('base64')}">
<style>${R('src/style.css')}</style>
</head>
<body>
<div id="splash" role="status" aria-label="Carregando"><svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="gs" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#040798"/><stop offset="1" stop-color="#0076CE"/></linearGradient></defs><rect width="96" height="96" rx="20" fill="url(#gs)"/><path d="M48 18c4 10 12 14 22 16-6 4-9 9-9 15 6-1 12-4 17-9-1 15-10 27-30 36C28 70 19 58 18 40c5 5 11 8 17 9 0-6-3-11-9-15 10-2 18-6 22-16z" fill="#fff"/></svg><div class="nome">Fênix Call Trainer</div><div class="emp">Fênix Soluções Tecnológicas</div><div class="barra"><i></i></div></div>
<div id="raiz"></div>
<noscript>Este aplicativo precisa de JavaScript.</noscript>
<script>${jspdf}</script>
<script>${seguro(R('src/core.js'))}</script>
<script>${seguro(R('src/data.js'))}</script>
<script>${seguro(R('src/ui1.js'))}</script>
<script>${seguro(R('src/ui2.js'))}</script>
<script>${seguro(R('src/ui3.js'))}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const nome = `fenix-call-trainer-v${versao}.html`;
fs.writeFileSync(path.join(__dirname, 'dist', nome), html);
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('gerado', nome, (html.length / 1024).toFixed(0) + ' KB');
