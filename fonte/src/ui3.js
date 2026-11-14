/* Fênix Call Trainer — interface (parte 3: voz, testes, configurações, PDF, manual, inicialização) */

/* ================= LABORATÓRIO DE VOZ ================= */
var CAL = null;
function telaVoz(app) {
  var b = E().base, sv = suporteVoz(), c = E().config;
  var h = '<h1>Laboratório de voz</h1><p class="mut">Aqui você calibra a sua voz e configura o Espelho de voz. Tudo é calculado <b>no seu aparelho</b>, o áudio não é gravado e nada aqui diz como você se sente.</p>';
  if (!sv.mic) h += '<div class="aviso">Este navegador não permite usar o microfone. A calibração e o Espelho não estarão disponíveis; as simulações por texto funcionam normalmente.</div>';
  h += '<div class="card"><h2>Linha de base pessoal</h2>' + (b ? '<p>Calibrada em ' + FCT.dataBR(b.criadoEm) + ': <b>' + b.wpm + '</b> palavras/min · volume <b>' + (b.db != null ? Math.round(b.db) : '—') + ' dB</b> (relativo) · tom <b>' + (b.f0 ? Math.round(b.f0) : '—') + ' Hz</b> · <b>' + Math.round(b.taxaPausas) + '</b> pausas/min.</p><p class="mut">Refaça ao trocar de fone ou de aparelho: o volume depende do microfone.</p>' : '<p class="mut">Ainda não calibrada. Leia o texto abaixo com calma e naturalidade.</p>') +
    '<div class="card" style="background:#f7f8fd;box-shadow:none"><p id="cal_texto" style="font-size:1.05rem">' + esc(D.TEXTO_BASE) + '</p></div>' +
    '<div class="linha"><button class="btn" data-act="calIniciar" id="bcal"' + (sv.mic ? '' : ' disabled') + '>' + (b ? 'Refazer a calibração' : 'Começar a leitura') + '</button><button class="btn sec" data-act="calParar" id="bcalp" style="display:none">Terminei de ler</button>' + (b ? '<button class="btn sec" data-act="calApagar">Apagar a calibração</button>' : '') + '</div>' +
    '<div class="mut" id="cal_st" role="status" style="margin-top:8px"></div><div class="barra" style="margin-top:6px;display:none" id="cal_nivel"><i style="width:0%"></i></div></div>';
  h += '<div class="card"><h2>Espelho de voz</h2><p class="mut">Medidores ao vivo de velocidade, volume, tom e pausas, comparados com a sua própria zona confortável. Só você vê. Liga e desliga aqui ou durante a simulação.</p>' +
    sw('c_espelho', 'Espelho de voz ligado', c.espelho) + '<br>' + sw('c_alertas', 'Alertas em tempo real (com dica prática)', c.alertas) + '<br>' + sw('c_guardar', 'Guardar o histórico das métricas no aparelho', c.guardarMetricas) +
    '<h3 style="margin-top:12px">Meu ponto de atenção <span class="mut" style="font-weight:400">(de 1 a 3)</span></h3><div class="linha">' + ['wpm', 'db', 'f0', 'pausa'].map(function (m) { return '<label class="sw"><input type="checkbox" data-pa="' + m + '"' + (c.pontoAtencao.indexOf(m) >= 0 ? ' checked' : '') + '><span class="tr"></span><span>' + ESCALAS[m].nome + '</span></label>'; }).join('') + '</div>' +
    '<label class="c" for="c_meta">Meta: ficar dentro da zona em ' + Math.round(c.metaZona * 100) + '% do tempo</label><input type="range" id="c_meta" min="50" max="100" step="5" value="' + Math.round(c.metaZona * 100) + '" style="width:100%;min-height:44px">' +
    '<label class="c" for="c_lw">Largura da zona de velocidade: ±' + Math.round(c.larg.wpm * 100) + '%</label><input type="range" id="c_lw" min="10" max="50" step="5" value="' + Math.round(c.larg.wpm * 100) + '" style="width:100%;min-height:44px">' +
    '<label class="c" for="c_ld">Largura da zona de volume: ±' + c.larg.db + ' dB</label><input type="range" id="c_ld" min="3" max="12" step="1" value="' + c.larg.db + '" style="width:100%;min-height:44px">' +
    '<label class="c" for="c_lf">Largura da zona de tom: ±' + Math.round(c.larg.f0 * 100) + '%</label><input type="range" id="c_lf" min="10" max="40" step="5" value="' + Math.round(c.larg.f0 * 100) + '" style="width:100%;min-height:44px"></div>';
  h += '<div class="card"><h2>Teste do microfone</h2><button class="btn sec" data-act="micTeste"' + (sv.mic ? '' : ' disabled') + '>Testar microfone</button><div class="mut" id="mt_st" role="status" style="margin-top:6px"></div></div>';
  h += '<div class="card"><h2>Navegador</h2><p>Microfone: ' + (sv.mic ? 'disponível' : 'indisponível') + ' · Reconhecimento de fala: ' + (sv.stt ? 'disponível' : 'indisponível') + ' · Voz sintética: ' + (sv.tts ? 'disponível' : 'indisponível') + '</p><p class="mut">Funciona melhor no Chrome ou Edge (Android e computador). Sem reconhecimento de fala, a simulação por voz usa o texto.</p></div>';
  app.innerHTML = h;
  $('#c_espelho').addEventListener('change', function (e) { c.espelho = e.target.checked; salvar(); toast('Espelho de voz ' + (c.espelho ? 'ligado' : 'desligado') + '.'); });
  $('#c_alertas').addEventListener('change', function (e) { c.alertas = e.target.checked; salvar(); });
  $('#c_guardar').addEventListener('change', function (e) { c.guardarMetricas = e.target.checked; salvar(); });
  $$('[data-pa]').forEach(function (el) { el.addEventListener('change', function () { var sel = $$('[data-pa]').filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.pa; }); if (sel.length < 1 || sel.length > 3) { el.checked = !el.checked; toast('Escolha de 1 a 3 pontos de atenção.', 'err'); return; } c.pontoAtencao = sel; salvar(); }); });
  [['c_meta', function (v) { c.metaZona = v / 100; }], ['c_lw', function (v) { c.larg.wpm = v / 100; }], ['c_ld', function (v) { c.larg.db = v; }], ['c_lf', function (v) { c.larg.f0 = v / 100; }]].forEach(function (p) {
    $('#' + p[0]).addEventListener('input', function (e) { p[1](+e.target.value); var l = e.target.previousElementSibling; if (l) l.textContent = rotuloSlider(p[0], +e.target.value); });
    $('#' + p[0]).addEventListener('change', function () { salvar(); });
  });
}
function rotuloSlider(id, v) { return { c_meta: 'Meta: ficar dentro da zona em ' + v + '% do tempo', c_lw: 'Largura da zona de velocidade: ±' + v + '%', c_ld: 'Largura da zona de volume: ±' + v + ' dB', c_lf: 'Largura da zona de tom: ±' + v + '%' }[id]; }
ACOES.calIniciar = function () {
  if (CAL) return;
  consentirVoz().then(function (ok) {
    if (!ok) { toast('Sem o consentimento não é possível usar o microfone.'); return; }
    CAL = { rast: new FCT.Rastreador(), calib: [], calibrado: false, t0: null, bruto: [] };
    $('#bcal').style.display = 'none'; $('#bcalp').style.display = ''; $('#cal_nivel').style.display = ''; $('#cal_st').textContent = 'Ouvindo o ruído do ambiente por 1 segundo… fique em silêncio.';
    APP.sujo = true; ACOES._descartar = function () { calParar(false); };
    Mic.iniciar(function (q) {
      if (!CAL) return;
      var nv = $('#cal_nivel i'); if (nv) nv.style.width = Math.max(0, Math.min(100, (q.db + 70) / 70 * 100)) + '%';
      if (!CAL.calibrado) { CAL.calib.push(q.db); if (CAL.calib.length >= 20) { CAL.rast.limiarDb = Math.max(-55, Math.min(-32, FCT.mediana(CAL.calib) + 12)); CAL.calibrado = true; var st = $('#cal_st'); if (st) st.textContent = 'Pode ler o texto agora, com calma. Quando terminar, toque em "Terminei de ler".'; } return; }
      CAL.rast.quadro(q);
    }).catch(function (e) { calParar(false); $('#cal_st').textContent = 'Não foi possível usar o microfone (' + (e && e.name === 'NotAllowedError' ? 'permissão negada' : (e && e.message) || 'erro') + ').'; });
  });
};
function calParar(salvarBase) {
  if (!CAL) return null; var c = CAL; CAL = null; Mic.parar(); APP.sujo = false; ACOES._descartar = null;
  return c;
}
ACOES.calParar = function () {
  var c = calParar(true); if (!c) return;
  var r = c.rast.resumo(), palavras = FCT.contarPalavras(D.TEXTO_BASE);
  if (!c.calibrado || r.duracao < 6 || r.tFala < 4) { $('#cal_st').textContent = 'A leitura ficou curta demais (ou não captei a sua voz). Tente de novo, lendo o texto inteiro, mais perto do microfone.'; render(); setTimeout(function () { var s = $('#cal_st'); if (s) s.textContent = 'A leitura ficou curta demais (ou não captei a sua voz). Tente de novo, lendo o texto inteiro, mais perto do microfone.'; }, 30); return; }
  E().base = FCT.criarBase(r, palavras, r.duracao); logAcesso('calibracao'); salvar(); toast('Linha de base salva: ' + E().base.wpm + ' palavras/min.'); render();
};
ACOES.calApagar = function () { confirmar('Apagar a calibração', 'O Espelho de voz deixa de mostrar a sua zona até você calibrar de novo.', 'Apagar', 'Cancelar').then(function (ok) { if (!ok) return; E().base = null; salvar(); render(); }); };
ACOES.micTeste = function () {
  var st = $('#mt_st'); if (Mic.ativo) { Mic.parar(); st.textContent = 'Teste encerrado.'; return; }
  consentirVoz().then(function (ok) {
    if (!ok) return; var max = -100, n = 0;
    st.textContent = 'Fale algo por 3 segundos…';
    Mic.iniciar(function (q) { n++; if (q.db > max) max = q.db; if (n >= 60) { Mic.parar(); st.textContent = max > -55 ? 'Microfone funcionando. Nível máximo captado: ' + Math.round(max) + ' dB.' : 'Quase não captei som (' + Math.round(max) + ' dB). Verifique a permissão e o volume do microfone.'; } }).catch(function (e) { st.textContent = 'Não foi possível usar o microfone: ' + ((e && e.name === 'NotAllowedError') ? 'permissão negada.' : (e && e.message) || 'erro.'); });
  });
};

