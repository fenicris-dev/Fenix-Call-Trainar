/* Fênix Call Trainer — interface (parte 1: base, rotas, telas principais) */
var D = window.FCT_DATA, esc = FCT.esc;
var APP = { chave: 'fenix_call_trainer_v1', estado: null, rota: '#/inicio', sujo: false, sessao: null, ignorarHash: false, erroLeitura: false };
var ACOES = {};
function E() { return APP.estado; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

/* ---------- armazenamento ---------- */
function carregar() {
  try {
    var raw = localStorage.getItem(APP.chave);
    APP.estado = raw ? FCT.migrar(JSON.parse(raw)) : FCT.estadoVazio();
  } catch (e) { APP.estado = FCT.estadoVazio(); APP.erroLeitura = true; }
  if (!E().semeado) {
    D.scripts.forEach(function (s) { if (!E().scripts.some(function (x) { return x.id === s.id; })) E().scripts.push(clone(s)); });
    D.cenarios.forEach(function (c) { if (!E().cenarios.some(function (x) { return x.id === c.id; })) E().cenarios.push(clone(c)); });
    E().semeado = true;
  }
}
function salvar() {
  try { localStorage.setItem(APP.chave, JSON.stringify(E())); return true; }
  catch (e) { toast('Não foi possível salvar no aparelho (armazenamento cheio ou bloqueado). Faça um backup.', 'err'); return false; }
}
function logAcesso(acao) {
  E().logAcesso.push({ quando: Date.now(), acao: acao, perfil: E().perfil });
  if (E().logAcesso.length > 200) E().logAcesso.splice(0, E().logAcesso.length - 200);
}

/* ---------- utilitários de UI ---------- */
function toast(msg, tipo) {
  var t = document.createElement('div'); t.className = 'toast' + (tipo === 'err' ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(function () { t.remove(); }, tipo === 'err' ? 5500 : 3200);
}
function modal(o) {
  var bg = document.createElement('div'); bg.className = 'modal-bg';
  var botoes = (o.botoes || [{ txt: 'Fechar', val: true }]).map(function (b, i) {
    return '<button class="btn ' + (b.cls || '') + '" data-mb="' + i + '">' + esc(b.txt) + '</button>';
  }).join(' ');
  bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(o.titulo || 'Aviso') + '"><h2>' + esc(o.titulo || '') + '</h2><div class="mcorpo">' + (o.corpo || '') + '</div><div class="linha" style="margin-top:14px;justify-content:flex-end">' + botoes + '</div></div>';
  document.body.appendChild(bg);
  return new Promise(function (res) {
    function fechar(v) { bg.remove(); res(v); }
    bg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mb]'); if (!b) return;
      var def = (o.botoes || [{ val: true }])[+b.dataset.mb];
      if (def.valida && !def.valida(bg)) return;
      fechar(def.fn ? def.fn(bg) : def.val);
    });
    if (o.aoAbrir) o.aoAbrir(bg);
    var f = bg.querySelector('input,select,textarea,button'); if (f) f.focus();
  });
}
function confirmar(titulo, msg, sim, nao) {
  return modal({ titulo: titulo, corpo: '<p>' + esc(msg) + '</p>', botoes: [{ txt: nao || 'Cancelar', val: false, cls: 'sec' }, { txt: sim || 'Confirmar', val: true }] });
}
function confirmarApagar(titulo, msg, palavra) {
  palavra = palavra || 'APAGAR';
  return modal({
    titulo: titulo, corpo: '<p>' + esc(msg) + '</p><label class="c" for="cfpal">Digite <b>' + palavra + '</b> para liberar o botão</label><input type="text" id="cfpal" autocomplete="off">',
    botoes: [{ txt: 'Cancelar', val: false, cls: 'sec' }, { txt: 'Apagar', val: true, cls: 'perigo', valida: function (bg) { return bg.querySelector('#cfpal').value.trim() === palavra; } }],
    aoAbrir: function (bg) { var b = bg.querySelector('[data-mb="1"]'); var i = bg.querySelector('#cfpal'); b.disabled = true; i.addEventListener('input', function () { b.disabled = i.value.trim() !== palavra; }); }
  });
}
function chip(t, c) { return '<span class="chip ' + (c || '') + '">' + esc(t) + '</span>'; }
function sw(id, rotulo, marcado, extra) { return '<label class="sw"><input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + (extra || '') + '><span class="tr"></span><span>' + esc(rotulo) + '</span></label>'; }
function iniciais(n) { n = (n || '').trim(); if (!n) return 'F'; var p = n.split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function nomeUsuario() { return E().usuario.nome || 'visitante'; }
function ehInstrutor() { return E().perfil === 'instrutor'; }
function baixar(nome, texto, tipo) {
  var b = new Blob([texto], { type: tipo || 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function scriptPorId(id) { return E().scripts.find(function (s) { return s.id === id; }); }
function cenarioPorId(id) { return E().cenarios.find(function (c) { return c.id === id; }); }
function moduloPorId(id) { return D.modulos.find(function (m) { return m.id === id; }); }
function tentativaPorId(id) { return E().tentativas.find(function (t) { return t.id === id; }); }
function modoNome(m) { return { leitura: 'Leitura guiada', texto: 'Simulação por texto', voz: 'Simulação por voz', semconsulta: 'Sem consulta' }[m] || m; }

/* ---------- gráfico SVG ---------- */
function grafLinha(pontos, o) {
  o = o || {}; var W = 320, H = 150, pl = 30, pr = 8, pt = 10, pb = 24;
  if (!pontos.length) return '<div class="vazio">Ainda não há dados para o gráfico.</div>';
  var n = pontos.length, x = function (i) { return n === 1 ? (pl + (W - pl - pr) / 2) : pl + (W - pl - pr) * i / (n - 1); }, y = function (v) { return pt + (H - pt - pb) * (1 - v / 100); };
  var s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.titulo || 'Gráfico de evolução') + '">';
  [0, 50, 100].forEach(function (v) { s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#dfe2ef"/><text x="2" y="' + (y(v) + 4) + '" font-size="9" fill="#5b6080">' + v + '</text>'; });
  if (o.corte != null) s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(o.corte) + '" y2="' + y(o.corte) + '" stroke="#ffcb00" stroke-width="2" stroke-dasharray="4 3"/><text x="' + (W - pr - 2) + '" y="' + (y(o.corte) - 3) + '" font-size="8" text-anchor="end" fill="#5b6080">corte ' + o.corte + '</text>';
  s += '<polyline fill="none" stroke="#0076CE" stroke-width="2.5" points="' + pontos.map(function (p, i) { return x(i) + ',' + y(p.v); }).join(' ') + '"/>';
  pontos.forEach(function (p, i) { s += '<circle cx="' + x(i) + '" cy="' + y(p.v) + '" r="4" fill="#041273"/><title>' + esc(p.x + ': ' + p.v) + '</title>'; if (n <= 8 || i % Math.ceil(n / 8) === 0) s += '<text x="' + x(i) + '" y="' + (H - 8) + '" font-size="8" text-anchor="middle" fill="#5b6080">' + esc(p.x) + '</text>'; });
  s += '</svg>';
  s += '<table class="sr"><caption>' + esc(o.titulo || 'Dados') + '</caption>' + pontos.map(function (p) { return '<tr><td>' + esc(p.x) + '</td><td>' + p.v + '</td></tr>'; }).join('') + '</table>';
  return s;
}

/* ---------- ícone provisório (a águia oficial não estava acessível no momento da construção) ---------- */
var ICONE_SVG = '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="gi" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#040798"/><stop offset="1" stop-color="#0076CE"/></linearGradient></defs><rect width="96" height="96" rx="20" fill="url(#gi)"/><path d="M48 18c4 10 12 14 22 16-6 4-9 9-9 15 6-1 12-4 17-9-1 15-10 27-30 36C28 70 19 58 18 40c5 5 11 8 17 9 0-6-3-11-9-15 10-2 18-6 22-16z" fill="#fff"/></svg>';
function iconeDataUri() { return 'data:image/svg+xml;utf8,' + encodeURIComponent(ICONE_SVG.replace(' aria-hidden="true"', '')); }

/* ---------- layout ---------- */
var ICONS = {
  inicio: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  trilha: '<svg viewBox="0 0 24 24"><path d="M4 19l4-14 4 10 4-10 4 14"/></svg>',
  treinar: '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  hist: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'
};
function montarLayout() {
  $('#raiz').innerHTML =
    '<header class="topo"><span class="logo">' + ICONE_SVG.replace('<svg ', '<svg width="36" height="36" ') + '</span><div class="tit">Fênix Call Trainer<small id="subtit"></small></div><span class="conx" id="conx">No aparelho</span><button class="avatar" id="btnav" aria-haspopup="true" aria-expanded="false" aria-label="Menu do usuário">F</button></header>' +
    '<div class="menuav" id="menuav" role="menu"></div>' +
    '<main id="app" tabindex="-1"></main>' +
    '<footer class="rod"><div><span id="ano"></span> <a href="https://wa.me/5579999680880" target="_blank" rel="noopener">&lt;Cristiano Fênix/&gt;</a> | <a href="https://instagram.com/fenixsolucoestecnologicas" target="_blank" rel="noopener">© Fênix Soluções Tecnológicas</a></div><div id="versao">Fênix Call Trainer v' + FCT.VERSAO + '</div></footer>' +
    '<nav class="abas" aria-label="Navegação principal">' +
    '<a href="#/inicio" data-aba="inicio">' + ICONS.inicio + 'Início</a><a href="#/trilha" data-aba="trilha">' + ICONS.trilha + 'Trilha</a>' +
    '<a href="#/treinar" data-aba="treinar" class="centro"><span class="bola">' + ICONS.treinar + '</span>Treinar</a>' +
    '<a href="#/historico" data-aba="historico">' + ICONS.hist + 'Evolução</a><a href="#/mais" data-aba="mais">' + ICONS.mais + 'Mais</a></nav>';
  $('#ano').textContent = new Date().getFullYear();
  atualizarConexao();
}
function atualizarConexao() {
  var c = $('#conx'); if (!c) return;
  if (navigator.onLine === false) { c.textContent = 'Offline'; c.className = 'conx off'; } else { c.textContent = 'No aparelho'; c.className = 'conx'; }
}
function atualizarTopo() {
  var av = $('#btnav'); if (av) av.textContent = iniciais(E().usuario.nome);
  var st = $('#subtit'); if (st) st.textContent = E().perfil === 'instrutor' ? 'Instrutor / Recrutador' : 'Operador / Candidato';
  var m = $('#menuav');
  if (m) m.innerHTML = '<div class="nm">' + esc(nomeUsuario()) + '</div>' +
    '<button data-act="trocarPerfil" role="menuitem">Perfil: ' + (ehInstrutor() ? 'Instrutor → mudar para Operador' : 'Operador → mudar para Instrutor') + '</button>' +
    '<button data-go="#/manual" role="menuitem">Ajuda (manual)</button><button data-go="#/config" role="menuitem">Configurações</button>';
}
ACOES.trocarPerfil = function () {
  E().perfil = ehInstrutor() ? 'operador' : 'instrutor'; logAcesso('trocar_perfil'); salvar(); fecharMenuAv(); atualizarTopo(); go('#/inicio'); toast('Perfil: ' + (ehInstrutor() ? 'Instrutor' : 'Operador'));
};
function fecharMenuAv() { var m = $('#menuav'); if (m) m.classList.remove('aberto'); var b = $('#btnav'); if (b) b.setAttribute('aria-expanded', 'false'); }

/* ---------- roteamento com proteção de saída (regra 71) ---------- */
function go(rota) {
  if (rota === APP.rota) { render(); return; }
  if (APP.sujo) {
    confirmar('Deseja sair desta tela?', APP.sessao && APP.sessao.ativa ? 'A simulação em andamento será encerrada e você perde o que ainda não foi avaliado.' : 'Você tem alterações não salvas. Se sair, elas serão perdidas.', 'Sair', 'Ficar').then(function (ok) {
      if (!ok) return;
      if (ACOES._descartar) ACOES._descartar();
      APP.sujo = false; mudarRota(rota);
    });
    return;
  }
  mudarRota(rota);
}
function mudarRota(rota) { APP.rota = rota; APP.ignorarHash = true; if (location.hash !== rota) location.hash = rota; setTimeout(function () { APP.ignorarHash = false; }, 0); render(); }
window.addEventListener('hashchange', function () {
  if (APP.ignorarHash) return;
  var nova = location.hash || '#/inicio';
  if (nova === APP.rota) return;
  if (APP.sujo) { APP.ignorarHash = true; location.hash = APP.rota; setTimeout(function () { APP.ignorarHash = false; go(nova); }, 0); return; }
  APP.rota = nova; render();
});
window.addEventListener('beforeunload', function (e) { if (APP.sujo) { e.preventDefault(); e.returnValue = ''; } });

function partes() { var r = (APP.rota || '#/inicio').replace(/^#\//, '').split('/'); return r; }
function render() {
  var p = partes(), tela = p[0] || 'inicio', app = $('#app');
  if (!E().usuario.onboarding && tela !== 'privacidade') { telaOnboarding(); return; }
  $$('nav.abas a').forEach(function (a) { a.classList.toggle('ativa', a.dataset.aba === ({ inicio: 'inicio', trilha: 'trilha', aula: 'trilha', diagnostico: 'trilha', treinar: 'treinar', sessao: 'treinar', historico: 'historico', relatorio: 'historico', comparar: 'historico' }[tela] || 'mais')); });
  var T = { inicio: telaInicio, trilha: telaTrilha, aula: telaAula, diagnostico: telaDiagnostico, treinar: telaTreinar, sessao: telaSessao, relatorio: telaRelatorio, testefim: telaRelatorio, historico: telaHistorico, comparar: telaComparar, mais: telaMais, scripts: telaScripts, script: telaScriptEditor, cenarios: telaCenarios, voz: telaVoz, testes: telaTestes, teste: telaTeste, config: telaConfig, manual: telaManual, sobre: telaSobre, privacidade: telaPrivacidade };
  var fn = T[tela] || telaInicio;
  atualizarTopo();
  app.innerHTML = '';
  try { fn(app, p); } catch (e) { app.innerHTML = '<div class="card"><h2>Algo deu errado nesta tela</h2><p class="mut">' + esc(e.message) + '</p><a class="btn" href="#/inicio">Voltar ao início</a></div>'; if (window.console) console.error(e); }
  window.scrollTo(0, 0);
}

/* ---------- primeiro acesso ---------- */
function telaOnboarding() {
  $('#app').innerHTML = '<div class="card"><h1>Bem-vindo ao Fênix Call Trainer</h1><p class="mut">Treine, simule e seja avaliado como operador de call center. Seus dados ficam <b>somente neste aparelho</b>.</p>' +
    '<label class="c" for="ob_nome">Seu primeiro nome</label><input type="text" id="ob_nome" autocomplete="given-name" maxlength="40" placeholder="Ex.: Ana">' +
    '<div class="aviso"><b>Onde ficam os dados?</b> No aparelho (padrão). Se você formatar o aparelho, limpar o histórico ou os dados do navegador, <b>tudo será perdido</b>. Use o backup (Configurações) para guardar uma cópia. A opção de guardar na nuvem ainda não está disponível nesta versão.</div>' +
    '<label class="sw"><input type="checkbox" id="ob_ok"><span class="tr"></span><span>Li e aceito a <a href="#/privacidade" target="_blank">política de privacidade</a></span></label>' +
    '<div class="erro" id="ob_erro" role="alert"></div><div class="linha" style="margin-top:10px"><button class="btn" data-act="obConcluir">Começar</button></div></div>';
  $$('nav.abas a').forEach(function (a) { a.classList.remove('ativa'); });
}
ACOES.obConcluir = function () {
  var n = $('#ob_nome').value.trim(), er = $('#ob_erro');
  if (!n) { er.textContent = 'Informe o seu primeiro nome.'; return; }
  if (!$('#ob_ok').checked) { er.textContent = 'É preciso aceitar a política de privacidade para continuar.'; return; }
  E().usuario.nome = n.replace(/[<>]/g, ''); E().usuario.onboarding = true; logAcesso('onboarding'); salvar(); atualizarTopo(); go('#/inicio');
};

/* ---------- início ---------- */
function mediaNotas(ts) { return ts.length ? Math.round(FCT.media(ts.map(function (t) { return t.nota; }))) : null; }
function dominioModulo(m) { return FCT.dominio(m.cenarioIds, E().tentativas, E().config.notaCorte, E().config.nSeguidas); }
function modulosDominados() { return D.modulos.filter(function (m) { return dominioModulo(m).dominado; }).length; }
function dificuldades(ts) {
  var cont = {};
  ts.forEach(function (t) { if (!t.avaliacao) return; t.avaliacao.blocos.forEach(function (b) { b.criterios.forEach(function (c) { if (c.nivel === 0 || c.nivel === 1) { cont[c.nome] = (cont[c.nome] || 0) + 1; } }); }); });
  return Object.keys(cont).map(function (k) { return { nome: k, n: cont[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
}
function proximoModulo() {
  var m = D.modulos.find(function (x) { var d = dominioModulo(x); return !d.dominado || d.revisao; });
  return m || D.modulos[0];
}
var periodoGraf = 'dia';
function telaInicio(app) {
  if (ehInstrutor()) return telaInicioInstrutor(app);
  var ts = E().tentativas.filter(function (t) { return t.tipo !== 'teste'; });
  var med = mediaNotas(ts), dom = modulosDominados(), prox = proximoModulo();
  var h = '<h1>Olá, ' + esc(nomeUsuario()) + '!</h1><p class="mut">Treinar → Simular → Receber feedback → Repetir → Evoluir.</p>';
  if (APP.erroLeitura) h += '<div class="aviso">Não foi possível ler os dados salvos. Você começou com um espaço limpo; se tiver um backup, importe em Configurações.</div>';
  if (!E().diagnostico) h += '<div class="card clic" data-go="#/diagnostico"><h2>Comece pelo diagnóstico</h2><p class="mut">6 perguntas rápidas para saber por onde começar.</p><span class="btn peq">Fazer o diagnóstico</span></div>';
  if (!E().base) h += '<div class="card clic" data-go="#/voz"><h2>Calibre a sua voz</h2><p class="mut">Leia um texto curto para o app conhecer o seu ritmo normal. É opcional e só para você.</p><span class="btn peq sec">Calibrar agora</span></div>';
  h += '<div class="grid g3"><div class="card kpi" data-go="#/historico"><b>' + ts.length + '</b><span>Treinos feitos</span></div><div class="card kpi" data-go="#/historico"><b>' + (med == null ? '—' : med) + '</b><span>Média geral</span></div><div class="card kpi" data-go="#/trilha"><b>' + dom + '/' + D.modulos.length + '</b><span>Módulos dominados</span></div></div>';
  h += '<div class="card"><h2>Próximo passo</h2><p><b>' + esc(prox.titulo) + '</b> <span class="mut">(' + prox.minutos + ' min)</span></p><div class="linha"><a class="btn" href="#/aula/' + prox.id + '">Abrir aula</a><button class="btn sec" data-act="treinarModulo" data-m="' + prox.id + '">Ir direto à simulação</button></div></div>';
  h += '<div class="card"><div class="linha entre"><h2>Evolução das notas</h2><div class="linha">' + ['dia', 'semana', 'mes'].map(function (p) { return '<button class="btn peq ' + (periodoGraf === p ? '' : 'sec') + '" data-act="periodo" data-p="' + p + '">' + { dia: 'Dia', semana: 'Semana', mes: 'Mês' }[p] + '</button>'; }).join('') + '</div></div>' +
    grafLinha(FCT.agruparPorPeriodo(ts, periodoGraf).map(function (g) { return { x: g.chave.slice(periodoGraf === 'mes' ? 2 : 5), v: g.media }; }), { corte: E().config.notaCorte, titulo: 'Evolução das notas por ' + periodoGraf }) + '</div>';
  var df = dificuldades(ts.slice(-10));
  h += '<div class="card"><h2>Principais dificuldades</h2>' + (df.length ? df.map(function (d) { return '<div class="lista-item"><span style="flex:1">' + esc(d.nome) + '</span>' + chip(d.n + ' vez(es)', 'am') + '</div>'; }).join('') : '<p class="vazio">Faça uma simulação para ver onde melhorar.</p>') + '</div>';
  app.innerHTML = h;
}
ACOES.periodo = function (el) { periodoGraf = el.dataset.p; render(); };
ACOES.treinarModulo = function (el) { var m = moduloPorId(el.dataset.m); iniciarPreparo({ cenarioId: m.cenarioIds[0], modo: 'texto', moduloId: m.id }); };

function telaInicioInstrutor(app) {
  var testes = E().testes, tt = E().tentativas.filter(function (t) { return t.tipo === 'teste'; });
  var pend = tt.filter(function (t) { return !t.revisao; }).length;
  var h = '<h1>Painel do instrutor</h1><p class="mut">Resultados de testes e dificuldades da turma (por critério, nunca por pessoa).</p>';
  h += '<div class="grid g3"><div class="card kpi" data-go="#/testes"><b>' + testes.length + '</b><span>Testes criados</span></div><div class="card kpi" data-go="#/testes"><b>' + tt.length + '</b><span>Candidatos avaliados</span></div><div class="card kpi" data-go="#/testes"><b>' + pend + '</b><span>Aguardando revisão</span></div></div>';
  h += '<div class="grid g2"><div class="card kpi" data-go="#/scripts"><b>' + E().scripts.filter(function (s) { return !s.arquivado; }).length + '</b><span>Scripts ativos</span></div><div class="card kpi" data-go="#/cenarios"><b>' + E().cenarios.length + '</b><span>Cenários</span></div></div>';
  var df = dificuldades(tt.map(FCT.visaoInstrutor));
  h += '<div class="card"><h2>Dificuldades recorrentes nos testes</h2>' + (df.length ? df.map(function (d) { return '<div class="lista-item"><span style="flex:1">' + esc(d.nome) + '</span>' + chip(d.n, 'am') + '</div>'; }).join('') : '<p class="vazio">Sem testes aplicados ainda.</p>') + '</div>';
  h += '<div class="aviso">Por privacidade, o instrutor não vê métricas de voz, o Espelho de voz nem a autopercepção do operador.</div>';
  app.innerHTML = h;
}

/* ---------- diagnóstico ---------- */
var MAPA_DIAG = ['m1', 'm7', 'm5', 'm8', 'm2', 'm9'];
function telaDiagnostico(app) {
  var d = E().diagnostico;
  var h = '<h1>Diagnóstico inicial</h1><p class="mut">Responda com o que você faria numa ligação. Não vale pesquisar: o objetivo é saber por onde começar.</p>';
  if (d) h += '<div class="card"><h2>Seu último resultado: ' + d.nota + '</h2><p class="mut">' + FCT.dataBR(d.feitoEm) + ' — ' + d.acertos + ' de ' + d.total + ' acertos.</p></div>';
  h += '<form id="fdiag">' + D.diagnostico.map(function (q, i) {
    return '<fieldset class="card" style="border:0"><legend><b>' + (i + 1) + '. ' + esc(q.p) + '</b></legend>' + q.opcoes.map(function (o, j) {
      return '<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="radio" name="q' + i + '" value="' + j + '"> ' + esc(o) + '</label>';
    }).join('') + '</fieldset>';
  }).join('') + '<div class="erro" id="diagerro" role="alert"></div><button type="button" class="btn" data-act="diagEnviar">Ver resultado</button></form><div id="diagres"></div>';
  app.innerHTML = h;
}
ACOES.diagEnviar = function () {
  var resp = [], falta = false;
  D.diagnostico.forEach(function (q, i) { var r = $('input[name=q' + i + ']:checked'); if (!r) falta = true; resp.push(r ? +r.value : -1); });
  if (falta) { $('#diagerro').textContent = 'Responda todas as perguntas.'; return; }
  var r = FCT.corrigirQuiz(D.diagnostico, resp);
  var erradas = []; r.detalhes.forEach(function (d, i) { if (!d.ok && MAPA_DIAG[i]) erradas.push(MAPA_DIAG[i]); });
  E().diagnostico = { feitoEm: Date.now(), nota: r.nota, acertos: r.acertos, total: r.total, recomendados: erradas };
  logAcesso('diagnostico'); salvar();
  var h = '<div class="card"><h2>Resultado: ' + r.nota + ' (' + r.acertos + '/' + r.total + ')</h2>' + r.detalhes.map(function (d, i) {
    return '<p>' + (d.ok ? '✅' : '❌') + ' <b>' + (i + 1) + '.</b> ' + (d.ok ? 'Correta.' : 'Resposta esperada: ' + esc(d.certa) + '.') + ' <span class="mut">' + esc(d.explica) + '</span></p>';
  }).join('') + (erradas.length ? '<p><b>Comece por:</b> ' + erradas.map(function (m) { return '<a href="#/aula/' + m + '">' + esc(moduloPorId(m).titulo) + '</a>'; }).join(', ') + '.</p>' : '<p>Ótimo! Siga para as simulações.</p>') + '<a class="btn" href="#/trilha">Ir para a trilha</a></div>';
  $('#diagres').innerHTML = h; $('#fdiag').style.display = 'none'; window.scrollTo(0, 0);
};

/* ---------- trilha e aulas ---------- */
function telaTrilha(app) {
  var dom = modulosDominados();
  var h = '<h1>Trilha: Fundamentos do atendimento</h1><p class="mut">Cada módulo: mini-aula → exemplo bom e ruim → exercício → simulação → feedback. Dominado = ' + E().config.nSeguidas + ' simulações seguidas com nota ≥ ' + E().config.notaCorte + ' e sem falha crítica.</p>';
  h += '<div class="card"><div class="linha entre"><b>' + dom + ' de ' + D.modulos.length + ' módulos dominados</b></div><div class="barra" style="margin-top:6px"><i style="width:' + Math.round(dom / D.modulos.length * 100) + '%"></i></div>' +
    (dom === D.modulos.length ? '<div style="margin-top:10px"><button class="btn" data-act="certificado">Gerar certificado (PDF)</button></div>' : '') + '</div>';
  D.modulos.forEach(function (m, i) {
    var d = dominioModulo(m), pr = E().modulos[m.id] || {};
    var st = d.dominado ? chip('Dominado', 'ok') : (d.seqAtual > 0 ? chip('Em andamento ' + d.seqAtual + '/' + d.necessarias, 'am') : chip('Novo'));
    if (d.revisao) st += chip('Revisão ' + (d.revisao === 'revisao7' ? '7' : '30') + ' dias', 'am');
    if (pr.quizNota != null) st += chip('Exercício ' + pr.quizNota, '');
    h += '<div class="card clic" data-go="#/aula/' + m.id + '"><div class="linha entre"><b>' + (i + 1) + '. ' + esc(m.titulo) + '</b><span class="mut">' + m.minutos + ' min</span></div><div>' + st + '</div></div>';
  });
  app.innerHTML = h;
}
function telaAula(app, p) {
  var m = moduloPorId(p[1]); if (!m) { app.innerHTML = '<div class="card">Módulo não encontrado. <a href="#/trilha">Voltar</a></div>'; return; }
  var pr = E().modulos[m.id] || {}, d = dominioModulo(m);
  var h = '<a href="#/trilha">← Trilha</a><h1>' + esc(m.titulo) + '</h1><p class="mut">Mini-aula de ' + m.minutos + ' minutos. ' + (d.dominado ? 'Módulo dominado.' : 'Sequência atual: ' + d.seqAtual + '/' + d.necessarias + '.') + '</p>';
  h += '<div class="card"><h2>O que saber</h2><ul>' + m.pontos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
  h += '<div class="grid gauto"><div class="card" style="border-left:5px solid var(--ok)"><h3>✅ Exemplo bom</h3><p>' + esc(m.bom) + '</p></div><div class="card" style="border-left:5px solid var(--bad)"><h3>⛔ Exemplo ruim</h3><p>' + esc(m.ruim) + '</p></div></div>';
  h += '<div class="card"><h2>Exercício</h2><form id="fq">' + m.quiz.map(function (q, i) {
    return '<fieldset style="border:0;padding:0;margin:0 0 10px"><legend><b>' + (i + 1) + '. ' + esc(q.p) + '</b></legend>' + q.opcoes.map(function (o, j) { return '<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="radio" name="q' + i + '" value="' + j + '"> ' + esc(o) + '</label>'; }).join('') + '</fieldset>';
  }).join('') + '<div class="erro" id="qerro" role="alert"></div><button type="button" class="btn" data-act="quizEnviar" data-m="' + m.id + '">Corrigir</button></form><div id="qres">' + (pr.quizNota != null ? '<p class="mut">Última nota: ' + pr.quizNota + ' (' + FCT.dataBR(pr.quizEm) + ')</p>' : '') + '</div></div>';
  var cens = m.cenarioIds.map(cenarioPorId).filter(Boolean);
  h += '<div class="card"><h2>Simulação</h2>' + cens.map(function (c) { return '<div class="lista-item"><div style="flex:1"><b>' + esc(c.nome) + '</b><br>' + chip(FCT.PERFIS[c.perfil].nome) + chip('Nível ' + c.nivel + ' — ' + FCT.NIVEIS[c.nivel]) + '</div><button class="btn peq" data-act="treinarCenario" data-c="' + c.id + '" data-m="' + m.id + '">Simular</button></div>'; }).join('') + '</div>';
  app.innerHTML = h;
}
ACOES.quizEnviar = function (el) {
  var m = moduloPorId(el.dataset.m), resp = [], falta = false;
  m.quiz.forEach(function (q, i) { var r = $('#fq input[name=q' + i + ']:checked'); if (!r) falta = true; resp.push(r ? +r.value : -1); });
  if (falta) { $('#qerro').textContent = 'Responda todas as perguntas.'; return; }
  $('#qerro').textContent = '';
  var r = FCT.corrigirQuiz(m.quiz, resp);
  E().modulos[m.id] = Object.assign(E().modulos[m.id] || {}, { quizNota: r.nota, quizEm: Date.now(), aulaConcluida: true }); salvar();
  $('#qres').innerHTML = '<div class="aviso"><b>Nota ' + r.nota + ' (' + r.acertos + '/' + r.total + ')</b></div>' + r.detalhes.map(function (d) { return '<p>' + (d.ok ? '✅' : '❌') + ' ' + esc(d.q) + ' <span class="mut">' + (d.ok ? '' : 'Esperado: ' + esc(d.certa) + '. ') + esc(d.explica) + '</span></p>'; }).join('');
};
ACOES.treinarCenario = function (el) { iniciarPreparo({ cenarioId: el.dataset.c, modo: 'texto', moduloId: el.dataset.m }); };

/* ---------- histórico e comparação ---------- */
var filtroHist = 'todos', selComp = [];
function telaHistorico(app) {
  var base = ehInstrutor() ? E().tentativas.filter(function (t) { return t.tipo === 'teste'; }) : E().tentativas.filter(function (t) { return t.tipo !== 'teste'; });
  var ts = base.slice().sort(function (a, b) { return b.quando - a.quando; });
  var h = '<h1>' + (ehInstrutor() ? 'Resultados dos testes' : 'Minha evolução') + '</h1>';
  if (!ts.length) { app.innerHTML = h + '<div class="card vazio">Nenhuma tentativa ainda. ' + (ehInstrutor() ? '' : '<br><a class="btn" href="#/treinar" style="margin-top:8px">Fazer a primeira simulação</a>') + '</div>'; return; }
  if (!ehInstrutor()) {
    h += '<div class="card"><div class="linha entre"><h2>Notas ao longo do tempo</h2><div class="linha">' + ['dia', 'semana', 'mes'].map(function (p) { return '<button class="btn peq ' + (periodoGraf === p ? '' : 'sec') + '" data-act="periodoH" data-p="' + p + '">' + { dia: 'Dia', semana: 'Semana', mes: 'Mês' }[p] + '</button>'; }).join('') + '</div></div>' +
      grafLinha(FCT.agruparPorPeriodo(base, periodoGraf).map(function (g) { return { x: g.chave.slice(periodoGraf === 'mes' ? 2 : 5), v: g.media }; }), { corte: E().config.notaCorte, titulo: 'Notas por ' + periodoGraf }) + '</div>';
    // comparação por modalidade
    var por = {}; base.forEach(function (t) { var s = scriptPorId(t.scriptId); var k = s ? s.modalidade : 'inbound'; (por[k] = por[k] || []).push(t.nota); });
    h += '<div class="card"><h2>Por modalidade</h2>' + Object.keys(por).map(function (k) { var nome = (D.OPERACOES.find(function (o) { return o.id === k; }) || { nome: k }).nome; var md = Math.round(FCT.media(por[k])); return '<div class="lista-item"><span style="flex:1">' + esc(nome) + ' <span class="mut">(' + por[k].length + ')</span></span><b>' + md + '</b></div>'; }).join('') + '</div>';
    // evolução da meta do espelho
    var esp = base.filter(function (t) { return t.privado && t.privado.espelho && t.privado.espelho.pctZona != null; });
    if (esp.length) h += '<div class="card"><h2>Espelho de voz: % do tempo na sua zona</h2>' + grafLinha(esp.map(function (t) { return { x: FCT.dataBR(t.quando).slice(0, 5), v: Math.round(t.privado.espelho.pctZona * 100) }; }), { corte: Math.round(E().config.metaZona * 100), titulo: 'Percentual na zona' }) + '<p class="mut">Só você vê isto. A linha amarela é a sua meta.</p></div>';
  }
  h += '<div class="card"><div class="linha entre"><h2>Tentativas</h2><button class="btn peq sec" data-act="comparar" ' + (selComp.length === 2 ? '' : 'disabled') + '>Comparar (' + selComp.length + '/2)</button></div>';
  h += ts.map(function (t) {
    var chk = selComp.indexOf(t.id) >= 0 ? ' checked' : '';
    return '<div class="lista-item"><input type="checkbox" aria-label="Selecionar para comparar" data-act="selComp" data-id="' + t.id + '"' + chk + ' style="width:22px;height:22px"><div style="flex:1;cursor:pointer" data-go="#/relatorio/' + t.id + '"><b>' + esc(t.cenarioNome) + '</b>' + (t.candidato ? ' <span class="mut">— ' + esc(t.candidato) + '</span>' : '') + '<br><span class="mut">' + FCT.dataBR(t.quando) + ' ' + FCT.horaBR(t.quando) + ' · ' + modoNome(t.modo) + ' · tentativa ' + t.tentativaNum + ' · ' + FCT.fmtDur(t.duracao) + '</span></div><div style="text-align:right"><b style="font-size:1.2rem">' + t.nota + '</b><br>' + (t.falhaCritica ? chip('Falha crítica', 'bad') : t.aprovado ? chip('Aprovado', 'ok') : chip('Abaixo do corte', 'am')) + '</div></div>';
  }).join('') + '</div>';
  app.innerHTML = h;
}
ACOES.periodoH = function (el) { periodoGraf = el.dataset.p; render(); };
ACOES.selComp = function (el) {
  var id = el.dataset.id, i = selComp.indexOf(id);
  if (el.checked) { if (selComp.length >= 2) { el.checked = false; toast('Selecione no máximo 2 tentativas.'); return; } selComp.push(id); } else if (i >= 0) selComp.splice(i, 1);
  var b = $('[data-act=comparar]'); if (b) { b.disabled = selComp.length !== 2; b.textContent = 'Comparar (' + selComp.length + '/2)'; }
};
ACOES.comparar = function () { if (selComp.length === 2) go('#/comparar/' + selComp[0] + '/' + selComp[1]); };
function telaComparar(app, p) {
  var a = tentativaPorId(p[1]), b = tentativaPorId(p[2]);
  if (!a || !b) { app.innerHTML = '<div class="card">Tentativas não encontradas. <a href="#/historico">Voltar</a></div>'; return; }
  if (a.quando > b.quando) { var x = a; a = b; b = x; }
  if (ehInstrutor()) { a = FCT.visaoInstrutor(a); b = FCT.visaoInstrutor(b); }
  function col(t, tit) {
    return '<div class="card"><h3>' + tit + '</h3><p class="mut">' + FCT.dataBR(t.quando) + ' ' + FCT.horaBR(t.quando) + ' · ' + esc(t.cenarioNome) + '</p><div class="nota">' + t.nota + '</div>' + t.avaliacao.blocos.map(function (bl) { return '<div class="lista-item"><span style="flex:1">' + esc(bl.nome) + '</span><b>' + (bl.nota == null ? '—' : bl.nota) + '</b></div>'; }).join('') + '</div>';
  }
  var h = '<a href="#/historico">← Evolução</a><h1>Comparação</h1><div class="grid gauto">' + col(a, 'Antes') + col(b, 'Depois') + '</div>';
  var dn = b.nota - a.nota;
  h += '<div class="aviso"><b>' + (dn > 0 ? 'Subiu ' + dn + ' ponto(s).' : dn < 0 ? 'Caiu ' + Math.abs(dn) + ' ponto(s).' : 'Mesma nota.') + '</b> ' + FCT.dataBR(a.quando) + ' → ' + FCT.dataBR(b.quando) + '</div>';
  if (!ehInstrutor() && a.privado && b.privado && a.privado.voz && b.privado.voz) {
    var va = a.privado.voz, vb = b.privado.voz;
    h += '<div class="card"><h2>Voz (só para você)</h2><table class="t"><tr><th></th><th>Antes</th><th>Depois</th></tr>' +
      linhaVoz('Velocidade (palavras/min)', va.wpm, vb.wpm) + linhaVoz('Pausas', va.resumo && va.resumo.pausas, vb.resumo && vb.resumo.pausas) + linhaVoz('Pausas longas', va.resumo && va.resumo.pausasLongas, vb.resumo && vb.resumo.pausasLongas) + linhaVoz('Inteligibilidade estimada (%)', va.intel, vb.intel) + '</table></div>';
  }
  h += '<div class="grid gauto"><details><summary>Transcrição — antes</summary>' + transcricaoHtml(a) + '</details><details><summary>Transcrição — depois</summary>' + transcricaoHtml(b) + '</details></div>';
  app.innerHTML = h;
}
function linhaVoz(n, a, b) { return '<tr><td>' + n + '</td><td>' + (a == null ? '—' : Math.round(a)) + '</td><td>' + (b == null ? '—' : Math.round(b)) + '</td></tr>'; }
function transcricaoHtml(t) { return '<div class="chat" style="max-height:none">' + (t.transcricao || []).map(function (m) { return '<div class="msg ' + m.quem + '"><small>' + (m.quem === 'op' ? 'Você' : 'Cliente') + '</small>' + esc(m.texto) + '</div>'; }).join('') + '</div>'; }

/* ---------- mais ---------- */
function telaMais(app) {
  var itens = [['#/scripts', 'Scripts', ehInstrutor() ? 'Criar e editar scripts' : 'Ver os scripts (somente leitura)'], ['#/cenarios', 'Cenários', 'Perfis de cliente e dificuldade'], ['#/voz', 'Laboratório de voz', 'Linha de base, Espelho de voz e microfone'], ['#/testes', 'Testes e seleção', ehInstrutor() ? 'Criar e aplicar testes' : 'Testes aplicados a candidatos'], ['#/diagnostico', 'Diagnóstico', 'Descubra por onde começar'], ['#/config', 'Configurações', 'Backup, faixas-alvo, IA externa'], ['#/manual', 'Manual do usuário', 'Passo a passo'], ['#/sobre', 'Sobre e changelog', 'Versão ' + FCT.VERSAO], ['#/privacidade', 'Privacidade e dados', 'O que fica no seu aparelho']];
  app.innerHTML = '<h1>Mais</h1>' + itens.map(function (i) { return '<div class="card clic" data-go="' + i[0] + '"><b>' + i[1] + '</b><br><span class="mut">' + i[2] + '</span></div>'; }).join('');
}
