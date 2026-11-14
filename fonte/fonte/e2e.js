const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const srv = http.createServer((q, r) => { const f = path.join(DIST, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(f)); });
const resultados = []; let erros = [];
function reg(nome, ok, det) { resultados.push({ nome, ok: !!ok, det: det || '' }); console.log((ok ? '  ok  ' : 'FALHA ') + nome + (ok ? '' : ' -> ' + (det || ''))); }
async function T(nome, fn) { try { await fn(); } catch (e) { reg(nome, false, String(e.message).split('\n')[0]); } }

const FALAS_BOAS = [
  'Boa tarde! Meu nome é Ana, da Empresa Modelo. Com quem eu falo?',
  'Para sua segurança, pode confirmar seu nome completo e data de nascimento? Depois me conte o que aconteceu com a sua fatura.',
  'Entendo, isso realmente incomoda. A fatura mostra a mensalidade e o proporcional do primeiro mês, vou explicar cada item do lançamento.',
  'Ficou claro? Isso responde a sua dúvida? Posso registrar o ajuste e o próximo passo é a confirmação por e-mail em até dois dias.',
  'Então ficou combinado. Posso ajudar em mais alguma coisa? Obrigada por ligar, tenha um ótimo dia!'
];

(async () => {
  await new Promise(r => srv.listen(8765, r));
  const BASE = 'http://localhost:8765/';
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + path.join(__dirname, 'voz-falsa.wav'), '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, acceptDownloads: true, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) erros.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__fenix.APP.estado)));
  const rota = () => page.evaluate(() => window.__fenix.APP.rota);
  const sw = id => page.locator('label.sw:has(#' + id + ') .tr').click();
  const ir = async h => { await page.evaluate(x => { window.__fenix.APP.sujo = false; if (location.hash === x) render(); else location.hash = x; }, h); await page.waitForTimeout(150); };
  const modalBtn = async i => { await page.locator('.modal [data-mb="' + i + '"]').click(); await page.waitForTimeout(150); };
  const toastTxt = async () => (await page.locator('.toast').allTextContents()).join(' | ');
  const virarInstrutor = async () => { await page.locator('#btnav').click(); await page.locator('[data-act=trocarPerfil]').click(); await page.waitForTimeout(150); };

  /* ---------- 1. Primeiro acesso ---------- */
  console.log('# Primeiro acesso');
  await page.goto(BASE); await page.waitForSelector('#ob_nome');
  await T('splash some', async () => { await page.waitForTimeout(900); reg('splash some depois de carregar', (await page.locator('#splash').count()) === 0); });
  await T('onboarding exige nome', async () => { await page.locator('[data-act=obConcluir]').click(); reg('onboarding: nome obrigatório', /nome/i.test(await page.locator('#ob_erro').textContent())); });
  await T('onboarding exige aceite', async () => { await page.fill('#ob_nome', 'Cristiano'); await page.locator('[data-act=obConcluir]').click(); reg('onboarding: aceite obrigatório', /aceitar/i.test(await page.locator('#ob_erro').textContent())); });
  await T('política antes do aceite', async () => { const p2 = await ctx.newPage(); await p2.goto(BASE + '#/privacidade'); await p2.waitForSelector('text=Privacidade e dados', { timeout: 5000 }); reg('política de privacidade abre antes do aceite (sem cair no onboarding)', /tudo será perdido/.test(await p2.locator('#app').textContent())); await p2.close(); });
  await T('onboarding conclui', async () => { await sw('ob_ok'); await page.locator('[data-act=obConcluir]').click(); await page.waitForSelector('text=Olá, Cristiano'); reg('onboarding conclui e mostra Início', true); });
  await T('avatar com iniciais', async () => { reg('avatar mostra iniciais', (await page.locator('#btnav').textContent()) === 'C'); });
  await T('rodapé padrão', async () => { const f = await page.locator('footer.rod').textContent(); reg('rodapé com ano, <Cristiano Fênix/>, © e versão', f.includes(String(new Date().getFullYear())) && f.includes('<Cristiano Fênix/>') && f.includes('© Fênix Soluções Tecnológicas') && f.includes('v1.0')); });
  await T('persistência', async () => { await page.reload(); await page.waitForSelector('text=Olá, Cristiano'); reg('dados persistem após recarregar', true); });

  /* ---------- 2. Diagnóstico ---------- */
  console.log('# Diagnóstico e trilha');
  await T('diagnóstico valida', async () => { await ir('#/diagnostico'); await page.locator('[data-act=diagEnviar]').click(); reg('diagnóstico exige todas as respostas', /Responda todas/.test(await page.locator('#diagerro').textContent())); });
  await T('diagnóstico corrige', async () => { const resp = [1, 1, 1, 1, 1, 0]; for (let i = 0; i < 6; i++) await page.locator(`input[name=q${i}][value="${resp[i]}"]`).check(); await page.locator('[data-act=diagEnviar]').click(); await page.waitForSelector('text=Resultado: 83'); const s = await st(); reg('diagnóstico: nota 83 e módulo recomendado', s.diagnostico && s.diagnostico.nota === 83 && s.diagnostico.recomendados.includes('m9')); });
  await T('trilha lista 10 módulos', async () => { await ir('#/trilha'); await page.waitForSelector('text=Trilha: Fundamentos'); reg('trilha mostra 10 módulos', (await page.locator('.card.clic[data-go^="#/aula/"]').count()) === 10); });
  await T('aula: exercício valida e corrige', async () => { await ir('#/aula/m1'); await page.locator('[data-act=quizEnviar]').click(); const e1 = /Responda todas/.test(await page.locator('#qerro').textContent()); await page.locator('input[name=q0][value="1"]').check(); await page.locator('input[name=q1][value="1"]').check(); await page.locator('[data-act=quizEnviar]').click(); await page.waitForSelector('text=Nota 100'); reg('aula: validação e correção do exercício', e1 && (await st()).modulos.m1.quizNota === 100); });

  /* ---------- 3. Simulação por texto ---------- */
  console.log('# Simulação por texto');
  async function rodarTexto(falas, cenId) {
    await ir('#/treinar'); await page.locator(`input[name=cen][value="${cenId}"]`).check(); await page.locator('input[name=modo][value=texto]').check(); await page.locator('[data-act=iniciar]').click(); await page.waitForSelector('#entrada');
    for (const f of falas) { if (!(await page.locator('#entrada').count())) break; await page.fill('#entrada', f); await page.locator('[data-act=sessEnviar]').click(); await page.waitForTimeout(250); }
  }
  await T('sessão: envio vazio', async () => { await ir('#/treinar'); await page.locator('input[name=cen][value=cn1]').check(); await page.locator('[data-act=iniciar]').click(); await page.waitForSelector('#entrada'); await page.locator('[data-act=sessEnviar]').click(); reg('sessão: avisa quando a fala está vazia', /Digite/.test(await toastTxt())); });
  await T('proteção ao sair', async () => { await page.locator('nav.abas a[data-aba=inicio]').click(); await page.waitForSelector('.modal'); const tit = await page.locator('.modal h2').textContent(); await modalBtn(0); reg('sair da simulação pergunta antes (Ficar mantém a tela)', /sair/i.test(tit) && (await rota()) === '#/sessao'); });
  await T('pausar e retomar', async () => { await page.locator('[data-act=sessPausar]').click(); const p = await page.locator('#bpausa').textContent(); await page.locator('[data-act=sessPausar]').click(); reg('pausar/retomar alternam o botão', p === 'Retomar' && (await page.locator('#bpausa').textContent()) === 'Pausar'); });
  await T('reiniciar', async () => { await page.fill('#entrada', 'Boa tarde'); await page.locator('[data-act=sessEnviar]').click(); await page.waitForTimeout(300); await page.locator('[data-act=sessReiniciar]').click(); await modalBtn(1); await page.waitForTimeout(200); reg('reiniciar descarta a conversa', (await page.locator('.msg.op').count()) === 0); });
  await T('finalizar sem fala', async () => { await page.locator('[data-act=sessFinalizar]').click(); await page.waitForSelector('.modal'); const t = await page.locator('.modal h2').textContent(); await modalBtn(0); reg('finalizar sem nenhuma fala não gera tentativa', /Nada foi dito/.test(t)); });
  await T('conversa completa leva ao relatório', async () => {
    for (const f of FALAS_BOAS) { await page.fill('#entrada', f); await page.locator('[data-act=sessEnviar]').click(); await page.waitForTimeout(250); }
    await page.waitForSelector('text=Relatório da simulação', { timeout: 8000 });
    const s = await st(), t = s.tentativas[0];
    reg('conversa boa: cliente encerra e abre o relatório', !!t); reg('conversa boa: nota >= 70, aprovada, sem falha crítica', t.nota >= 70 && t.aprovado && !t.falhaCritica, 'nota ' + t.nota);
    reg('relatório mostra selo Demonstração', (await page.locator('.chip.demo').count()) > 0);
  });
  await T('relatório: seções', async () => {
    const txt = await page.locator('#app').textContent();
    reg('relatório traz blocos, pontos fortes, prioridades e próximo exercício', /Desempenho por bloco/.test(txt) && /Pontos fortes/.test(txt) && /Prioridades de melhoria/.test(txt) && /Próximo exercício recomendado/.test(txt));
    reg('relatório não menciona emoções inferidas', !/(nervos|ansios|eufor|raiva detect)/i.test(txt));
  });
  await T('autopercepção', async () => { await page.locator('[data-s="Tranquilo"]').click(); await page.waitForSelector('text=Você registrou'); const s = await st(); reg('autopercepção salva e fica só no registro privado', s.tentativas[0].privado.sentimento === 'Tranquilo'); });
  await T('PDF do relatório', async () => { const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=pdfRelatorio]').click()]); const f = await d.path(); const b = fs.readFileSync(f); reg('PDF do relatório baixa e é um PDF válido', /\.pdf$/.test(d.suggestedFilename()) && b.slice(0, 4).toString() === '%PDF' && b.length > 2000); });
  await T('falha crítica reprova', async () => {
    const m = FALAS_BOAS.slice(); m[2] = m[2] + ' Garanto 100% que nunca vai falhar. E o seu CPF é 123.456.789-00.';
    await rodarTexto(m, 'cn1'); await page.waitForSelector('text=Relatório da simulação', { timeout: 8000 }); const s = await st(), t = s.tentativas[s.tentativas.length - 1];
    reg('falha crítica: reprovada com nota abaixo do corte', t.falhaCritica && !t.aprovado && t.nota < 70, 'nota ' + t.nota);
    reg('falha crítica: aviso visível no relatório', /Falha\(s\) crítica\(s\)/.test(await page.locator('#app').textContent()));
  });
  await T('tentativa numerada', async () => { const s = await st(); reg('tentativas do mesmo cenário numeradas (1, 2)', s.tentativas.map(t => t.tentativaNum).join() === '1,2'); });
  await T('cliente irritado + grosseria', async () => { await rodarTexto(['Boa tarde, meu nome é Ana.', 'Você é um idiota, não é problema meu.'], 'cn7'); await page.waitForSelector('text=Relatório da simulação', { timeout: 8000 }); const s = await st(); const t = s.tentativas[s.tentativas.length - 1]; reg('grosseria encerra a ligação e gera falha crítica', t.falhaCritica && t.motivoFim === 'grosseria'); });

  /* ---------- 4. Histórico e comparação ---------- */
  console.log('# Histórico');
  await T('histórico lista e compara', async () => {
    await ir('#/historico'); await page.waitForSelector('text=Tentativas'); const n = await page.locator('[data-act=selComp]').count();
    await page.locator('[data-act=selComp]').nth(0).check(); await page.locator('[data-act=selComp]').nth(1).check(); await page.locator('[data-act=selComp]').nth(2).check().catch(() => { });
    const sel = await page.locator('[data-act=selComp]:checked').count(); const bt = await page.locator('[data-act=comparar]'); const hab = await bt.isEnabled();
    await bt.click(); await page.waitForSelector('text=Comparação'); const txt = await page.locator('#app').textContent();
    reg('histórico: 3 tentativas, limite de 2 na comparação', n === 3 && sel === 2 && hab); reg('comparação mostra antes/depois e variação', /Antes/.test(txt) && /Depois/.test(txt) && /(Subiu|Caiu|Mesma nota)/.test(txt));
  });
  await T('gráfico de evolução', async () => { await ir('#/historico'); reg('gráfico SVG de evolução renderiza', (await page.locator('svg.graf').count()) >= 1); await page.locator('[data-act=periodoH][data-p=mes]').click(); reg('alternar período para mês funciona', (await page.locator('svg.graf').count()) >= 1); });
  await T('excluir tentativa', async () => { await page.locator('.lista-item [data-go^="#/relatorio/"]').last().click(); await page.waitForSelector('text=Relatório da simulação'); await page.locator('[data-act=excluirTent]').click(); await modalBtn(1); await page.waitForSelector('text=Tentativas'); reg('excluir tentativa remove do histórico', (await st()).tentativas.length === 2); });

  /* ---------- 5. Instrutor: scripts ---------- */
  console.log('# Instrutor: scripts e cenários');
  await virarInstrutor();
  await T('perfil instrutor', async () => { reg('trocar para instrutor mostra o painel', (await page.locator('text=Painel do instrutor').count()) === 1); });
  await T('script novo valida', async () => { await ir('#/scripts'); await page.locator('[data-act=scriptNovo]').click(); await page.waitForSelector('#f_nome'); await page.locator('[data-act=scriptSalvar]').click(); reg('script: nome obrigatório', /nome do treinamento/.test(await page.locator('#ederro').textContent())); });
  await T('script: etapa sem expressões', async () => { await page.fill('#f_nome', 'Script E2E'); await page.fill('#et_p0', ''); await page.locator('[data-act=scriptSalvar]').click(); reg('script: etapa obrigatória precisa de expressões', /precisa de ao menos uma expressão/.test(await page.locator('#ederro').textContent())); });
  await T('script: salvar', async () => {
    await page.fill('#et_n0', 'Saudação'); await page.fill('#et_p0', 'bom dia, boa tarde'); await page.locator('[data-act=etapaAdd]').click(); await page.fill('#et_n1', 'Despedida'); await page.fill('#et_p1', 'ate logo, tenha um otimo dia'); await page.locator('[data-act=objAdd]').click(); await page.fill('#ob_o0', 'Está caro'); await page.fill('#ob_r0', 'Argumento de valor');
    await page.fill('#f_proibidas', 'sem problema nenhum'); await sw('f_exigeIdentificacao'); await page.locator('[data-act=etapaSobe][data-i="1"]').click(); await page.locator('[data-act=scriptSalvar]').click(); await page.waitForSelector('text=Script E2E');
    const sc = (await st()).scripts.find(s => s.nome === 'Script E2E'); reg('script novo salvo com etapas reordenadas, objeção, proibida e identidade', sc && sc.etapas[0].nome === 'Despedida' && sc.objecoes.length === 1 && sc.proibidas[0] === 'sem problema nenhum' && sc.exigeIdentificacao === true && sc.versao === 1);
  });
  await T('script: editar sobe versão', async () => { const id = (await st()).scripts.find(s => s.nome === 'Script E2E').id; await ir('#/script/' + id); await page.fill('#f_objetivo', 'Novo objetivo'); await page.locator('[data-act=scriptSalvar]').click(); await page.waitForSelector('text=Script E2E'); const sc = (await st()).scripts.find(s => s.id === id); reg('editar script sobe a versão e registra histórico', sc.versao === 2 && sc.historico.length === 2 && sc.objetivo === 'Novo objetivo'); });
  await T('script: proteção de saída', async () => { const id = (await st()).scripts.find(s => s.nome === 'Script E2E').id; await ir('#/script/' + id); await page.fill('#f_objetivo', 'Mudou'); await page.locator('nav.abas a[data-aba=inicio]').click(); await page.waitForSelector('.modal'); const t = await page.locator('.modal h2').textContent(); await modalBtn(0); const ficou = (await rota()) === '#/script/' + id; await page.locator('nav.abas a[data-aba=inicio]').click(); await page.waitForSelector('.modal'); await modalBtn(1); await page.waitForTimeout(200); reg('editor: sair com alterações pergunta (Ficar/Sair funcionam)', /sair/i.test(t) && ficou && (await rota()) === '#/inicio'); });
  await T('script: duplicar, arquivar, exportar', async () => {
    await ir('#/scripts'); const antes = (await st()).scripts.length; await page.locator('.card:has-text("Script E2E") [data-act=scriptDup]').first().click(); await page.waitForTimeout(200);
    reg('duplicar script', (await st()).scripts.length === antes + 1);
    await page.locator('.card:has-text("Script E2E (cópia)") [data-act=scriptArq]').first().click(); await page.waitForTimeout(200); reg('arquivar script', (await st()).scripts.find(s => s.nome === 'Script E2E (cópia)').arquivado === true);
    const [d] = await Promise.all([page.waitForEvent('download'), page.locator('.card:has-text("Script E2E") [data-act=scriptExp]').first().click()]); const j = JSON.parse(fs.readFileSync(await d.path(), 'utf8')); reg('exportar script gera JSON válido', j.tipoArquivo === 'fenix-script' && j.script.nome.startsWith('Script E2E'));
    fs.writeFileSync('/tmp/imp-e2e.json', JSON.stringify(j)); await page.setInputFiles('#fimp', '/tmp/imp-e2e.json'); await page.waitForTimeout(400); reg('importar script cria novo script', (await st()).scripts.length === antes + 2);
    fs.writeFileSync('/tmp/imp-ruim.json', '{"x":1}'); await page.setInputFiles('#fimp', '/tmp/imp-ruim.json'); await page.waitForTimeout(300); reg('importar JSON inválido mostra erro', /Não foi possível importar/.test(await toastTxt()));
  });
  await T('script em uso não exclui', async () => { await page.locator('.card:has-text("SAC — Dúvida sobre fatura") [data-act=scriptDel]').first().click(); await page.waitForTimeout(200); reg('script usado por cenário não pode ser excluído', /usado por/.test(await toastTxt())); });
  await T('script: excluir com APAGAR', async () => {
    const n = (await st()).scripts.length; await page.locator('summary:has-text("Arquivados")').click(); await page.locator('.card:has-text("Script E2E (cópia)") [data-act=scriptDel]').first().click(); await page.waitForSelector('#cfpal');
    const dis = await page.locator('.modal [data-mb="1"]').isDisabled(); await page.fill('#cfpal', 'APAGAR'); const hab = await page.locator('.modal [data-mb="1"]').isEnabled(); await modalBtn(1); await page.waitForTimeout(200);
    reg('excluir exige digitar APAGAR (botão libera só então)', dis && hab && (await st()).scripts.length === n - 1);
  });
  await T('cenário: criar e editar', async () => {
    await ir('#/cenarios'); const n = (await st()).cenarios.length; await page.locator('[data-act=cenNovo]').click(); await page.waitForSelector('#cn_nome'); await modalBtn(1); const er = await page.locator('#cn_erro').textContent();
    await page.fill('#cn_nome', 'Cenário E2E'); await page.selectOption('#cn_perfil', 'irritado'); await page.selectOption('#cn_nivel', '4'); await page.fill('#cn_obj', 'Muito caro | valor, desconto\nQuero o supervisor'); await sw('cn_valor'); await modalBtn(1); await page.waitForTimeout(250);
    const c = (await st()).cenarios.find(x => x.nome === 'Cenário E2E'); reg('cenário novo valida nome e salva com objeções e palavras-chave', /nome/.test(er) && (await st()).cenarios.length === n + 1 && c.objecoes.length === 2 && c.objecoes[0].palavrasChave.join() === 'valor,desconto' && c.nivel === 4 && c.perfil === 'irritado' && c.perguntaValor);
    await page.locator('.card:has-text("Cenário E2E") [data-act=cenEditar]').first().click(); await page.waitForSelector('#cn_nome'); await page.fill('#cn_nome', 'Cenário E2E editado'); await modalBtn(1); await page.waitForTimeout(200); reg('cenário editar', (await st()).cenarios.some(x => x.nome === 'Cenário E2E editado'));
  });
  await T('instrutor: script visível ao operador é só leitura', async () => { await virarInstrutor(); await ir('#/scripts'); const botoesEdicao = await page.locator('[data-act=scriptNovo],[data-act=scriptDel]').count(); await ir('#/script/sc_sac'); const dis = await page.locator('#f_nome').isDisabled(); reg('operador vê scripts em somente leitura', botoesEdicao === 0 && dis); await virarInstrutor(); });

  /* ---------- 6. Testes de seleção ---------- */
  console.log('# Modo Teste / seleção');
  await T('criar teste (valida)', async () => {
    await ir('#/testes'); await page.locator('[data-act=testeNovo]').click(); await page.waitForSelector('#ts_nome'); await modalBtn(1); const e1 = await page.locator('#ts_erro').textContent();
    await page.fill('#ts_nome', 'Teste SAC'); await page.selectOption('#ts_cen', 'cn1'); await page.fill('#ts_tempo', '0'); await modalBtn(1); const e2 = await page.locator('#ts_erro').textContent(); await page.fill('#ts_tempo', '10'); await page.fill('#ts_corte', '150'); await modalBtn(1); const e3 = await page.locator('#ts_erro').textContent();
    await page.fill('#ts_corte', '70'); await page.fill('#ts_tent', '1'); await modalBtn(1); await page.waitForTimeout(250); const t = (await st()).testes[0];
    reg('teste: valida nome, tempo e corte; salva', /nome/.test(e1) && /tempo/.test(e2) && /corte/.test(e3) && t && t.nome === 'Teste SAC' && t.conhecimento && t.semScript && !t.espelhoPermitido);
  });
  await T('aplicar teste: aviso e aceite', async () => {
    await page.locator('[data-act=testeAplicar]').click(); await page.waitForSelector('#cd_nome'); await modalBtn(1); const e1 = await page.locator('#cd_erro').textContent(); await page.fill('#cd_nome', 'Maria Candidata'); await modalBtn(1); const e2 = await page.locator('#cd_erro').textContent();
    reg('aplicar teste exige nome e aceite do aviso', /nome/.test(e1) && /aceitar/.test(e2)); await sw('cd_ok'); await modalBtn(1); await page.waitForSelector('text=Teste de conhecimento'); reg('teste abre a etapa de conhecimento', true);
  });
  await T('teste: conhecimento valida', async () => { await page.locator('[data-act=testeQuizEnviar]').click(); const e = /Responda todas/.test(await page.locator('#qerro').textContent()); const resp = [1, 1, 1, 1, 0, 0]; for (let i = 0; i < 6; i++) await page.locator(`input[name=q${i}][value="${resp[i]}"]`).check(); await page.locator('[data-act=testeQuizEnviar]').click(); await page.waitForSelector('#entrada'); reg('conhecimento exige todas as respostas e segue para a simulação', e); });
  await T('teste: sessão com script oculto, espelho bloqueado, tempo', async () => {
    const txt = await page.locator('#app').textContent(); reg('teste: script oculto (sem consulta)', /script está oculto/.test(txt)); reg('teste: tempo limite exibido', /Restam/.test(txt));
    const esp = (await page.locator('#espelho').count()); reg('teste (texto): Espelho de voz não aparece sem microfone', esp === 0);
    for (const f of FALAS_BOAS) { await page.fill('#entrada', f); await page.locator('[data-act=sessEnviar]').click(); await page.waitForTimeout(250); }
    await page.waitForSelector('text=Teste concluído', { timeout: 8000 }); reg('teste conclui e agradece ao candidato', true);
  });
  await T('revisão pelo instrutor', async () => {
    await ir('#/testes'); await page.waitForSelector('text=Maria Candidata'); await page.locator('a:has-text("Abrir")').first().click(); await page.waitForSelector('text=Revisão do instrutor');
    const txt = await page.locator('#app').textContent();
    reg('instrutor vê nota, conhecimento (67) e transcrição', /Teste de conhecimento/.test(txt) && /Nota\s*67/.test(txt) && /Transcrição/.test(txt));
    reg('instrutor NÃO vê voz, Espelho nem autopercepção', !/Sua voz nesta simulação/.test(txt) && !/Como você se sentiu/.test(txt) && !/Espelho de voz/.test(txt));
    await page.fill('#rv_nota', '150'); await page.locator('[data-act=salvarRevisao]').click(); reg('revisão valida nota fora de 0–100', /entre 0 e 100/.test(await page.locator('#rv_erro').textContent()));
    await page.fill('#rv_nota', '75'); await page.fill('#rv_com', 'Boa condução.'); await page.selectOption('#rv_dec', 'aprovado'); await page.locator('[data-act=salvarRevisao]').click(); await page.waitForTimeout(250);
    const t = (await st()).tentativas.find(x => x.tipo === 'teste'); reg('revisão registra decisão humana e ajuste de nota (nota original mantida)', t.revisao.decisao === 'aprovado' && t.revisao.notaAjustada === 75 && t.nota !== 75 && t.historicoRevisao.length === 1);
  });
  await T('limite de tentativas', async () => { await ir('#/testes'); await page.locator('[data-act=testeAplicar]').click(); await page.waitForSelector('#cd_nome'); await page.fill('#cd_nome', 'maria candidata'); await sw('cd_ok'); await modalBtn(1); reg('candidato não passa do limite de tentativas', /já usou/.test(await page.locator('#cd_erro').textContent())); await modalBtn(0); });
  await T('exportar resultados sem voz', async () => { const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=exportarResultados]').click()]); const j = JSON.parse(fs.readFileSync(await d.path(), 'utf8')); const s = JSON.stringify(j); reg('exportação dos resultados não contém voz nem sentimento', j.resultados.length === 1 && !/"voz"|sentimento|espelho|wpm/.test(s)); });
  await T('teste: editar e excluir', async () => { await page.locator('[data-act=testeEditar]').click(); await page.waitForSelector('#ts_nome'); await page.fill('#ts_nome', 'Teste SAC v2'); await modalBtn(1); await page.waitForTimeout(200); reg('editar teste', (await st()).testes[0].nome === 'Teste SAC v2'); await page.locator('[data-act=testeDel]').click(); await page.waitForSelector('#cfpal'); await page.fill('#cfpal', 'APAGAR'); await modalBtn(1); await page.waitForTimeout(200); reg('excluir teste com APAGAR (resultados permanecem)', (await st()).testes.length === 0 && (await st()).tentativas.some(t => t.tipo === 'teste')); });
  await virarInstrutor();

  /* ---------- 7. Voz ---------- */
  console.log('# Voz (microfone simulado)');
  await T('voz: consentimento', async () => {
    await ir('#/voz'); await page.waitForSelector('text=Laboratório de voz'); await page.locator('[data-act=calIniciar]').click(); await page.waitForSelector('.modal'); const t = await page.locator('.modal').textContent(); await modalBtn(0); await page.waitForTimeout(200);
    reg('voz: consentimento explica finalidade, não gravação e envio pelo navegador', /não é gravado/.test(t) && /reconhecimento de voz/.test(t)); reg('voz: recusar o consentimento não liga o microfone', (await st()).consentimento.voz === false && !(await page.evaluate(() => window.__fenix.APP && document.querySelector('#cal_st') && document.querySelector('#cal_st').textContent.includes('Ouvindo'))));
  });
  await T('voz: calibração', async () => {
    await page.locator('[data-act=calIniciar]').click(); await page.waitForSelector('.modal'); await modalBtn(1); await page.waitForSelector('text=Pode ler o texto agora', { timeout: 6000 });
    reg('calibração: aguarda o ruído e libera a leitura', true); await page.locator('[data-act=calParar]').click(); await page.waitForTimeout(400); reg('calibração curta demais é recusada', /curta demais/.test(await page.locator('#cal_st').textContent()) && !(await st()).base);
    await page.locator('[data-act=calIniciar]').click(); await page.waitForSelector('text=Pode ler o texto agora', { timeout: 6000 }); await page.waitForTimeout(9000); await page.locator('[data-act=calParar]').click(); await page.waitForTimeout(500);
    const b = (await st()).base; reg('calibração salva a linha de base (wpm, dB, tom)', b && b.wpm > 40 && b.db < 0 && b.f0 > 100 && b.f0 < 200, JSON.stringify(b));
  });
  await T('voz: configurar espelho', async () => {
    await sw('c_espelho'); await page.waitForTimeout(150); reg('espelho: chave liga e lembra a escolha', (await st()).config.espelho === true);
    await page.locator('[data-pa=wpm]').uncheck({ force: true }).catch(() => { }); await page.locator('[data-pa=db]').check({ force: true }); await page.locator('[data-pa=f0]').check({ force: true }); await page.locator('[data-pa=pausa]').check({ force: true }); await page.waitForTimeout(200);
    const pa = (await st()).config.pontoAtencao; reg('ponto de atenção limitado a 1–3 hábitos', pa.length >= 1 && pa.length <= 3, pa.join());
    await page.locator('#c_meta').fill('90'); await page.locator('#c_meta').dispatchEvent('change'); reg('meta de zona ajustável', Math.abs((await st()).config.metaZona - 0.9) < 1e-9);
  });
  await T('voz: leitura guiada com Espelho', async () => {
    await ir('#/treinar'); await page.locator('input[name=modo][value=leitura]').check(); await page.locator('input[name=cen][value=cn1]').check(); await page.locator('[data-act=iniciar]').click(); await page.waitForSelector('#leitura', { timeout: 5000 });
    await page.waitForTimeout(3500);
    const nM = await page.locator('#esp_corpo .medidor').count(); reg('espelho ligado mostra 4 medidores', nM === 4);
    await page.waitForTimeout(2500); const vdb = await page.locator('#med_db .v').textContent(), vf0 = await page.locator('#med_f0 .v').textContent(); reg('medidores de volume e tom reagem à voz', /dB/.test(vdb) && /Hz/.test(vf0), vdb + ' / ' + vf0);
    const f0 = parseInt(vf0); reg('tom medido coerente com a voz simulada (130–170 Hz)', f0 >= 125 && f0 <= 175, vf0);
    await page.locator('label.sw:has(#esp_sw) .tr').click(); await page.waitForTimeout(200); reg('desligar o espelho esconde os medidores', (await page.locator('#esp_corpo .medidor').count()) === 0 && /Desligado/.test(await page.locator('#esp_corpo').textContent()));
    await page.locator('label.sw:has(#esp_sw) .tr').click(); await page.waitForTimeout(200); reg('religar o espelho volta os medidores', (await page.locator('#esp_corpo .medidor').count()) === 4);
    const n = await page.locator('#leitura li').count(); for (let i = 0; i < n; i++) { await page.locator('[data-act=leituraProx],[data-act=sessFinalizar]#bprox').first().click().catch(() => { }); await page.waitForTimeout(150); }
    await page.waitForSelector('text=Relatório da simulação', { timeout: 10000 }).catch(async () => { await page.locator('#bprox').click(); await page.waitForSelector('text=Relatório da simulação', { timeout: 8000 }); });
  });
  await T('voz: relatório de leitura', async () => {
    const s = await st(), t = s.tentativas[s.tentativas.length - 1]; const txt = await page.locator('#app').textContent();
    reg('leitura: modo registrado e bloco Condução não pesa', t.modo === 'leitura' && t.avaliacao.blocos.find(b => b.id === 'conducao').nota === null);
    reg('relatório mostra "Sua voz" só para o operador, com a comparação com a base', /Sua voz nesta simulação/.test(txt) && /só você vê/i.test(txt) && /Comparado com a sua base/.test(txt));
    reg('métricas de voz guardadas no registro privado', t.privado.voz && t.privado.voz.resumo.pausas >= 1 && t.privado.voz.resumo.f0 > 100);
    reg('bloco Voz avaliado por métricas de áudio (não por emoção)', t.avaliacao.blocos.find(b => b.id === 'voz').apuracao.includes('sem leitura emocional'));
    reg('espelho: % do tempo na zona calculado (privado)', t.privado.espelho && t.privado.espelho.pctZona != null && t.privado.espelho.pctZona >= 0 && t.privado.espelho.pctZona <= 1, JSON.stringify(t.privado.espelho));
    reg('gráfico da meta do Espelho aparece na evolução', await (async () => { await ir('#/historico'); return /Espelho de voz: % do tempo na sua zona/.test(await page.locator('#app').textContent()); })());
  });
  await T('voz: modo voz sem reconhecimento cai para texto', async () => {
    const stt = await page.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition)); await ir('#/treinar'); await page.locator('input[name=modo][value=voz]').check(); await page.locator('input[name=cen][value=cn8]').check(); await page.locator('[data-act=iniciar]').click(); await page.waitForSelector('#entrada', { timeout: 6000 });
    await page.fill('#entrada', 'Boa tarde, meu nome é Ana. Como posso ajudar?'); await page.locator('[data-act=sessEnviar]').click(); await page.waitForTimeout(400); reg('modo voz: campo de texto continua funcionando como alternativa (STT ' + (stt ? 'presente' : 'ausente') + ')', (await page.locator('.msg.cl').count()) >= 1);
    await page.locator('[data-act=sessFinalizar]').click(); await page.waitForSelector('text=Relatório da simulação', { timeout: 8000 }); reg('modo voz: finaliza e avalia', true);
  });
  await T('voz: teste de microfone', async () => { await ir('#/voz'); await page.locator('[data-act=micTeste]').click(); await page.waitForSelector('text=Microfone funcionando', { timeout: 6000 }); reg('teste do microfone informa o nível captado', true); });
  await T('voz: apagar calibração', async () => { await page.locator('[data-act=calApagar]').click(); await modalBtn(1); await page.waitForTimeout(200); reg('apagar calibração', (await st()).base === null); });

  /* ---------- 8. Configurações ---------- */
  console.log('# Configurações, backup e exclusão');
  await T('config: valida avaliação', async () => { await ir('#/config'); await page.fill('#cf_corte', '150'); await page.locator('[data-act=cfAvaliacao]').click(); const e1 = await page.locator('#cf_erro').textContent(); await page.fill('#cf_corte', '65'); await page.fill('#cf_w1', '200'); await page.fill('#cf_w2', '100'); await page.locator('[data-act=cfAvaliacao]').click(); const e2 = await page.locator('#cf_erro').textContent(); await page.fill('#cf_w1', '100'); await page.fill('#cf_w2', '180'); await page.locator('[data-act=cfAvaliacao]').click(); const c = (await st()).config; reg('config: valida nota de corte e faixa; salva valores válidos', /entre 0 e 100/.test(e1) && /Faixa/.test(e2) && c.notaCorte === 65 && c.faixas.wpm.join() === '100,180'); });
  await T('config: IA externa valida', async () => { await page.fill('#cf_ai', 'http://inseguro'); await page.locator('#cf_aion').setChecked(true, { force: true }); await page.locator('[data-act=cfIA]').click(); const e = /HTTPS/.test(await page.locator('#cf_aierro').textContent()); await page.fill('#cf_ai', 'https://localhost:1/x'); await page.locator('[data-act=cfIATestar]').click(); await page.waitForFunction(() => /Não foi possível conectar|Conexão|respondeu/.test(document.querySelector('#cf_aist').textContent), null, { timeout: 12000 }); reg('IA externa: exige HTTPS e informa falha de conexão', e); await ir('#/config'); });
  await T('config: IA indisponível volta à Demonstração', async () => {
    await page.fill('#cf_ai', 'https://localhost:1/x'); await page.locator('#cf_aion').setChecked(true, { force: true }); await page.locator('[data-act=cfIA]').click(); await page.waitForTimeout(200); reg('IA externa ativada guarda o endereço', (await st()).config.aiAtivo === true);
    await ir('#/treinar'); await page.locator('input[name=modo][value=texto]').check(); await page.locator('input[name=cen][value=cn8]').check(); await page.locator('[data-act=iniciar]').click(); await page.waitForSelector('#entrada'); await page.fill('#entrada', 'Boa tarde, meu nome é Ana.'); await page.locator('[data-act=sessEnviar]').click(); await page.waitForSelector('.msg.cl', { timeout: 15000 }); reg('com a IA fora do ar, o cliente virtual responde em modo Demonstração e avisa', /indisponível/.test(await toastTxt()));
    await page.locator('[data-act=sessFinalizar]').click(); await page.waitForSelector('text=Relatório da simulação', { timeout: 20000 }); reg('avaliação cai para Demonstração com aviso', (await page.locator('.chip.demo').count()) > 0);
    await ir('#/config'); await page.locator('#cf_aion').setChecked(false, { force: true }); await page.locator('[data-act=cfIA]').click(); await page.waitForTimeout(200); reg('IA externa pode ser desativada', (await st()).config.aiAtivo === false);
  });
  await T('backup exportar/importar', async () => {
    await ir('#/config'); const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=backupExp]').click()]); const f = await d.path(); const j = JSON.parse(fs.readFileSync(f, 'utf8')); reg('backup exportado é válido (app, versão, dados)', j.app === 'fenix-call-trainer' && j.dados.tentativas.length > 0); const nT = j.dados.tentativas.length;
    fs.writeFileSync('/tmp/bk-ruim.json', '{"app":"outro"}'); await page.setInputFiles('#fbk', '/tmp/bk-ruim.json'); await page.waitForTimeout(300); reg('backup de outro app é recusado', /não é um backup/.test(await toastTxt()));
    fs.writeFileSync('/tmp/bk-nao-json.json', 'isto nao e json'); await page.setInputFiles('#fbk', '/tmp/bk-nao-json.json'); await page.waitForTimeout(300); reg('arquivo que não é JSON é recusado', /JSON válido/.test(await toastTxt()));
    await page.evaluate(() => { window.__fenix.APP.estado.tentativas = []; }); await page.setInputFiles('#fbk', f); await page.waitForSelector('#cfpal'); const dis = await page.locator('.modal [data-mb="1"]').isDisabled(); await page.fill('#cfpal', 'IMPORTAR'); await modalBtn(1); await page.waitForTimeout(400); reg('importar backup pede IMPORTAR e restaura os dados', dis && (await st()).tentativas.length === nT);
  });
  await T('revogar consentimento e meus dados', async () => { await ir('#/config'); await page.locator('[data-act=revogarVoz]').click(); reg('revogar consentimento de voz', (await st()).consentimento.voz === false); const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=meusDados]').click()]); reg('baixar meus dados', /meus-dados/.test(d.suggestedFilename())); });
  await T('manual, sobre, privacidade', async () => {
    await ir('#/manual'); const m = await page.locator('#app').textContent(); const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=manualBaixar]').click()]); reg('manual abre e baixa em Markdown', /Primeiro acesso/.test(m) && /\.md$/.test(d.suggestedFilename()));
    await ir('#/sobre'); const s = await page.locator('#app').textContent(); const [d2] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=changelogBaixar]').click()]); reg('sobre mostra versão, selo v|c, changelog com datas e baixa', /v1\.0 \| c —/.test(s) && /criada em 13\/11\/2026/.test(s) && /\.md$/.test(d2.suggestedFilename()));
    await ir('#/privacidade'); reg('privacidade explica onde ficam os dados e o risco de perda', /tudo será perdido/.test(await page.locator('#app').textContent()));
  });
  await T('certificado exige trilha completa', async () => { await ir('#/trilha'); reg('certificado só aparece com a trilha completa', (await page.locator('[data-act=certificado]').count()) === 0); });
  await T('certificado PDF (trilha completa)', async () => {
    await page.evaluate(() => { const A = window.__fenix.APP.estado, D = window.FCT_DATA; D.modulos.forEach(m => [1, 2, 3].forEach(i => A.tentativas.push({ id: 'x' + m.id + i, cenarioId: m.cenarioIds[0], nota: 90, quando: Date.now() + 3600000 + i * 1000, tipo: 'treino', aprovado: true, falhaCritica: false, cenarioNome: 'x', modo: 'texto', tentativaNum: i, duracao: 5, avaliacao: { blocos: [] }, transcricao: [] }))); });
    await ir('#/trilha'); await page.waitForSelector('[data-act=certificado]', { timeout: 6000 }).catch(async e => { console.log('DIAG', JSON.stringify(await page.evaluate(() => ({ rota: APP.rota, perfil: E().perfil, dom: modulosDominados(), corte: E().config.notaCorte, seq: E().config.nSeguidas, n: E().tentativas.length, ruins: D.modulos.filter(m => !dominioModulo(m).dominado).map(m => ({ id: m.id, cen: m.cenarioIds, dom: dominioModulo(m), ult: E().tentativas.filter(t => m.cenarioIds.includes(t.cenarioId)).slice(-4).map(t => [t.cenarioId, t.nota, t.falhaCritica, t.tipo, t.quando - Date.now()]) })), texto: document.querySelector('#app').innerText.slice(0, 200) })))); throw e; }); const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=certificado]').click()]); const b = fs.readFileSync(await d.path()); reg('trilha completa libera o certificado em PDF válido', b.slice(0, 4).toString() === '%PDF' && /dominados/.test(await page.locator('#app').textContent()));
  });

  /* ---------- 9. Qualidade ---------- */
  console.log('# Responsivo, offline, segurança');
  await T('360 px sem rolagem horizontal', async () => { await page.setViewportSize({ width: 360, height: 740 }); const rotas = ['#/inicio', '#/trilha', '#/treinar', '#/historico', '#/mais', '#/scripts', '#/cenarios', '#/voz', '#/testes', '#/config', '#/manual', '#/sobre', '#/aula/m5', '#/relatorio/' + (await st()).tentativas[0].id]; const ruins = []; for (const r of rotas) { await ir(r); await page.waitForTimeout(120); const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 362) ruins.push(r + '=' + w); } reg('nenhuma tela passa de 360 px de largura', ruins.length === 0, ruins.join(' ')); });
  await T('áreas de toque >= 44 px', async () => { await ir('#/inicio'); const pequenos = await page.evaluate(() => Array.from(document.querySelectorAll('button,.btn,input[type=text],select,nav.abas a')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height))); reg('botões, campos e abas têm altura >= 44 px', pequenos.length === 0, pequenos.slice(0, 5).join(', ')); });
  await T('XSS no nome e nos textos', async () => {
    await virarInstrutor();
    await ir('#/config'); await page.fill('#cf_nome', '<img src=x onerror="window.__xss=1">Zé'); await page.locator('[data-act=cfNome]').click(); await ir('#/inicio'); await page.waitForTimeout(200);
    await ir('#/script/novo'); await page.fill('#f_nome', '<img src=x onerror="window.__xss=2">'); await page.locator('[data-act=scriptSalvar]').click().catch(() => { }); await ir('#/scripts'); await page.waitForTimeout(200);
    reg('texto digitado não injeta HTML/JS', !(await page.evaluate(() => window.__xss)) && (await page.locator('#app img[src=x]').count()) === 0);
  });
  await T('offline', async () => { await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline'))); await page.waitForTimeout(200); const c = await page.locator('#conx').textContent(); await ir('#/trilha'); await page.waitForSelector('text=Trilha: Fundamentos'); reg('offline: indicador mostra Offline e o app continua navegando', c === 'Offline'); await ctx.setOffline(false); });
  await T('excluir tudo', async () => { await ir('#/config'); await page.locator('[data-act=apagarTudo]').click(); await page.waitForSelector('#cfpal'); await page.fill('#cfpal', 'APAGAR'); await modalBtn(1); await page.waitForTimeout(400); const s = await st(); reg('excluir minha conta apaga tudo e volta ao primeiro acesso', s.tentativas.length === 0 && s.usuario.onboarding === false && (await page.locator('#ob_nome').count()) === 1); });
  await T('erros de JavaScript', async () => { reg('nenhum erro de JavaScript no console durante todos os testes', erros.length === 0, erros.slice(0, 4).join(' || ')); });

  await browser.close(); srv.close();
  const falhas = resultados.filter(r => !r.ok);
  console.log('\n' + (resultados.length - falhas.length) + ' ok, ' + falhas.length + ' falha(s) de ' + resultados.length);
  fs.writeFileSync(path.join(__dirname, 'resultado-e2e.json'), JSON.stringify({ quando: new Date().toISOString(), total: resultados.length, falhas: falhas.length, resultados }, null, 2));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('ERRO FATAL', e); process.exit(2); });