/* ================= TESTES / SELEÇÃO ================= */
function telaTestes(app) {
  var h = '<div class="linha entre"><h1>Testes e seleção</h1>' + (ehInstrutor() ? '<button class="btn peq" data-act="testeNovo">Novo teste</button>' : '') + '</div>';
  h += '<div class="aviso"><b>Como funciona:</b> teste padronizado, igual para todos os candidatos. O resultado é um relatório com evidências; <b>a decisão final é humana</b>. Métricas de voz e Espelho nunca entram na nota nem aparecem para o instrutor.</div>';
  if (!ehInstrutor()) h += '<div class="aviso">Para criar ou aplicar testes, troque para o perfil Instrutor no menu do avatar.</div>';
  h += E().testes.map(function (t) {
    var c = cenarioPorId(t.cenarioId), res = E().tentativas.filter(function (x) { return x.testeId === t.id; });
    return '<div class="card"><b>' + esc(t.nome) + '</b><br>' + chip(c ? c.nome : '(cenário removido)') + chip(t.tempoMin + ' min') + chip('Corte ' + t.corte) + chip(t.conhecimento ? 'Com teste de conhecimento' : 'Só simulação') + chip(t.semScript ? 'Sem consulta' : 'Script visível') + chip(t.espelhoPermitido ? 'Espelho permitido' : 'Espelho bloqueado') + chip(t.tentativasMax + ' tentativa(s)') + chip(res.length + ' aplicação(ões)') +
      (ehInstrutor() ? '<div class="linha" style="margin-top:6px"><button class="btn peq" data-act="testeAplicar" data-id="' + t.id + '">Aplicar a um candidato</button><button class="btn peq sec" data-act="testeEditar" data-id="' + t.id + '">Editar</button><button class="btn peq sec" data-act="testeDel" data-id="' + t.id + '">Excluir</button></div>' : '') + '</div>';
  }).join('') || '<div class="card vazio">Nenhum teste criado.</div>';
  if (ehInstrutor()) {
    var res = E().tentativas.filter(function (x) { return x.tipo === 'teste'; }).sort(function (a, b) { return b.quando - a.quando; });
    h += '<div class="card"><h2>Resultados</h2>' + (res.length ? '<table class="t"><tr><th>Candidato</th><th>Nota</th><th>Situação</th><th></th></tr>' + res.map(function (r) { var t = FCT.visaoInstrutor(r), rv = r.revisao; return '<tr><td>' + esc(r.candidato || '—') + '<br><span class="mut">' + FCT.dataBR(r.quando) + '</span></td><td><b>' + t.nota + '</b></td><td>' + (rv ? chip(rv.decisao === 'aprovado' ? 'Aprovado' : rv.decisao === 'reprovado' ? 'Reprovado' : 'Em análise', rv.decisao === 'aprovado' ? 'ok' : rv.decisao === 'reprovado' ? 'bad' : 'am') : chip('Aguardando revisão', 'am')) + (r.falhaCritica ? chip('Falha crítica', 'bad') : '') + '</td><td><a class="btn peq sec" href="#/relatorio/' + r.id + '">Abrir</a></td></tr>'; }).join('') + '</table><div class="linha" style="margin-top:8px"><button class="btn peq sec" data-act="exportarResultados">Exportar resultados (JSON, sem voz)</button></div>' : '<p class="vazio">Nenhum candidato avaliado.</p>') + '</div>';
  }
  app.innerHTML = h;
}
function editarTeste(t) {
  var novo = !t; t = t || { id: uid('ts'), nome: '', cenarioId: (E().cenarios[0] || {}).id, tempoMin: 10, corte: 70, conhecimento: true, semScript: true, espelhoPermitido: false, tentativasMax: 1 };
  var corpo = '<label class="c" for="ts_nome">Nome do teste *</label><input type="text" id="ts_nome" value="' + esc(t.nome) + '">' +
    '<label class="c" for="ts_cen">Cenário</label><select id="ts_cen">' + E().cenarios.map(function (c) { return '<option value="' + c.id + '"' + (c.id === t.cenarioId ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('') + '</select>' +
    '<label class="c" for="ts_tempo">Tempo limite da simulação (minutos)</label><input type="number" id="ts_tempo" min="1" max="60" value="' + t.tempoMin + '">' +
    '<label class="c" for="ts_corte">Nota de corte (0 a 100)</label><input type="number" id="ts_corte" min="0" max="100" value="' + t.corte + '">' +
    '<label class="c" for="ts_tent">Número de tentativas por candidato</label><input type="number" id="ts_tent" min="1" max="5" value="' + t.tentativasMax + '">' +
    '<div style="margin-top:8px">' + sw('ts_conh', 'Incluir teste de conhecimento antes da simulação', t.conhecimento) + '<br>' + sw('ts_sem', 'Ocultar o script durante o teste (sem consulta)', t.semScript) + '<br>' + sw('ts_esp', 'Permitir o Espelho de voz (vale para todos)', t.espelhoPermitido) + '</div><div class="erro" id="ts_erro" role="alert"></div>';
  modal({
    titulo: novo ? 'Novo teste' : 'Editar teste', corpo: corpo, botoes: [{ txt: 'Cancelar', val: false, cls: 'sec' }, {
      txt: 'Salvar', val: true,
      valida: function (bg) { var er = bg.querySelector('#ts_erro'); if (!bg.querySelector('#ts_nome').value.trim()) { er.textContent = 'Informe o nome do teste.'; return false; } var tm = +bg.querySelector('#ts_tempo').value, ct = +bg.querySelector('#ts_corte').value; if (!(tm >= 1 && tm <= 60)) { er.textContent = 'O tempo deve estar entre 1 e 60 minutos.'; return false; } if (!(ct >= 0 && ct <= 100)) { er.textContent = 'A nota de corte deve estar entre 0 e 100.'; return false; } if (!bg.querySelector('#ts_cen').value) { er.textContent = 'Cadastre um cenário antes.'; return false; } return true; },
      fn: function (bg) {
        t.nome = bg.querySelector('#ts_nome').value.trim(); t.cenarioId = bg.querySelector('#ts_cen').value; t.tempoMin = +bg.querySelector('#ts_tempo').value; t.corte = +bg.querySelector('#ts_corte').value; t.tentativasMax = +bg.querySelector('#ts_tent').value || 1;
        t.conhecimento = bg.querySelector('#ts_conh').checked; t.semScript = bg.querySelector('#ts_sem').checked; t.espelhoPermitido = bg.querySelector('#ts_esp').checked;
        if (novo) E().testes.push(t); else { var ix = E().testes.findIndex(function (x) { return x.id === t.id; }); E().testes[ix] = t; } salvar(); return true;
      }
    }]
  }).then(function (ok) { if (ok) { toast('Teste salvo.'); render(); } });
}
ACOES.testeNovo = function () { editarTeste(null); };
ACOES.testeEditar = function (el) { editarTeste(E().testes.find(function (t) { return t.id === el.dataset.id; })); };
ACOES.testeDel = function (el) { var t = E().testes.find(function (x) { return x.id === el.dataset.id; }); if (!t) return; confirmarApagar('Excluir teste', 'O teste "' + t.nome + '" será apagado. Os resultados já registrados continuam.').then(function (ok) { if (!ok) return; E().testes = E().testes.filter(function (x) { return x.id !== t.id; }); salvar(); render(); toast('Teste excluído.'); }); };
ACOES.exportarResultados = function () {
  var dados = E().tentativas.filter(function (t) { return t.tipo === 'teste'; }).map(function (t) { var v = FCT.visaoInstrutor(t); return { candidato: v.candidato, data: FCT.dataBR(v.quando), teste: v.testeId, nota: v.nota, falhaCritica: v.falhaCritica, decisao: v.revisao ? v.revisao.decisao : null, conhecimento: v.conhecimento || null, avaliacao: v.avaliacao }; });
  baixar('fenix-call-trainer-resultados-testes.json', JSON.stringify({ app: 'fenix-call-trainer', geradoEm: new Date().toISOString(), resultados: dados }, null, 2));
};
ACOES.testeAplicar = function (el) {
  var t = E().testes.find(function (x) { return x.id === el.dataset.id; }); if (!t) return; var c = cenarioPorId(t.cenarioId); if (!c) { toast('O cenário deste teste não existe mais.', 'err'); return; }
  modal({
    titulo: 'Aplicar teste', corpo: '<p><b>' + esc(t.nome) + '</b></p><label class="c" for="cd_nome">Nome do candidato *</label><input type="text" id="cd_nome" autocomplete="off" maxlength="60">' +
      '<div class="aviso"><b>Aviso ao candidato:</b> serão registrados a sua transcrição, a nota e a avaliação, neste aparelho, para análise do instrutor, até serem apagados. Métricas de voz não são enviadas ao instrutor e não entram na nota. O teste tem ' + t.tempoMin + ' min de simulação' + (t.conhecimento ? ' e uma etapa de conhecimento' : '') + (t.semScript ? '; o script ficará oculto' : '') + '. Você pode responder <b>por texto</b>, sem prejuízo na nota. ' + (t.espelhoPermitido ? 'O Espelho de voz é permitido.' : 'O Espelho de voz não é permitido neste teste.') + '</div>' +
      '<label class="c" for="cd_modo">Como prefere responder?</label><select id="cd_modo"><option value="texto">Por texto</option><option value="voz">Por voz (microfone)</option></select>' + sw('cd_ok', 'Li o aviso e aceito', false) + '<div class="erro" id="cd_erro" role="alert"></div>',
    botoes: [{ txt: 'Cancelar', val: null, cls: 'sec' }, {
      txt: 'Iniciar', val: true,
      valida: function (bg) { var er = bg.querySelector('#cd_erro'); if (!bg.querySelector('#cd_nome').value.trim()) { er.textContent = 'Informe o nome do candidato.'; return false; } if (!bg.querySelector('#cd_ok').checked) { er.textContent = 'O candidato precisa aceitar o aviso.'; return false; } var nome = bg.querySelector('#cd_nome').value.trim().toLowerCase(), usadas = E().tentativas.filter(function (x) { return x.testeId === t.id && (x.candidato || '').toLowerCase() === nome; }).length; if (usadas >= t.tentativasMax) { er.textContent = 'Este candidato já usou as ' + t.tentativasMax + ' tentativa(s) permitidas.'; return false; } return true; },
      fn: function (bg) { return { nome: bg.querySelector('#cd_nome').value.trim().replace(/[<>]/g, ''), modo: bg.querySelector('#cd_modo').value }; }
    }]
  }).then(function (r) {
    if (!r) return;
    var ctx = { id: t.id, nome: t.nome, candidato: r.nome, tempoMin: t.tempoMin, corte: t.corte, semScript: t.semScript, espelhoPermitido: t.espelhoPermitido, conhecimento: null };
    APP.testeCtx = { teste: t, ctx: ctx, modo: r.modo, cenarioId: t.cenarioId };
    logAcesso('inicio_teste');
    if (t.conhecimento) { APP.sujo = true; ACOES._descartar = function () { APP.testeCtx = null; }; APP.rota = '#/teste/quiz'; location.hash = '#/teste/quiz'; render(); }
    else iniciarSimulacaoTeste();
  });
};
function telaTeste(app) {
  var tc = APP.testeCtx; if (!tc) { app.innerHTML = '<div class="card vazio">Nenhum teste em andamento. <a href="#/testes">Voltar</a></div>'; return; }
  var h = '<h1>Teste de conhecimento</h1><p class="mut">Candidato: ' + esc(tc.ctx.candidato) + '. Responda todas as perguntas.</p><form id="fq">' + D.diagnostico.map(function (q, i) { return '<fieldset class="card" style="border:0"><legend><b>' + (i + 1) + '. ' + esc(q.p) + '</b></legend>' + q.opcoes.map(function (o, j) { return '<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="radio" name="q' + i + '" value="' + j + '"> ' + esc(o) + '</label>'; }).join('') + '</fieldset>'; }).join('') + '<div class="erro" id="qerro" role="alert"></div><button type="button" class="btn" data-act="testeQuizEnviar">Continuar para a simulação</button></form>';
  app.innerHTML = h;
}
ACOES.testeQuizEnviar = function () {
  var tc = APP.testeCtx; if (!tc) return; var resp = [], falta = false;
  D.diagnostico.forEach(function (q, i) { var r = $('#fq input[name=q' + i + ']:checked'); if (!r) falta = true; resp.push(r ? +r.value : -1); });
  if (falta) { $('#qerro').textContent = 'Responda todas as perguntas.'; return; }
  var r = FCT.corrigirQuiz(D.diagnostico, resp); tc.ctx.conhecimento = { nota: r.nota, acertos: r.acertos, total: r.total, respostas: resp };
  APP.sujo = false; iniciarSimulacaoTeste();
};
function iniciarSimulacaoTeste() {
  var tc = APP.testeCtx; if (!tc) return; var sv = suporteVoz(), modo = tc.modo === 'voz' && sv.ok ? 'voz' : 'texto';
  if (tc.modo === 'voz' && !sv.ok) toast('Voz indisponível neste navegador: o teste seguirá por texto.');
  var cfg = { cenarioId: tc.cenarioId, modo: tc.ctx.semScript ? (modo === 'voz' ? 'voz' : 'semconsulta') : modo, comMic: false, teste: tc.ctx };
  if (modo === 'voz') { consentirVoz().then(function (ok) { cfg.comMic = ok; if (!ok) cfg.modo = tc.ctx.semScript ? 'semconsulta' : 'texto'; APP.testeCtx = null; criarSessao(cfg); }); }
  else { APP.testeCtx = null; criarSessao(cfg); }
}

/* ================= CONFIGURAÇÕES ================= */
function telaConfig(app) {
  var c = E().config;
  var h = '<h1>Configurações</h1>';
  h += '<div class="card"><h2>Seu perfil</h2><label class="c" for="cf_nome">Primeiro nome</label><input type="text" id="cf_nome" maxlength="40" value="' + esc(E().usuario.nome) + '"><div class="linha" style="margin-top:8px"><button class="btn peq" data-act="cfNome">Salvar nome</button></div></div>';
  h += '<div class="card"><h2>Avaliação</h2><label class="c" for="cf_corte">Nota de corte (0 a 100)</label><input type="number" id="cf_corte" min="0" max="100" value="' + c.notaCorte + '"><label class="c" for="cf_seq">Simulações seguidas para dominar um módulo</label><input type="number" id="cf_seq" min="1" max="10" value="' + c.nSeguidas + '">' +
    '<h3 style="margin-top:12px">Faixas-alvo da operação (voz)</h3><p class="mut">Não existe valor universal correto: defina o que faz sentido para a sua operação.</p><div class="grid g3"><div><label class="c" for="cf_w1">Palavras/min mín.</label><input type="number" id="cf_w1" min="50" max="300" value="' + c.faixas.wpm[0] + '"></div><div><label class="c" for="cf_w2">Palavras/min máx.</label><input type="number" id="cf_w2" min="50" max="300" value="' + c.faixas.wpm[1] + '"></div><div><label class="c" for="cf_pl">Pausas longas máx.</label><input type="number" id="cf_pl" min="0" max="20" value="' + c.faixas.pausasLongasMax + '"></div></div><div class="erro" id="cf_erro" role="alert"></div><div class="linha" style="margin-top:8px"><button class="btn peq" data-act="cfAvaliacao">Salvar avaliação</button></div></div>';
  h += '<div class="card"><h2>Voz e preferências</h2>' + sw('cf_falar', 'O cliente virtual fala em voz alta (simulação por voz)', c.falar) + '</div>';
  h += '<div class="card"><h2>IA externa (opcional)</h2><p class="mut">Sem IA externa, o app usa o modo <span class="chip demo">Demonstração</span> (regras do app). Para usar IA, informe o endereço (HTTPS) de uma função segura sua que recebe o pedido e chama o modelo. <b>Nunca coloque chaves de API aqui</b>: elas ficam no servidor.</p><label class="c" for="cf_ai">Endereço da função (https://…)</label><input type="url" id="cf_ai" value="' + esc(c.aiEndpoint) + '" placeholder="https://sua-funcao.exemplo.com/fenix-ia">' + sw('cf_aion', 'Usar a IA externa', c.aiAtivo) + '<div class="erro" id="cf_aierro" role="alert"></div><div class="linha" style="margin-top:8px"><button class="btn peq" data-act="cfIA">Salvar IA</button><button class="btn peq sec" data-act="cfIATestar">Testar conexão</button></div><div class="mut" id="cf_aist"></div></div>';
  h += '<div class="card"><h2>Backup e dados</h2><p class="mut">Seus dados ficam só neste aparelho. Formatar, limpar o histórico ou os dados do navegador apaga tudo. Faça backups.</p><div class="linha"><button class="btn peq" data-act="backupExp">Exportar backup</button><button class="btn peq sec" data-act="backupImp">Importar backup</button><input type="file" id="fbk" accept=".json,application/json" class="sr" tabindex="-1"></div>' +
    '<div class="linha" style="margin-top:8px"><button class="btn peq sec" data-act="meusDados">Baixar meus dados</button><button class="btn peq sec" data-act="revogarVoz">Revogar consentimento de voz</button></div></div>';
  h += '<div class="card"><h2>Zona de perigo</h2><p class="mut">Apaga tudo (tentativas, scripts, cenários, calibração) e volta ao primeiro acesso.</p><button class="btn peq perigo" data-act="apagarTudo">Excluir minha conta e meus dados</button></div>';
  h += '<details><summary>Registro de acessos (últimos ' + Math.min(30, E().logAcesso.length) + ')</summary>' + E().logAcesso.slice(-30).reverse().map(function (l) { return '<p class="mut">' + FCT.dataBR(l.quando) + ' ' + FCT.horaBR(l.quando) + ' · ' + esc(l.acao) + ' · ' + esc(l.perfil) + '</p>'; }).join('') + '</details>';
  app.innerHTML = h;
  $('#cf_falar').addEventListener('change', function (e) { c.falar = e.target.checked; salvar(); });
  $('#fbk').addEventListener('change', importarBackup);
}
ACOES.cfNome = function () { var n = $('#cf_nome').value.trim().replace(/[<>]/g, ''); if (!n) { toast('Informe o nome.', 'err'); return; } E().usuario.nome = n; salvar(); atualizarTopo(); toast('Nome salvo.'); };
ACOES.cfAvaliacao = function () {
  var c = E().config, er = $('#cf_erro'), corte = +$('#cf_corte').value, seq = +$('#cf_seq').value, w1 = +$('#cf_w1').value, w2 = +$('#cf_w2').value, pl = +$('#cf_pl').value;
  if (!(corte >= 0 && corte <= 100)) { er.textContent = 'A nota de corte deve estar entre 0 e 100.'; return; }
  if (!(seq >= 1 && seq <= 10)) { er.textContent = 'O número de simulações seguidas deve estar entre 1 e 10.'; return; }
  if (!(w1 >= 50 && w2 <= 300 && w1 < w2)) { er.textContent = 'Faixa de velocidade inválida: o mínimo deve ser menor que o máximo (entre 50 e 300).'; return; }
  er.textContent = ''; c.notaCorte = corte; c.nSeguidas = seq; c.faixas = { wpm: [w1, w2], pausasLongasMax: pl, viciosPor100: c.faixas.viciosPor100 || 3 }; salvar(); toast('Avaliação salva.');
};
ACOES.cfIA = function () {
  var c = E().config, u = $('#cf_ai').value.trim(), on = $('#cf_aion').checked, er = $('#cf_aierro');
  if (on && !/^https:\/\/[^\s]+$/i.test(u)) { er.textContent = 'Informe um endereço HTTPS válido para usar a IA externa.'; return; }
  er.textContent = ''; c.aiEndpoint = u; c.aiAtivo = on && !!u; salvar(); toast(c.aiAtivo ? 'IA externa ativada.' : 'IA externa desativada: modo Demonstração.');
};
ACOES.cfIATestar = function () {
  var u = $('#cf_ai').value.trim(), st = $('#cf_aist'); if (!/^https:\/\/[^\s]+$/i.test(u)) { st.textContent = 'Informe um endereço HTTPS válido.'; return; }
  st.textContent = 'Testando…'; var ctl = new AbortController(); setTimeout(function () { ctl.abort(); }, 8000);
  fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'ping', versaoApp: FCT.VERSAO }), signal: ctl.signal }).then(function (r) { st.textContent = r.ok ? 'Conexão ok (HTTP ' + r.status + ').' : 'A função respondeu HTTP ' + r.status + '.'; }).catch(function (e) { st.textContent = 'Não foi possível conectar: ' + (e.name === 'AbortError' ? 'tempo esgotado' : e.message) + '.'; });
};
function dadosBackup() { return { app: 'fenix-call-trainer', versaoApp: FCT.VERSAO, geradoEm: new Date().toISOString(), dados: clone(E()) }; }
ACOES.backupExp = function () { baixar('fenix-call-trainer-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(dadosBackup(), null, 2)); toast('Backup exportado.'); };
ACOES.meusDados = function () { baixar('fenix-call-trainer-meus-dados.json', JSON.stringify(dadosBackup(), null, 2)); };
ACOES.backupImp = function () { $('#fbk').click(); };
function importarBackup(ev) {
  var f = ev.target.files[0]; if (!f) return; var r = new FileReader();
  r.onload = function () {
    var obj; try { obj = JSON.parse(r.result); } catch (e) { toast('O arquivo não é um JSON válido.', 'err'); return; }
    var erro = FCT.validarBackup(obj); if (erro) { toast(erro, 'err'); return; }
    confirmarApagar('Importar backup', 'Os dados atuais deste aparelho serão SUBSTITUÍDOS pelos do backup (' + obj.dados.tentativas.length + ' tentativa(s), ' + obj.dados.scripts.length + ' script(s)).', 'IMPORTAR').then(function (ok) { if (!ok) return; APP.estado = FCT.migrar(obj.dados); salvar(); toast('Backup importado.'); atualizarTopo(); go('#/inicio'); });
  };
  r.readAsText(f); ev.target.value = '';
}
ACOES.revogarVoz = function () { E().consentimento = { voz: false, em: null }; salvar(); toast('Consentimento revogado. O app pedirá de novo antes de usar o microfone.'); };
ACOES.apagarTudo = function () {
  confirmarApagar('Excluir minha conta e meus dados', 'Isso apaga TUDO neste aparelho: tentativas, scripts, cenários, calibração e configurações. Não pode ser desfeito. Faça um backup antes, se quiser.').then(function (ok) { if (!ok) return; try { localStorage.removeItem(APP.chave); } catch (e) { } APP.estado = FCT.estadoVazio(); carregar(); salvar(); toast('Dados apagados.'); APP.rota = '#/inicio'; render(); });
};

/* ================= PDF ================= */
function novoPdf(orient) { if (!window.jspdf) { toast('O gerador de PDF não carregou.', 'err'); return null; } return new window.jspdf.jsPDF({ orientation: orient || 'p', unit: 'mm', format: 'a4' }); }
function limpaPdf(s) { return String(s == null ? '' : s).replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '?'); }
function cabecalhoPdf(d, titulo) {
  d.setFillColor(4, 18, 115); d.rect(0, 0, d.internal.pageSize.getWidth(), 22, 'F'); d.setTextColor(255, 255, 255); d.setFontSize(15); d.setFont('helvetica', 'bold'); d.text('Fênix Call Trainer', 12, 11); d.setFontSize(9); d.setFont('helvetica', 'normal'); d.text('Fênix Soluções Tecnológicas', 12, 17);
  d.setTextColor(2, 7, 51); d.setFontSize(14); d.setFont('helvetica', 'bold'); d.text(limpaPdf(titulo), 12, 32);
}
ACOES.pdfRelatorio = function (el) {
  var t0 = tentativaPorId(el.dataset.id); if (!t0) return; var t = ehInstrutor() ? FCT.visaoInstrutor(t0) : t0, av = t.avaliacao, d = novoPdf('p'); if (!d) return;
  cabecalhoPdf(d, 'Relatório da simulação'); var y = 40, W = d.internal.pageSize.getWidth() - 24;
  function linha(txt, o) { o = o || {}; d.setFont('helvetica', o.b ? 'bold' : 'normal'); d.setFontSize(o.s || 10); d.setTextColor.apply(d, o.c || [2, 7, 51]); var ls = d.splitTextToSize(limpaPdf(txt), W); ls.forEach(function (l) { if (y > 280) { d.addPage(); y = 16; } d.text(l, 12, y); y += (o.s || 10) * 0.45 + 1.4; }); }
  linha(t.cenarioNome + ' | ' + FCT.dataBR(t.quando) + ' ' + FCT.horaBR(t.quando) + ' | ' + modoNome(t.modo) + ' | tentativa ' + t.tentativaNum + ' | ' + FCT.fmtDur(t.duracao) + (t.candidato ? ' | Candidato: ' + t.candidato : ''), { c: [91, 96, 128] });
  y += 2; linha('Nota geral: ' + t.nota + ' / 100 (corte ' + av.corte + ') - ' + (av.falhasCriticas.length ? 'REPROVADO por falha crítica' : av.aprovado ? 'Aprovado' : 'Abaixo da nota de corte'), { b: true, s: 12 });
  linha('Avaliação: ' + (av.modoAvaliacao === 'ia' ? 'IA externa' : 'Demonstração (regras do app)'), { c: [91, 96, 128] });
  if (av.falhasCriticas.length) linha('Falhas críticas: ' + av.falhasCriticas.join(' | '), { b: true, c: [179, 38, 30] });
  y += 3; linha('Desempenho por bloco', { b: true, s: 12 }); av.blocos.forEach(function (b) { linha(b.nome + ': ' + (b.nota == null ? 'não se aplica' : b.nota) + (b.peso ? ' (peso ' + Math.round(b.peso * 100) + '%)' : '')); });
  y += 3; linha('Pontos fortes', { b: true, s: 12 }); av.fortes.forEach(function (f) { linha('- ' + f); });
  y += 3; linha('Prioridades de melhoria', { b: true, s: 12 }); (av.prioridades.length ? av.prioridades : [{ criterio: 'Nenhuma', motivo: '', melhor: '' }]).forEach(function (p, i) { linha((i + 1) + '. ' + p.criterio + (p.motivo ? ' - ' + p.motivo : '')); if (p.melhor) linha('   Como dizer melhor: ' + p.melhor, { c: [10, 122, 61] }); });
  if (av.etapasNaoCumpridas.length) { y += 3; linha('Etapas do script não cumpridas', { b: true, s: 12 }); av.etapasNaoCumpridas.forEach(function (x) { linha('- ' + x); }); }
  y += 3; linha('Transcrição', { b: true, s: 12 }); (t.transcricao || []).forEach(function (m) { linha((m.quem === 'op' ? 'Operador: ' : 'Cliente: ') + m.texto); });
  var n = d.internal.getNumberOfPages(); for (var i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(8); d.setTextColor(91, 96, 128); d.text(limpaPdf('Fênix Call Trainer v' + FCT.VERSAO + ' | página ' + i + ' de ' + n), 12, 291); }
  d.save('fenix-call-trainer-relatorio-' + FCT.dataBR(t.quando).replace(/\//g, '-') + '.pdf'); toast('PDF gerado.');
};
ACOES.certificado = function () {
  if (modulosDominados() < D.modulos.length) { toast('Domine todos os módulos para gerar o certificado.', 'err'); return; }
  var d = novoPdf('l'); if (!d) return; var W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight();
  d.setFillColor(243, 244, 249); d.rect(0, 0, W, H, 'F'); d.setDrawColor(4, 7, 152); d.setLineWidth(1.5); d.rect(8, 8, W - 16, H - 16); d.setFillColor(4, 18, 115); d.rect(8, 8, W - 16, 26, 'F');
  d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(22); d.text('Fênix Call Trainer', W / 2, 24, { align: 'center' });
  d.setTextColor(2, 7, 51); d.setFontSize(28); d.text('Certificado de conclusão', W / 2, 60, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(14); d.text('Certificamos que', W / 2, 78, { align: 'center' }); d.setFont('helvetica', 'bold'); d.setFontSize(26); d.text(limpaPdf(nomeUsuario()), W / 2, 94, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(13); var tx = d.splitTextToSize(limpaPdf('concluiu a trilha "Fundamentos do atendimento" (' + D.modulos.length + ' módulos), alcançando o critério de domínio: ' + E().config.nSeguidas + ' simulações seguidas com nota igual ou superior a ' + E().config.notaCorte + ' e sem falha crítica em cada módulo.'), W - 60); d.text(tx, W / 2, 110, { align: 'center' });
  d.setFontSize(11); d.setTextColor(91, 96, 128); d.text('Emitido em ' + FCT.dataBR(Date.now()) + ' | Documento gerado pelo aplicativo a partir do histórico neste aparelho.', W / 2, H - 22, { align: 'center' }); d.text('Fênix Soluções Tecnológicas', W / 2, H - 16, { align: 'center' });
  d.save('fenix-call-trainer-certificado.pdf'); toast('Certificado gerado.');
};

/* ================= MANUAL / SOBRE / PRIVACIDADE ================= */
var MANUAL = [
  ['Primeiro acesso', ['Informe o seu primeiro nome e aceite a política de privacidade.', 'Os dados ficam só neste aparelho. Formatar o aparelho ou limpar os dados do navegador apaga tudo: use Configurações → Exportar backup.']],
  ['Diagnóstico', ['Início → Fazer o diagnóstico: 6 perguntas rápidas.', 'O resultado indica por quais módulos da trilha começar.']],
  ['Trilha de aprendizagem', ['Abra o módulo: leia a mini-aula, veja o exemplo bom e o ruim, responda o exercício e simule.', 'Módulo dominado = 3 simulações seguidas com nota igual ou acima do corte e sem falha crítica (configurável).', 'Quando dominar os 10 módulos, o botão de certificado em PDF aparece.']],
  ['Treinar (4 modos)', ['<b>Leitura guiada:</b> leia o script em voz alta e toque em "próxima" a cada linha; mede ritmo, pausas e volume.', '<b>Simulação por texto:</b> escreva o que diria ao cliente virtual.', '<b>Simulação por voz:</b> fale pelo microfone; o cliente responde por voz. Precisa de Chrome ou Edge; sem suporte, o app usa texto.', '<b>Sem consulta:</b> o script fica oculto.', 'Pausar, Reiniciar e Finalizar ficam no topo da simulação.']],
  ['Relatório', ['Nota de 0 a 100, desempenho por bloco, pontos fortes e no máximo 3 prioridades, com trecho da conversa e "como dizer melhor".', 'Falha crítica (promessa indevida, desrespeito, dado pessoal exposto, expressão proibida, falta de confirmação de identidade quando exigida) reprova a tentativa.', 'O selo "Demonstração" indica que a avaliação foi feita por regras do app, sem IA externa.']],
  ['Laboratório de voz e Espelho de voz', ['Calibre a sua voz lendo o texto de referência: o app aprende o seu ritmo normal.', 'Espelho de voz (liga e desliga): medidores de velocidade, volume, tom e pausas com a sua zona confortável. Só você vê.', 'O app nunca diz como você se sente. A pergunta "Como você se sentiu?" é opcional, privada e não entra em nota.', 'O volume é relativo ao microfone: recalibre ao trocar de fone.']],
  ['Scripts e cenários (Instrutor)', ['Menu do avatar → mudar para Instrutor.', 'Scripts: crie, edite, duplique, arquive, exporte e importe (JSON). Cada etapa tem expressões esperadas que a avaliação confere por código.', 'Cenários: escolha script, perfil de cliente e dificuldade (1 a 4).']],
  ['Testes e seleção (Instrutor)', ['Crie o teste (cenário, tempo, corte, tentativas, script oculto, Espelho permitido ou bloqueado: igual para todos).', 'Aplique ao candidato: ele informa o nome, lê o aviso e aceita; pode responder por texto sem prejuízo.', 'Revise as evidências e registre a decisão: a decisão final é humana. Métricas de voz não aparecem para o instrutor.']],
  ['Backup e exclusão', ['Configurações → Exportar backup / Importar backup (substitui os dados atuais, pede a palavra IMPORTAR).', 'Excluir minha conta e meus dados pede a palavra APAGAR.']],
  ['IA externa (opcional)', ['Configurações → IA externa: informe o endereço HTTPS de uma função segura sua. Chaves de API nunca ficam no app.', 'Se a IA falhar, o app volta sozinho ao modo Demonstração e avisa.']]
];
function telaManual(app) { app.innerHTML = '<div class="manual"><h1>Manual do usuário</h1>' + MANUAL.map(function (s) { return '<h2>' + s[0] + '</h2><ul>' + s[1].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }).join('') + '<div class="linha" style="margin-top:14px"><button class="btn sec" data-act="manualBaixar">Baixar o manual (Markdown)</button></div></div>'; }
ACOES.manualBaixar = function () { baixar('fenix-call-trainer-manual.md', '# Fênix Call Trainer — Manual do usuário (v' + FCT.VERSAO + ')\n\n' + MANUAL.map(function (s) { return '## ' + s[0] + '\n\n' + s[1].map(function (x) { return '- ' + x.replace(/<\/?b>/g, '**'); }).join('\n'); }).join('\n\n') + '\n', 'text/markdown'); };
var CHANGELOG = [['1.0', '13/11/2026', '13/11/2026', ['Primeira versão: trilha de 10 módulos, diagnóstico, 5 scripts e 8 cenários-modelo (dados fictícios).', 'Simulação por texto e voz, leitura guiada e modo sem consulta; cliente virtual e avaliação por regras (modo Demonstração) com adaptador opcional de IA externa.', 'Laboratório de voz: linha de base pessoal, Espelho de voz (liga/desliga), alertas neutros, medição no aparelho.', 'Avaliação com rubrica, falhas críticas, relatório com evidências, histórico, comparação e PDF.', 'Modo Teste/Seleção padronizado com revisão humana e certificado em PDF.', 'Dados somente no aparelho (backup e exclusão). Ainda sem Fênix Core/Firebase e sem login.']]];
function telaSobre(app) {
  app.innerHTML = '<h1>Sobre</h1><div class="card"><p><b>Fênix Call Trainer</b> v' + FCT.VERSAO + ' <span class="chip">v' + FCT.VERSAO + ' | c —</span></p><p class="mut">"Não basta conhecer o script. É preciso dominar a conversa."</p><p class="mut">Fênix Soluções Tecnológicas — Aracaju, SE. Armazenamento: neste aparelho. Fênix Core: não integrado nesta versão.</p></div><h2>Changelog</h2>' + CHANGELOG.map(function (c) { return '<div class="card"><b>v' + c[0] + '</b> <span class="mut">criada em ' + c[1] + ' · modificada em ' + c[2] + '</span><ul>' + c[3].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '<div class="linha"><button class="btn sec" data-act="changelogBaixar">Baixar changelog</button></div>';
}
ACOES.changelogBaixar = function () { baixar('fenix-call-trainer-changelog.md', '# Changelog\n\n' + CHANGELOG.map(function (c) { return '## v' + c[0] + ' (criada em ' + c[1] + ', modificada em ' + c[2] + ')\n' + c[3].map(function (x) { return '- ' + x; }).join('\n'); }).join('\n\n') + '\n', 'text/markdown'); };
function telaPrivacidade(app) {
  app.innerHTML = (E().usuario.onboarding ? '' : '<a href="#/inicio">← Voltar ao primeiro acesso</a>') + '<h1>Privacidade e dados</h1><div class="card"><h2>Onde ficam os seus dados</h2><p>Somente neste aparelho (armazenamento do navegador). Nada é enviado a servidores pelo app, exceto se você ativar a IA externa em Configurações. Se você formatar o aparelho, limpar o histórico ou os dados do navegador, <b>tudo será perdido</b>.</p></div>' +
    '<div class="card"><h2>Sua voz</h2><ul><li>O áudio é medido no aparelho e <b>não é gravado</b>.</li><li>Guardamos só métricas e transcrição, e você pode desligar o histórico de métricas.</li><li>Para transcrever a fala, o navegador pode enviar o áudio ao serviço de reconhecimento de voz do fabricante (por exemplo, o Google no Chrome).</li><li>Nenhuma métrica vocal é usada para dizer como você se sente, nem para ranking, contratação ou decisão trabalhista.</li><li>Sotaque e características naturais da voz não são penalizados.</li></ul></div>' +
    '<div class="card"><h2>Seus direitos</h2><p>Você pode exportar tudo (Baixar meus dados), revogar o consentimento de voz e excluir tudo (Excluir minha conta e meus dados) em Configurações.</p></div><div class="aviso">Texto-modelo, sujeito a revisão jurídica antes de uso comercial. Encarregado de privacidade: Cristiano Rodrigues — trampodofenix@gmail.com.</div><p class="mut">Atualizado em 13/11/2026.</p>';
}

/* ================= INICIALIZAÇÃO ================= */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act],[data-go]');
  var av = $('#menuav');
  if (av && av.classList.contains('aberto') && !e.target.closest('#menuav') && !e.target.closest('#btnav')) fecharMenuAv();
  if (e.target.closest('#btnav')) { var m = $('#menuav'), ab = !m.classList.contains('aberto'); m.classList.toggle('aberto', ab); $('#btnav').setAttribute('aria-expanded', ab); return; }
  if (!el) return;
  if (el.dataset.act) { var fn = ACOES[el.dataset.act]; if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); } else if (window.console) console.warn('Ação sem implementação: ' + el.dataset.act); fecharMenuAv(); return; }
  if (el.dataset.go) { fecharMenuAv(); go(el.dataset.go); }
});
document.addEventListener('click', function (e) {
  var a = e.target.closest('nav.abas a, #app a[href^="#/"]'); if (!a) return;
  var h = a.getAttribute('href'); if (!h || h.charAt(0) !== '#') return; e.preventDefault(); go(h);
});
['input', 'change'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.target.closest('#app') && APP.edit) editSincronizar(e.target); }); });

function iniciar() {
  carregar(); montarLayout(); window.addEventListener('online', atualizarConexao); window.addEventListener('offline', atualizarConexao);
  var h = location.hash; APP.rota = (h && /^#\/(inicio|trilha|treinar|historico|mais|scripts|cenarios|voz|testes|config|manual|sobre|privacidade|diagnostico)/.test(h)) ? h : '#/inicio';
  if (/^#\/(sessao|teste|comparar|relatorio|script|aula)/.test(h) && h.indexOf('#/aula/') === 0) APP.rota = h;
  render();
  var sp = $('#splash'); setTimeout(function () { if (sp) { sp.classList.add('fora'); setTimeout(function () { sp.remove(); }, 300); } }, 350);
  window.__fenix = { APP: APP, FCT: FCT, ACOES: ACOES };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
