/* Fênix Call Trainer — interface (parte 2: scripts, cenários, treino, sessão, relatório) */

/* ================= SCRIPTS ================= */
function telaScripts(app) {
  var h = '<div class="linha entre"><h1>Scripts</h1>' + (ehInstrutor() ? '<div class="linha"><button class="btn peq" data-act="scriptNovo">Novo script</button><button class="btn peq sec" data-act="scriptImportar">Importar</button><input type="file" id="fimp" accept=".json,application/json" class="sr" tabindex="-1"></div>' : '') + '</div>';
  if (!ehInstrutor()) h += '<div class="aviso">Você está no perfil Operador: pode ver os scripts, mas não editar. Para editar, troque para Instrutor no menu do avatar.</div>';
  var ativos = E().scripts.filter(function (s) { return !s.arquivado; }), arq = E().scripts.filter(function (s) { return s.arquivado; });
  function item(s) {
    var op = (D.OPERACOES.find(function (o) { return o.id === s.modalidade; }) || { nome: s.modalidade }).nome.split(' (')[0];
    return '<div class="card"><div class="linha entre"><div style="flex:1;min-width:0"><b>' + esc(s.nome) + '</b><br>' + chip(op) + chip({ rigido: 'Rígido', flexivel: 'Flexível', consultivo: 'Consultivo' }[s.tipo] || s.tipo) + chip('v' + s.versao) + (s.modelo ? chip('Modelo editável', 'am') : '') + (s.arquivado ? chip('Arquivado') : '') + '</div></div>' +
      '<div class="linha" style="margin-top:6px"><a class="btn peq" href="#/script/' + s.id + '">' + (ehInstrutor() ? 'Editar' : 'Ver') + '</a>' +
      (ehInstrutor() ? '<button class="btn peq sec" data-act="scriptDup" data-id="' + s.id + '">Duplicar</button><button class="btn peq sec" data-act="scriptArq" data-id="' + s.id + '">' + (s.arquivado ? 'Desarquivar' : 'Arquivar') + '</button><button class="btn peq sec" data-act="scriptExp" data-id="' + s.id + '">Exportar</button><button class="btn peq sec" data-act="scriptDel" data-id="' + s.id + '">Excluir</button>' : '') + '</div></div>';
  }
  h += ativos.length ? ativos.map(item).join('') : '<div class="card vazio">Nenhum script ativo.</div>';
  if (arq.length) h += '<details><summary>Arquivados (' + arq.length + ')</summary>' + arq.map(item).join('') + '</details>';
  app.innerHTML = h;
  var fi = $('#fimp'); if (fi) fi.addEventListener('change', importarScript);
}
ACOES.scriptNovo = function () { go('#/script/novo'); };
ACOES.scriptImportar = function () { $('#fimp').click(); };
function importarScript(ev) {
  var f = ev.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var o = JSON.parse(r.result);
      if (o && o.tipoArquivo === 'fenix-script' && o.script) o = o.script;
      if (!o || typeof o.nome !== 'string' || !Array.isArray(o.etapas)) throw new Error('Arquivo não parece um script do Fênix Call Trainer.');
      o.id = uid('sc'); o.modelo = false; o.versao = 1; o.arquivado = false; o.historico = [{ versao: 1, quando: Date.now(), resumo: 'Importado' }];
      o.etapas.forEach(function (e, i) { e.id = e.id || ('e' + i); e.palavras = Array.isArray(e.palavras) ? e.palavras : []; });
      E().scripts.push(o); salvar(); toast('Script importado: ' + o.nome); render();
    } catch (e) { toast('Não foi possível importar: ' + e.message, 'err'); }
  };
  r.readAsText(f);
}
ACOES.scriptDup = function (el) {
  var s = scriptPorId(el.dataset.id); if (!s) return; var c = clone(s);
  c.id = uid('sc'); c.nome = s.nome + ' (cópia)'; c.modelo = false; c.versao = 1; c.arquivado = false; c.historico = [{ versao: 1, quando: Date.now(), resumo: 'Duplicado de ' + s.nome }];
  E().scripts.push(c); salvar(); toast('Script duplicado.'); render();
};
ACOES.scriptArq = function (el) { var s = scriptPorId(el.dataset.id); if (!s) return; s.arquivado = !s.arquivado; s.historico.push({ versao: s.versao, quando: Date.now(), resumo: s.arquivado ? 'Arquivado' : 'Desarquivado' }); salvar(); render(); };
ACOES.scriptExp = function (el) { var s = scriptPorId(el.dataset.id); if (!s) return; baixar('fenix-script-' + s.id + '.json', JSON.stringify({ tipoArquivo: 'fenix-script', versaoApp: FCT.VERSAO, script: s }, null, 2)); };
ACOES.scriptDel = function (el) {
  var s = scriptPorId(el.dataset.id); if (!s) return;
  var usado = E().cenarios.filter(function (c) { return c.scriptId === s.id; });
  if (usado.length) { toast('Este script é usado por ' + usado.length + ' cenário(s). Troque o script deles ou arquive este.', 'err'); return; }
  confirmarApagar('Excluir script', 'O script "' + s.nome + '" será apagado. As tentativas já feitas continuam no histórico.').then(function (ok) { if (!ok) return; E().scripts = E().scripts.filter(function (x) { return x.id !== s.id; }); salvar(); toast('Script excluído.'); render(); });
};

function linhasParaLista(t) { return String(t || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
function telaScriptEditor(app, p) {
  var novo = p[1] === 'novo', orig = novo ? null : scriptPorId(p[1]);
  if (!novo && !orig) { app.innerHTML = '<div class="card">Script não encontrado. <a href="#/scripts">Voltar</a></div>'; return; }
  var s = novo ? { id: uid('sc'), nome: '', empresa: '', modalidade: 'inbound', tipo: 'flexivel', produto: '', objetivo: '', publico: '', etapas: [{ id: 'e0', nome: 'Saudação', palavras: ['bom dia', 'boa tarde', 'boa noite'], exemplo: '', obrigatoria: true }], perguntas: '', argumentos: '', objecoes: [], faq: '', condicoes: '', proibidas: [], promessasPermitidas: [], exigeIdentificacao: false, encerramento: '', orientacoes: '', versao: 1, arquivado: false, historico: [] } : clone(orig);
  var ro = !ehInstrutor();
  APP.edit = { s: s, novo: novo };
  var dis = ro ? ' disabled' : '';
  function campo(id, rot, val, tipo) { return '<label class="c" for="f_' + id + '">' + rot + '</label>' + (tipo === 'area' ? '<textarea id="f_' + id + '" data-f="' + id + '"' + dis + '>' + esc(val) + '</textarea>' : '<input type="text" id="f_' + id + '" data-f="' + id + '" value="' + esc(val) + '"' + dis + '>'); }
  var h = '<a href="#/scripts">← Scripts</a><h1>' + (novo ? 'Novo script' : (ro ? 'Script' : 'Editar script')) + '</h1>' + (novo || !orig ? '' : '<p class="mut">Versão ' + orig.versao + (orig.modelo ? ' · modelo editável (empresa e valores são fictícios)' : '') + '</p>');
  h += '<div class="card"><h2>Identificação</h2>' + campo('nome', 'Nome do treinamento *', s.nome) + campo('empresa', 'Empresa responsável', s.empresa) +
    '<label class="c" for="f_modalidade">Modalidade de operação</label><select id="f_modalidade" data-f="modalidade"' + dis + '>' + D.OPERACOES.map(function (o) { return '<option value="' + o.id + '"' + (o.id === s.modalidade ? ' selected' : '') + '>' + esc(o.nome) + '</option>'; }).join('') + '</select>' +
    '<label class="c" for="f_tipo">Tipo de script</label><select id="f_tipo" data-f="tipo"' + dis + '><option value="rigido"' + (s.tipo === 'rigido' ? ' selected' : '') + '>Rígido (texto exato)</option><option value="flexivel"' + (s.tipo === 'flexivel' ? ' selected' : '') + '>Flexível (pontos obrigatórios)</option><option value="consultivo"' + (s.tipo === 'consultivo' ? ' selected' : '') + '>Consultivo (objetivo e diretrizes)</option></select>' +
    campo('produto', 'Produto ou serviço', s.produto) + campo('objetivo', 'Objetivo da abordagem', s.objetivo) + campo('publico', 'Perfil do público', s.publico) + '</div>';
  h += '<div class="card"><h2>Etapas obrigatórias</h2><p class="mut">A avaliação confere, por código, se o operador usou alguma das expressões de cada etapa (separe por vírgula).</p><div id="etapas">' + etapasHtml(s, ro) + '</div>' + (ro ? '' : '<button class="btn peq sec" data-act="etapaAdd" style="margin-top:8px">+ Adicionar etapa</button>') + '</div>';
  h += '<div class="card"><h2>Conteúdo do script</h2>' + campo('perguntas', 'Perguntas obrigatórias', s.perguntas, 'area') + campo('argumentos', 'Argumentação comercial e benefícios', s.argumentos, 'area') + campo('condicoes', 'Condições comerciais (a IA não inventa o que não estiver aqui)', s.condicoes, 'area') + campo('faq', 'Dúvidas frequentes', s.faq, 'area') + campo('encerramento', 'Encerramento', s.encerramento, 'area') + campo('orientacoes', 'Orientações adicionais', s.orientacoes, 'area') + '</div>';
  h += '<div class="card"><h2>Objeções e respostas</h2><div id="objs">' + objsHtml(s, ro) + '</div>' + (ro ? '' : '<button class="btn peq sec" data-act="objAdd" style="margin-top:8px">+ Adicionar objeção</button>') + '</div>';
  h += '<div class="card"><h2>Conformidade</h2>' + campo('proibidas', 'Expressões proibidas (uma por linha) — falha crítica', s.proibidas.join('\n'), 'area') + campo('promessasPermitidas', 'Garantias permitidas (uma por linha; ex.: "garanto" se o script permitir)', (s.promessasPermitidas || []).join('\n'), 'area') + '<div style="margin-top:8px">' + sw('f_exigeIdentificacao', 'Exigir confirmação de identidade (falha crítica se faltar)', s.exigeIdentificacao, ' data-f="exigeIdentificacao"' + dis) + '</div></div>';
  if (!novo && orig.historico && orig.historico.length) h += '<details><summary>Histórico de alterações (' + orig.historico.length + ')</summary>' + orig.historico.slice().reverse().map(function (x) { return '<p class="mut">v' + x.versao + ' · ' + FCT.dataBR(x.quando) + ' ' + FCT.horaBR(x.quando) + ' · ' + esc(x.resumo) + '</p>'; }).join('') + '</details>';
  h += '<div class="erro" id="ederro" role="alert"></div>' + (ro ? '' : '<div class="linha"><button class="btn" data-act="scriptSalvar">Salvar</button><a class="btn sec" href="#/scripts">Cancelar</a></div>');
  app.innerHTML = h; APP.sujo = false;
  ACOES._descartar = function () { APP.edit = null; };
}
function etapasHtml(s, ro) {
  var dis = ro ? ' disabled' : '';
  return s.etapas.map(function (e, i) {
    return '<div class="card" style="background:#f7f8fd;box-shadow:none"><label class="c" for="et_n' + i + '">Etapa ' + (i + 1) + ' — nome</label><input type="text" id="et_n' + i + '" data-e="' + i + '" data-k="nome" value="' + esc(e.nome) + '"' + dis + '>' +
      '<label class="c" for="et_p' + i + '">Expressões esperadas (vírgula)</label><input type="text" id="et_p' + i + '" data-e="' + i + '" data-k="palavras" value="' + esc((e.palavras || []).join(', ')) + '"' + dis + '>' +
      '<label class="c" for="et_x' + i + '">Exemplo de boa execução</label><input type="text" id="et_x' + i + '" data-e="' + i + '" data-k="exemplo" value="' + esc(e.exemplo || '') + '"' + dis + '>' +
      '<div class="linha entre">' + sw('et_o' + i, 'Obrigatória', e.obrigatoria !== false, ' data-e="' + i + '" data-k="obrigatoria"' + dis) + (ro ? '' : '<div class="linha"><button class="btn peq sec" data-act="etapaSobe" data-i="' + i + '" aria-label="Subir etapa">↑</button><button class="btn peq sec" data-act="etapaDesce" data-i="' + i + '" aria-label="Descer etapa">↓</button><button class="btn peq sec" data-act="etapaDel" data-i="' + i + '">Remover</button></div>') + '</div></div>';
  }).join('');
}
function objsHtml(s, ro) {
  var dis = ro ? ' disabled' : '';
  if (!s.objecoes.length) return '<p class="mut">Nenhuma objeção cadastrada.</p>';
  return s.objecoes.map(function (o, i) {
    return '<div class="card" style="background:#f7f8fd;box-shadow:none"><label class="c" for="ob_o' + i + '">Objeção</label><input type="text" id="ob_o' + i + '" data-ob="' + i + '" data-k="objecao" value="' + esc(o.objecao) + '"' + dis + '><label class="c" for="ob_r' + i + '">Como responder</label><input type="text" id="ob_r' + i + '" data-ob="' + i + '" data-k="resposta" value="' + esc(o.resposta) + '"' + dis + '>' + (ro ? '' : '<button class="btn peq sec" data-act="objDel" data-i="' + i + '" style="margin-top:6px">Remover</button>') + '</div>';
  }).join('');
}
function editSincronizar(el) {
  if (!APP.edit) return; var s = APP.edit.s;
  if (el.dataset.f) {
    var f = el.dataset.f;
    if (f === 'proibidas' || f === 'promessasPermitidas') s[f] = linhasParaLista(el.value);
    else if (f === 'exigeIdentificacao') s[f] = el.checked;
    else s[f] = el.value;
  } else if (el.dataset.e != null) {
    var e = s.etapas[+el.dataset.e], k = el.dataset.k;
    if (k === 'palavras') e.palavras = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    else if (k === 'obrigatoria') e.obrigatoria = el.checked; else e[k] = el.value;
  } else if (el.dataset.ob != null) { s.objecoes[+el.dataset.ob][el.dataset.k] = el.value; } else return;
  APP.sujo = true;
}
function reRenderEditorListas() { var s = APP.edit.s; $('#etapas').innerHTML = etapasHtml(s, false); $('#objs').innerHTML = objsHtml(s, false); }
ACOES.etapaAdd = function () { var s = APP.edit.s; s.etapas.push({ id: 'e' + Date.now(), nome: '', palavras: [], exemplo: '', obrigatoria: true }); APP.sujo = true; reRenderEditorListas(); };
ACOES.etapaDel = function (el) { var s = APP.edit.s; s.etapas.splice(+el.dataset.i, 1); APP.sujo = true; reRenderEditorListas(); };
ACOES.etapaSobe = function (el) { var s = APP.edit.s, i = +el.dataset.i; if (i > 0) { var t = s.etapas[i]; s.etapas[i] = s.etapas[i - 1]; s.etapas[i - 1] = t; APP.sujo = true; reRenderEditorListas(); } };
ACOES.etapaDesce = function (el) { var s = APP.edit.s, i = +el.dataset.i; if (i < s.etapas.length - 1) { var t = s.etapas[i]; s.etapas[i] = s.etapas[i + 1]; s.etapas[i + 1] = t; APP.sujo = true; reRenderEditorListas(); } };
ACOES.objAdd = function () { APP.edit.s.objecoes.push({ objecao: '', resposta: '' }); APP.sujo = true; reRenderEditorListas(); };
ACOES.objDel = function (el) { APP.edit.s.objecoes.splice(+el.dataset.i, 1); APP.sujo = true; reRenderEditorListas(); };
ACOES.scriptSalvar = function () {
  var s = APP.edit.s, er = $('#ederro');
  if (!s.nome.trim()) { er.textContent = 'Informe o nome do treinamento.'; $('#f_nome').focus(); return; }
  if (!s.etapas.length) { er.textContent = 'Cadastre pelo menos uma etapa.'; return; }
  for (var i = 0; i < s.etapas.length; i++) {
    if (!s.etapas[i].nome.trim()) { er.textContent = 'A etapa ' + (i + 1) + ' precisa de um nome.'; return; }
    if (s.etapas[i].obrigatoria !== false && !s.etapas[i].palavras.length) { er.textContent = 'A etapa "' + s.etapas[i].nome + '" precisa de ao menos uma expressão esperada (ou marque como não obrigatória).'; return; }
  }
  s.objecoes = s.objecoes.filter(function (o) { return o.objecao.trim(); });
  if (APP.edit.novo) { s.historico = [{ versao: 1, quando: Date.now(), resumo: 'Criado' }]; E().scripts.push(s); }
  else { s.versao = (s.versao || 1) + 1; s.historico = s.historico || []; s.historico.push({ versao: s.versao, quando: Date.now(), resumo: 'Editado' }); var ix = E().scripts.findIndex(function (x) { return x.id === s.id; }); E().scripts[ix] = s; }
  salvar(); APP.sujo = false; APP.edit = null; toast('Script salvo.'); go('#/scripts');
};

/* ================= CENÁRIOS ================= */
function telaCenarios(app) {
  var h = '<div class="linha entre"><h1>Cenários</h1>' + (ehInstrutor() ? '<button class="btn peq" data-act="cenNovo">Novo cenário</button>' : '') + '</div><p class="mut">Cenário = script + cliente virtual + dificuldade. Os modelos são editáveis e usam dados fictícios.</p>';
  h += E().cenarios.map(function (c) {
    var s = scriptPorId(c.scriptId);
    return '<div class="card"><b>' + esc(c.nome) + '</b><br>' + chip(FCT.PERFIS[c.perfil] ? FCT.PERFIS[c.perfil].nome : c.perfil) + chip('Nível ' + c.nivel + ' — ' + FCT.NIVEIS[c.nivel]) + chip('Script: ' + (s ? s.nome : '(removido)')) + (c.modelo ? chip('Modelo editável', 'am') : '') +
      '<div class="linha" style="margin-top:6px"><button class="btn peq" data-act="treinarCenario" data-c="' + c.id + '">Simular</button>' + (ehInstrutor() ? '<button class="btn peq sec" data-act="cenEditar" data-id="' + c.id + '">Editar</button><button class="btn peq sec" data-act="cenDup" data-id="' + c.id + '">Duplicar</button><button class="btn peq sec" data-act="cenDel" data-id="' + c.id + '">Excluir</button>' : '') + '</div></div>';
  }).join('') || '<div class="card vazio">Nenhum cenário.</div>';
  app.innerHTML = h;
}
ACOES.cenNovo = function () { editarCenario(null); };
ACOES.cenEditar = function (el) { editarCenario(cenarioPorId(el.dataset.id)); };
ACOES.cenDup = function (el) { var c = cenarioPorId(el.dataset.id); if (!c) return; var n = clone(c); n.id = uid('cn'); n.nome += ' (cópia)'; n.modelo = false; E().cenarios.push(n); salvar(); render(); toast('Cenário duplicado.'); };
ACOES.cenDel = function (el) {
  var c = cenarioPorId(el.dataset.id); if (!c) return;
  confirmarApagar('Excluir cenário', 'O cenário "' + c.nome + '" será apagado. O histórico de tentativas continua.').then(function (ok) { if (!ok) return; E().cenarios = E().cenarios.filter(function (x) { return x.id !== c.id; }); salvar(); render(); toast('Cenário excluído.'); });
};
function editarCenario(c) {
  var novo = !c; c = c || { id: uid('cn'), nome: '', scriptId: (E().scripts.filter(function (s) { return !s.arquivado; })[0] || {}).id, perfil: 'colaborativo', nivel: 1, assunto: '', detalhe: '', objecoes: [], perguntaValor: false, moduloId: 'm1', modalidade: 'inbound' };
  var objTxt = (c.objecoes || []).map(function (o) { return o.texto + (o.palavrasChave && o.palavrasChave.length ? ' | ' + o.palavrasChave.join(', ') : ''); }).join('\n');
  var corpo = '<label class="c" for="cn_nome">Nome *</label><input type="text" id="cn_nome" value="' + esc(c.nome) + '">' +
    '<label class="c" for="cn_script">Script</label><select id="cn_script">' + E().scripts.map(function (s) { return '<option value="' + s.id + '"' + (s.id === c.scriptId ? ' selected' : '') + '>' + esc(s.nome) + '</option>'; }).join('') + '</select>' +
    '<label class="c" for="cn_perfil">Perfil do cliente</label><select id="cn_perfil">' + Object.keys(FCT.PERFIS).map(function (k) { return '<option value="' + k + '"' + (k === c.perfil ? ' selected' : '') + '>' + FCT.PERFIS[k].nome + '</option>'; }).join('') + '</select>' +
    '<label class="c" for="cn_nivel">Dificuldade</label><select id="cn_nivel">' + [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (n === c.nivel ? ' selected' : '') + '>' + n + ' — ' + FCT.NIVEIS[n] + '</option>'; }).join('') + '</select>' +
    '<label class="c" for="cn_ass">Assunto da ligação (o que o cliente diz querer)</label><input type="text" id="cn_ass" value="' + esc(c.assunto) + '">' +
    '<label class="c" for="cn_det">Detalhe revelado quando o operador pergunta</label><input type="text" id="cn_det" value="' + esc(c.detalhe) + '">' +
    '<label class="c" for="cn_obj">Objeções (uma por linha; opcional: texto | palavra1, palavra2)</label><textarea id="cn_obj">' + esc(objTxt) + '</textarea>' +
    '<div style="margin-top:6px">' + sw('cn_valor', 'O cliente pergunta o valor', c.perguntaValor) + '</div><div class="erro" id="cn_erro" role="alert"></div>';
  modal({
    titulo: novo ? 'Novo cenário' : 'Editar cenário', corpo: corpo,
    botoes: [{ txt: 'Cancelar', val: false, cls: 'sec' }, {
      txt: 'Salvar', val: true,
      valida: function (bg) { if (!bg.querySelector('#cn_nome').value.trim()) { bg.querySelector('#cn_erro').textContent = 'Informe o nome do cenário.'; return false; } if (!bg.querySelector('#cn_script').value) { bg.querySelector('#cn_erro').textContent = 'Cadastre um script antes.'; return false; } return true; },
      fn: function (bg) {
        c.nome = bg.querySelector('#cn_nome').value.trim(); c.scriptId = bg.querySelector('#cn_script').value; c.perfil = bg.querySelector('#cn_perfil').value; c.nivel = +bg.querySelector('#cn_nivel').value;
        c.assunto = bg.querySelector('#cn_ass').value.trim() || 'o atendimento'; c.detalhe = bg.querySelector('#cn_det').value.trim() || 'preciso de ajuda';
        c.perguntaValor = bg.querySelector('#cn_valor').checked;
        c.objecoes = linhasParaLista(bg.querySelector('#cn_obj').value).map(function (l, i) { var pp = l.split('|'); return { id: 'o' + (i + 1), texto: pp[0].trim(), palavrasChave: (pp[1] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean) }; });
        var s = scriptPorId(c.scriptId); c.modalidade = s ? s.modalidade : 'inbound';
        if (novo) E().cenarios.push(c); else { var ix = E().cenarios.findIndex(function (x) { return x.id === c.id; }); E().cenarios[ix] = c; }
        salvar(); return true;
      }
    }]
  }).then(function (ok) { if (ok) { toast('Cenário salvo.'); render(); } });
}

/* ================= TREINAR (preparo) ================= */
function iniciarPreparo(o) { APP.prep = Object.assign({ modo: 'texto' }, o); go('#/treinar'); }
function suporteVoz() {
  var stt = !!(window.SpeechRecognition || window.webkitSpeechRecognition), mic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  return { stt: stt, mic: mic, tts: 'speechSynthesis' in window, ok: stt && mic };
}
function telaTreinar(app) {
  var prep = APP.prep = APP.prep || { modo: 'texto', cenarioId: (E().cenarios[0] || {}).id };
  var sv = suporteVoz();
  var h = '<h1>Treinar</h1><h2>1. Escolha o modo</h2><div class="grid gauto" role="radiogroup" aria-label="Modo de treino">' +
    [['leitura', 'Leitura guiada', 'Acompanhe o script e leia em voz alta. Mede ritmo, pausas e volume.'], ['texto', 'Simulação por texto', 'Converse por mensagens com o cliente virtual.'], ['voz', 'Simulação por voz', 'Fale com o cliente virtual pelo microfone e ouça as respostas.'], ['semconsulta', 'Sem consulta', 'O script some: mostre que domina o procedimento.']].map(function (m) {
      return '<label class="card clic" style="margin:0;display:block"><input type="radio" name="modo" value="' + m[0] + '"' + (prep.modo === m[0] ? ' checked' : '') + ' data-act="setModo"> <b>' + m[1] + '</b><br><span class="mut">' + m[2] + '</span></label>';
    }).join('') + '</div>';
  if ((prep.modo === 'voz' || prep.modo === 'leitura') && !sv.ok) h += '<div class="aviso">Este navegador não oferece ' + (sv.stt ? '' : 'reconhecimento de fala ') + (sv.mic ? '' : 'acesso ao microfone ') + '(funciona melhor no Chrome ou Edge). O app vai usar o modo texto no lugar' + (prep.modo === 'leitura' && sv.mic ? ', mas na leitura guiada você ainda pode usar o microfone só para medir' : '') + '.</div>';
  h += '<h2 style="margin-top:14px">2. Escolha o cenário</h2>';
  h += E().cenarios.map(function (c) {
    var s = scriptPorId(c.scriptId);
    return '<label class="card clic" style="display:block"><input type="radio" name="cen" value="' + c.id + '"' + (prep.cenarioId === c.id ? ' checked' : '') + ' data-act="setCen"> <b>' + esc(c.nome) + '</b><br>' + chip(FCT.PERFIS[c.perfil] ? FCT.PERFIS[c.perfil].nome : c.perfil) + chip('Nível ' + c.nivel + ' — ' + FCT.NIVEIS[c.nivel]) + chip(s ? s.nome : '(sem script)') + '</label>';
  }).join('') || '<div class="card vazio">Cadastre um cenário primeiro.</div>';
  if (prep.modo === 'semconsulta' && sv.ok) h += '<div class="card">' + sw('p_micsc', 'Responder por voz (microfone)', !!prep.micSC) + '</div>';
  h += '<div class="aviso demo"><b>Demonstração:</b> o cliente virtual e a avaliação usam regras do app, sem IA externa. Você pode ligar uma IA externa em Configurações.</div>';
  h += '<div class="linha"><button class="btn" data-act="iniciar">Iniciar simulação</button></div>';
  app.innerHTML = h;
  var m = $('#p_micsc'); if (m) m.addEventListener('change', function () { APP.prep.micSC = m.checked; });
}
ACOES.setModo = function (el) { APP.prep.modo = el.value; render(); };
ACOES.setCen = function (el) { APP.prep.cenarioId = el.value; };
function consentirVoz() {
  if (E().consentimento.voz) return Promise.resolve(true);
  return modal({
    titulo: 'Uso do microfone e da sua voz',
    corpo: '<p><b>O que é analisado:</b> o áudio é medido <b>no seu aparelho</b> (volume, tom, pausas, velocidade). O áudio <b>não é gravado</b> e não é enviado por este app.</p><p><b>O que é guardado:</b> só as métricas e a transcrição, no seu aparelho, para o seu histórico. Você pode apagar tudo em Configurações.</p><p><b>Atenção:</b> para transcrever a fala, o navegador pode enviar o áudio ao serviço de reconhecimento de voz do fabricante dele (por exemplo, o Google, no Chrome). Isso é feito pelo navegador, não por este app.</p><p>Nenhuma métrica de voz é usada para dizer como você se sente.</p>',
    botoes: [{ txt: 'Não aceito', val: false, cls: 'sec' }, { txt: 'Aceito usar o microfone', val: true }]
  }).then(function (ok) { if (ok) { E().consentimento = { voz: true, em: Date.now() }; logAcesso('consentimento_voz'); salvar(); } return ok; });
}
ACOES.iniciar = function () {
  var prep = APP.prep; if (!prep || !prep.cenarioId || !cenarioPorId(prep.cenarioId)) { toast('Escolha um cenário.', 'err'); return; }
  var sv = suporteVoz(), modo = prep.modo, comMic = false;
  var querVoz = modo === 'voz' || modo === 'leitura' || (modo === 'semconsulta' && prep.micSC);
  if (querVoz && sv.mic) {
    consentirVoz().then(function (ok) {
      if (!ok) { toast('Sem o consentimento, a simulação segue por texto.'); if (modo === 'voz') modo = 'texto'; comMic = false; }
      else comMic = true;
      if ((modo === 'voz' || (modo === 'semconsulta' && prep.micSC)) && !sv.stt) { toast('Reconhecimento de fala indisponível neste navegador: usando texto.'); if (modo === 'voz') modo = 'texto'; }
      criarSessao({ cenarioId: prep.cenarioId, modo: modo, comMic: comMic, moduloId: prep.moduloId });
    });
  } else {
    if (querVoz && !sv.mic && modo === 'voz') { toast('Microfone indisponível: usando texto.'); modo = 'texto'; }
    criarSessao({ cenarioId: prep.cenarioId, modo: modo, comMic: false, moduloId: prep.moduloId });
  }
};

/* ================= SESSÃO ================= */
var Mic = {
  ctx: null, stream: null, an: null, timer: null, buf: null, ativo: false,
  iniciar: function (onFrame) {
    var self = this; if (self.ativo) return Promise.resolve();
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }).then(function (st) {
      self.stream = st; var AC = window.AudioContext || window.webkitAudioContext; self.ctx = new AC();
      var go_ = self.ctx.state === 'suspended' ? self.ctx.resume() : Promise.resolve();
      return go_.then(function () {
        var src = self.ctx.createMediaStreamSource(st); self.an = self.ctx.createAnalyser(); self.an.fftSize = 2048; src.connect(self.an);
        self.buf = new Float32Array(self.an.fftSize); var t0 = performance.now();
        self.timer = setInterval(function () {
          self.an.getFloatTimeDomainData(self.buf); var db = FCT.paraDb(FCT.rms(self.buf)), f0 = 0;
          if (db > -50) f0 = FCT.detectarTom(self.buf, self.ctx.sampleRate).f0;
          onFrame({ t: (performance.now() - t0) / 1000, db: db, f0: f0 });
        }, 50);
        self.ativo = true;
      });
    });
  },
  parar: function () {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null;
    if (this.ctx) { try { this.ctx.close(); } catch (e) { } } this.ctx = null; this.ativo = false;
  }
};

function criarSessao(cfg) {
  var cen = cenarioPorId(cfg.cenarioId), scr = scriptPorId(cen.scriptId);
  if (!scr) { toast('O script deste cenário não existe mais.', 'err'); return; }
  pararSessao();
  var S = APP.sessao = {
    id: uid('s'), cfg: cfg, cen: cen, scr: scr, modo: cfg.modo, comMic: !!cfg.comMic, teste: cfg.teste || null,
    cliente: FCT.novoCliente(cen, scr, Math.floor(Math.random() * 1e6)), trans: [], t0: Date.now(), pausadoTotal: 0, pausadoDesde: null, pausado: false, ativa: true,
    rast: new FCT.Rastreador(), calib: [], calibrado: false, turnoIni: null, turnoFim: null, palavrasVoz: 0, durVoz: 0, confs: [], amostras: [],
    ultDbs: [], ultF0s: [], ultWpm: null, ultVicios: 0, alertaUlt: {}, espelho: false, interim: '', leituraIdx: 0, lidas: [], micLigado: false, tts: false, avisouIA: false, finalizando: false
  };
  S.espelho = (S.teste ? !!S.teste.espelhoPermitido && E().config.espelho : E().config.espelho);
  APP.sujo = true; ACOES._descartar = function () { pararSessao(); APP.sessao = null; };
  logAcesso('inicio_sessao');
  APP.rota = '#/sessao'; APP.ignorarHash = true; location.hash = '#/sessao'; setTimeout(function () { APP.ignorarHash = false; }, 0); render();
  if (S.comMic) ligarMic(S);
}
function pararSessao() {
  var S = APP.sessao; if (!S) return;
  S.ativa = false; S.micLigado = false;
  try { if (S.rec) { S.rec.onend = null; S.rec.stop(); } } catch (e) { }
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
  Mic.parar(); if (S.timerUI) clearInterval(S.timerUI); if (S.timerMed) clearInterval(S.timerMed);
}
function tempoDecorrido(S) { var fim = S.pausado && S.pausadoDesde ? S.pausadoDesde : Date.now(); return Math.max(0, (fim - S.t0 - S.pausadoTotal) / 1000); }

function linhaLeitura(e) { var m = /"([^"]+)"/.exec(e.exemplo || ''); return m ? m[1] : (e.exemplo || e.nome); }
function telaSessao(app) {
  var S = APP.sessao;
  if (!S || !S.ativa) { app.innerHTML = '<div class="card vazio">Nenhuma simulação em andamento.<br><a class="btn" href="#/treinar" style="margin-top:8px">Escolher uma simulação</a></div>'; return; }
  var cen = S.cen, ocultaScript = S.modo === 'semconsulta' || (S.teste && S.teste.semScript);
  var h = '<div class="card"><div class="linha entre"><div style="flex:1;min-width:0"><b>' + esc(cen.nome) + '</b><br>' + chip(modoNome(S.modo)) + (S.modo !== 'leitura' ? chip(FCT.PERFIS[cen.perfil].nome) + chip('Nível ' + cen.nivel) : '') + '<span class="chip demo" title="Cliente virtual e avaliação por regras do app">Demonstração</span>' + (S.teste ? chip('Teste', 'am') : '') + '</div><div style="text-align:right"><div class="cron" id="cron" aria-label="Tempo">0:00</div><div class="mut" id="restante"></div></div></div>' +
    '<div class="linha" style="margin-top:8px"><button class="btn peq sec" data-act="sessPausar" id="bpausa">Pausar</button><button class="btn peq sec" data-act="sessReiniciar">Reiniciar</button><button class="btn peq" data-act="sessFinalizar">Finalizar e avaliar</button></div></div>';
  if (S.modo !== 'leitura') h += '<div class="aviso" id="dica">' + (cen.modalidade === 'outbound' || (scriptPorId(cen.scriptId) || {}).modalidade === 'outbound' ? 'Você está ligando para o cliente. Cumprimente e se apresente.' : 'O cliente está na linha. Cumprimente e se apresente.') + '</div>';
  if (S.comMic || S.modo === 'voz' || S.modo === 'leitura') h += painelEspelho(S);
  if (S.modo === 'leitura') {
    h += '<div class="card"><h2>Leia em voz alta</h2><ol class="leitura" id="leitura">' + S.scr.etapas.map(function (e, i) { return '<li id="ln' + i + '" class="' + (i === 0 ? 'at' : '') + '"><b>' + esc(e.nome) + '</b><br>' + esc(linhaLeitura(e)) + '</li>'; }).join('') + '</ol><div class="linha"><button class="btn" data-act="leituraProx" id="bprox">Li esta linha — próxima</button></div></div>';
  } else {
    if (!ocultaScript) h += '<details><summary>Ver o script</summary>' + scriptResumoHtml(S.scr) + '</details>';
    else h += '<div class="aviso">Modo sem consulta: o script está oculto.</div>';
    h += '<div class="card"><div class="chat" id="chat" aria-live="polite"></div><div id="interim" class="mut" style="min-height:1.2em"></div>' +
      '<div class="entrada"><textarea id="entrada" rows="1" placeholder="Digite sua fala…" aria-label="Sua fala"></textarea>' + (S.comMic && suporteVoz().stt ? '<button class="mic" id="bmic" data-act="micAlternar" aria-label="Ligar ou desligar o reconhecimento de fala" aria-pressed="false">🎤</button>' : '') + '<button class="btn" data-act="sessEnviar">Enviar</button></div></div>';
  }
  app.innerHTML = h;
  if (S.modo !== 'leitura') {
    var ta = $('#entrada'); ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ACOES.sessEnviar(); } });
    ta.focus();
  }
  var esp = $('#esp_sw'); if (esp) esp.addEventListener('change', function () {
    if (S.teste && !S.teste.espelhoPermitido) { esp.checked = false; toast('O Espelho de voz não é permitido neste teste.'); return; }
    S.espelho = esp.checked; E().config.espelho = esp.checked; salvar(); desenharEspelho(S);
  });
  S.timerUI = setInterval(function () { atualizarCron(S); }, 500); atualizarCron(S);
  S.timerMed = setInterval(function () { tickMedidores(S); }, 250);
  desenharEspelho(S);
}
function scriptResumoHtml(s) {
  return '<p><b>Objetivo:</b> ' + esc(s.objetivo) + '</p><p><b>Etapas:</b></p><ol>' + s.etapas.map(function (e) { return '<li>' + esc(e.nome) + (e.obrigatoria === false ? ' <span class="mut">(opcional)</span>' : '') + (e.exemplo ? '<br><span class="mut">' + esc(e.exemplo) + '</span>' : '') + '</li>'; }).join('') + '</ol>' +
    (s.perguntas ? '<p><b>Perguntas:</b> ' + esc(s.perguntas) + '</p>' : '') + (s.argumentos ? '<p><b>Argumentos:</b> ' + esc(s.argumentos) + '</p>' : '') + (s.condicoes ? '<p><b>Condições:</b> ' + esc(s.condicoes) + '</p>' : '') + (s.proibidas && s.proibidas.length ? '<p><b>Não diga:</b> ' + s.proibidas.map(esc).join('; ') + '</p>' : '');
}
function painelEspelho(S) {
  var perm = !(S.teste && !S.teste.espelhoPermitido);
  return '<div class="espelho" id="espelho"><div class="linha entre"><b>Espelho de voz</b>' + sw('esp_sw', S.espelho ? 'Ligado' : 'Ligar', S.espelho && perm, perm ? '' : ' disabled') + '</div>' +
    (perm ? '' : '<p class="mut">Bloqueado neste teste (regra igual para todos os candidatos).</p>') + '<div id="esp_corpo"></div><div id="alertas" aria-live="polite"></div></div>';
}
var ESCALAS = { wpm: { min: 0, max: 260, un: ' pal/min', nome: 'Velocidade' }, db: { min: -70, max: 0, un: ' dB', nome: 'Volume (relativo)' }, f0: { min: 70, max: 400, un: ' Hz', nome: 'Tom' }, pausa: { min: 0, max: 30, un: ' pausas/min', nome: 'Pausas' } };
function desenharEspelho(S) {
  var c = $('#esp_corpo'); if (!c) return;
  var sw_ = $('#esp_sw'); if (sw_) { var lb = sw_.parentNode.querySelector('span:last-child'); if (lb) lb.textContent = S.espelho ? 'Ligado' : 'Ligar'; }
  if (!S.espelho) { c.innerHTML = '<p class="mut">Desligado: nada aparece durante a fala. As métricas continuam sendo calculadas e aparecem no relatório final.</p>'; return; }
  var base = E().base;
  if (!base) { c.innerHTML = '<p class="mut">Calibre a sua voz para ver a sua zona confortável. <button class="btn peq sec" data-go="#/voz">Calibrar</button></p>'; return; }
  if (!S.comMic) { c.innerHTML = '<p class="mut">O Espelho funciona quando o microfone está ligado.</p>'; return; }
  c.innerHTML = ['wpm', 'db', 'f0', 'pausa'].map(function (m) { return '<div class="medidor" id="med_' + m + '"><div class="rot"><span>' + ESCALAS[m].nome + '</span><span class="v">—</span></div><div class="trilho"><div class="zona"></div><div class="pino" style="left:0"></div></div><div class="st">aguardando fala…</div></div>'; }).join('');
  tickMedidores(S);
}
function atualizarCron(S) {
  var c = $('#cron'); if (!c) return; var s = tempoDecorrido(S); c.textContent = FCT.fmtDur(s);
  if (S.teste && S.teste.tempoMin) {
    var resta = S.teste.tempoMin * 60 - s, r = $('#restante'); if (r) r.textContent = 'Restam ' + FCT.fmtDur(Math.max(0, resta));
    if (resta <= 0 && S.ativa && !S.finalizando) { toast('Tempo do teste esgotado.'); finalizarSessao('tempo'); }
  }
}
function estimativas(S) {
  var res = S.rast.resumo(), est = {};
  est.wpm = S.turnoIni != null && S.interim ? Math.round(FCT.contarPalavras(S.interim) / Math.max(1.5, (S.rast.ultT || 0) - S.turnoIni) * 60) : S.ultWpm;
  if (est.wpm && (est.wpm < 20 || est.wpm > 400)) est.wpm = S.ultWpm;
  est.db = S.ultDbs.length ? FCT.mediana(S.ultDbs) : null;
  est.f0 = S.ultF0s.length > 3 ? FCT.mediana(S.ultF0s) : null;
  est.pausa = res.duracao > 10 ? res.taxaPausas : null;
  est.semPausaS = S.rast.semPausaAtual(); est.vicios = S.ultVicios;
  return est;
}
function tickMedidores(S) {
  if (!S.ativa || S.pausado) return;
  var base = E().base, est = estimativas(S);
  if (S.espelho && base && S.comMic && $('#esp_corpo .medidor')) {
    ['wpm', 'db', 'f0', 'pausa'].forEach(function (m) {
      var el = $('#med_' + m); if (!el) return; var v = est[m], sc = ESCALAS[m], z = FCT.zona(m, base, E().config.larg), st = FCT.statusZona(m, v, base, E().config.larg);
      function pos(x) { return Math.max(0, Math.min(100, (x - sc.min) / (sc.max - sc.min) * 100)); }
      if (z) { var zn = el.querySelector('.zona'); zn.style.left = pos(z.min) + '%'; zn.style.width = (pos(z.max) - pos(z.min)) + '%'; }
      el.querySelector('.v').textContent = v == null ? '—' : Math.round(v) + sc.un;
      el.querySelector('.pino').style.left = v == null ? '0%' : pos(v) + '%';
      el.classList.toggle('fora', st.status === 'acima' || st.status === 'abaixo');
      el.querySelector('.st').textContent = st.status === 'sem' ? 'aguardando fala…' : st.status === 'dentro' ? 'dentro da sua zona' : (st.status === 'acima' ? 'acima da sua zona' : 'abaixo da sua zona');
    });
  }
  // alertas (1x por segundo, só com Espelho ligado e alertas ativos)
  var agora = Date.now();
  if (agora - (S.ultTickSeg || 0) >= 1000) {
    S.ultTickSeg = agora;
    if (S.comMic && S.rast.quadros.length) S.amostras.push({ wpm: est.wpm, db: est.db, f0: est.f0, pausa: est.pausa });
    if (S.espelho && E().config.alertas && base && S.comMic) {
      var al = FCT.alertas(est, base, { larg: E().config.larg, semPausaS: 20, viciosMax: 3 }), cont = $('#alertas');
      if (cont) {
        var novos = al.filter(function (a) { return !S.alertaUlt[a.id] || agora - S.alertaUlt[a.id] > 20000; }).slice(0, 2);
        novos.forEach(function (a) {
          S.alertaUlt[a.id] = agora; var d = document.createElement('div'); d.className = 'alerta'; d.innerHTML = '<b>' + esc(a.texto) + '</b>' + esc(a.dica); cont.appendChild(d); setTimeout(function () { d.remove(); }, 6000);
        });
      }
    }
  }
}
function ligarMic(S) {
  Mic.iniciar(function (q) {
    if (!S.ativa || S.pausado) return;
    if (!S.calibrado) {
      S.calib.push(q.db);
      if (S.calib.length >= 20) { var r = FCT.mediana(S.calib); S.rast.limiarDb = Math.max(-55, Math.min(-32, r + 12)); S.calibrado = true; }
      return;
    }
    S.rast.quadro(q);
    var voz = q.db > S.rast.limiarDb;
    if (voz) {
      if (S.turnoIni == null) S.turnoIni = q.t; S.turnoFim = q.t;
      S.ultDbs.push(q.db); if (S.ultDbs.length > 40) S.ultDbs.shift();
      if (q.f0 > 0) { S.ultF0s.push(q.f0); if (S.ultF0s.length > 60) S.ultF0s.shift(); }
    }
  }).then(function () {
    if (!S.ativa) { Mic.parar(); return; }
    S.micLigado = true;
    if (S.modo === 'voz' || (S.modo === 'semconsulta' && S.cfg.micSC)) iniciarReconhecimento(S);
    var b = $('#bmic'); if (b) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); }
  }).catch(function (e) {
    S.comMic = false; S.micLigado = false; toast('Não foi possível usar o microfone (' + (e && e.name === 'NotAllowedError' ? 'permissão negada' : (e && e.message) || 'erro') + '). Seguindo por texto.', 'err');
    var esc_ = $('#esp_corpo'); if (esc_) desenharEspelho(S); var b = $('#bmic'); if (b) b.style.display = 'none';
  });
}
function iniciarReconhecimento(S) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  try { if (S.rec) { S.rec.onend = null; S.rec.stop(); } } catch (e) { }
  var r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  r.onresult = function (ev) {
    if (!S.ativa || S.pausado) return;
    var interim = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var res = ev.results[i], tx = res[0].transcript;
      if (res.isFinal) { S.confs.push(res[0].confidence || 0); falaFinal(S, tx.trim()); } else interim += tx;
    }
    S.interim = interim; var el = $('#interim'); if (el) el.textContent = interim ? '🎤 ' + interim : '';
    S.ultVicios = FCT.contarVicios(interim).total;
  };
  r.onerror = function (ev) {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { toast('Reconhecimento de fala bloqueado. Use o campo de texto.', 'err'); S.micLigado = false; }
    else if (ev.error === 'network') toast('O reconhecimento de fala precisa de internet. Use o campo de texto.', 'err');
  };
  r.onend = function () { if (S.ativa && S.micLigado && !S.pausado && !S.tts) { try { r.start(); } catch (e) { } } };
  try { r.start(); S.rec = r; window.__fenixRec = r; } catch (e) { toast('Não foi possível iniciar o reconhecimento de fala.', 'err'); }
}
function falaFinal(S, texto) {
  if (!texto) return;
  var dur = (S.turnoIni != null && S.turnoFim != null) ? Math.max(0.8, S.turnoFim - S.turnoIni) : Math.max(1, FCT.contarPalavras(texto) / 2.5);
  var n = FCT.contarPalavras(texto); S.palavrasVoz += n; S.durVoz += dur; S.ultWpm = Math.round(n / dur * 60);
  S.ultVicios = FCT.contarVicios(texto).total; S.turnoIni = null; S.turnoFim = null; S.interim = ''; var el = $('#interim'); if (el) el.textContent = '';
  if (S.modo === 'leitura') { S.lidas.push(texto); return; }
  enviarOp(S, texto, true);
}
ACOES.micAlternar = function () {
  var S = APP.sessao; if (!S || !S.ativa) return; var b = $('#bmic');
  if (S.micLigado) { S.micLigado = false; try { S.rec && (S.rec.onend = null, S.rec.stop()); } catch (e) { } if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); } }
  else { S.micLigado = true; if (!Mic.ativo) ligarMic(S); else iniciarReconhecimento(S); if (b) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); } }
};
function addMsg(quem, texto) {
  var c = $('#chat'); if (!c) return;
  var d = document.createElement('div'); d.className = 'msg ' + quem; d.innerHTML = '<small>' + (quem === 'op' ? 'Você' : quem === 'cl' ? 'Cliente' : 'Aviso') + '</small>' + esc(texto); c.appendChild(d); c.scrollTop = c.scrollHeight;
}
ACOES.sessEnviar = function () {
  var S = APP.sessao; if (!S || !S.ativa || S.pausado) return; var ta = $('#entrada'); if (!ta) return;
  var t = ta.value.trim(); if (!t) { toast('Digite o que você diria ao cliente.'); return; }
  ta.value = ''; S.ultVicios = FCT.contarVicios(t).total; enviarOp(S, t, false);
};
function chamarIA(tipo, payload) {
  var cfg = E().config, ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 12000);
  return fetch(cfg.aiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ tipo: tipo, versaoApp: FCT.VERSAO }, payload)), signal: ctl.signal }).then(function (r) { clearTimeout(to); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}
function iaAtiva() { return !!(E().config.aiAtivo && E().config.aiEndpoint); }
function respostaCliente(S, texto) {
  var demo = function () { return Promise.resolve(FCT.responderCliente(S.cliente, texto, S.cen, S.scr)); };
  if (!iaAtiva()) return demo();
  var payload = { cenario: { nome: S.cen.nome, perfil: S.cen.perfil, nivel: S.cen.nivel, assunto: S.cen.assunto, detalhe: S.cen.detalhe, objecoes: (S.cen.objecoes || []).map(function (o) { return o.texto; }) }, script: { objetivo: S.scr.objetivo, condicoes: S.scr.condicoes, faq: S.scr.faq, proibidas: S.scr.proibidas }, mensagens: S.trans.map(function (m) { return { quem: m.quem, texto: m.texto }; }) };
  return chamarIA('cliente', payload).then(function (r) {
    if (!r || typeof r.texto !== 'string' || !r.texto.trim()) throw new Error('resposta inválida');
    S.ia = true; S.cliente.turnos++;
    FCT.responderCliente(Object.assign({}, S.cliente, { eventos: [], lacunas: [] }), texto, S.cen, S.scr); // mantém o estado de rastreio por regras (objeções) para a avaliação
    var rr = FCT.responderCliente(S.cliente, texto, S.cen, S.scr);
    return { texto: r.texto.trim(), encerrou: !!r.encerrou || rr.encerrou, motivo: r.encerrou ? 'fechamento' : rr.motivo, evento: rr.evento };
  }).catch(function (e) {
    if (!S.avisouIA) { S.avisouIA = true; toast('IA externa indisponível (' + e.message + '). Usando o modo Demonstração.', 'err'); }
    return demo();
  });
}
function enviarOp(S, texto, viaVoz) {
  S.trans.push({ quem: 'op', texto: texto, via: viaVoz ? 'voz' : 'texto', t: tempoDecorrido(S) }); addMsg('op', texto);
  var d = $('#dica'); if (d) d.remove();
  var ocupado = $('#chat'); S.aguardando = true;
  respostaCliente(S, texto).then(function (r) {
    if (!S.ativa) return; S.aguardando = false;
    S.trans.push({ quem: 'cl', texto: r.texto, t: tempoDecorrido(S) }); addMsg('cl', r.texto);
    if (S.modo === 'voz' || (S.modo === 'semconsulta' && S.cfg.micSC)) falar(S, r.texto);
    if (r.encerrou) { addMsg('sis', 'O cliente encerrou a ligação.'); S.encerradaPor = r.motivo; setTimeout(function () { if (S.ativa && !S.finalizando) finalizarSessao('cliente'); }, 1300); }
    else if (S.trans.length >= 60) finalizarSessao('limite');
  });
}
function falar(S, texto) {
  if (!E().config.falar || !('speechSynthesis' in window)) return;
  try {
    var u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; S.tts = true;
    try { S.rec && (S.rec.onend = null, S.rec.stop()); } catch (e) { }
    var fim = function () { S.tts = false; if (S.ativa && S.micLigado && !S.pausado && (S.modo === 'voz' || S.cfg.micSC)) iniciarReconhecimento(S); };
    u.onend = fim; u.onerror = fim; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    setTimeout(function () { if (S.tts && !window.speechSynthesis.speaking) fim(); }, 1500);
  } catch (e) { S.tts = false; }
}
ACOES.leituraProx = function () {
  var S = APP.sessao; if (!S || !S.ativa || S.pausado) return;
  var e = S.scr.etapas[S.leituraIdx]; if (!e) return;
  S.trans.push({ quem: 'op', texto: linhaLeitura(e), via: 'leitura', t: tempoDecorrido(S) });
  var li = $('#ln' + S.leituraIdx); if (li) li.classList.remove('at'); S.leituraIdx++;
  var prox = $('#ln' + S.leituraIdx); if (prox) prox.classList.add('at');
  if (S.leituraIdx >= S.scr.etapas.length) { var b = $('#bprox'); if (b) { b.textContent = 'Leitura concluída — avaliar'; b.dataset.act = 'sessFinalizar'; } }
};
ACOES.sessPausar = function () {
  var S = APP.sessao; if (!S || !S.ativa) return; var b = $('#bpausa');
  if (!S.pausado) { S.pausado = true; S.pausadoDesde = Date.now(); try { S.rec && (S.rec.onend = null, S.rec.stop()); } catch (e) { } try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } if (b) b.textContent = 'Retomar'; addMsg('sis', 'Simulação pausada.'); }
  else { S.pausadoTotal += Date.now() - S.pausadoDesde; S.pausado = false; S.pausadoDesde = null; if (b) b.textContent = 'Pausar'; addMsg('sis', 'Simulação retomada.'); if (S.micLigado && (S.modo === 'voz' || S.cfg.micSC)) iniciarReconhecimento(S); }
};
ACOES.sessReiniciar = function () {
  var S = APP.sessao; if (!S || !S.ativa) return;
  confirmar('Reiniciar a simulação?', 'O que você fez até agora será descartado (não conta como tentativa).', 'Reiniciar', 'Continuar').then(function (ok) { if (!ok) return; var cfg = S.cfg; APP.sujo = false; criarSessao(cfg); });
};
ACOES.sessFinalizar = function () {
  var S = APP.sessao; if (!S || !S.ativa) return;
  var nOp = S.trans.filter(function (m) { return m.quem === 'op'; }).length;
  if (!nOp) { confirmar('Nada foi dito ainda', 'Nenhuma fala sua foi registrada. Deseja sair sem avaliação?', 'Sair', 'Continuar').then(function (ok) { if (ok) { pararSessao(); APP.sessao = null; APP.sujo = false; go('#/treinar'); } }); return; }
  finalizarSessao('operador');
};

function moduloRecomendado(av, cenarioModulo) {
  var map = [[/identidade|prote[cç][aã]o|promess|proibid/i, 'm8'], [/respeito|empatia|escuta/i, 'm3'], [/descoberta|necessidade/i, 'm2'], [/obje[cç]/i, 'm5'], [/resolu|pr[oó]ximo|condu/i, 'm6'], [/clareza|objetiv|voc[aá]bulo|v[ií]cio|organiza/i, 'm4'], [/velocidade|pausa|volume/i, 'm10'], [/sauda|apresent|abertura/i, 'm1'], [/encerr/i, 'm9']];
  var pri = (av.prioridades || [])[0]; if (pri) { for (var i = 0; i < map.length; i++) if (map[i][0].test(pri.criterio)) return map[i][1]; }
  var nc = (av.etapasNaoCumpridas || [])[0]; if (nc) { for (var j = 0; j < map.length; j++) if (map[j][0].test(nc)) return map[j][1]; }
  return cenarioModulo || 'm1';
}
function finalizarSessao(motivo) {
  var S = APP.sessao; if (!S || S.finalizando) return; S.finalizando = true;
  var comVoz = S.rast.quadros.length > 20;
  var resumo = comVoz ? S.rast.resumo() : null, wpm = S.durVoz > 1 ? Math.round(S.palavrasVoz / (S.durVoz / 60)) : null;
  var intel = S.confs.length ? Math.round(FCT.media(S.confs) * 100) : null;
  var vozTodo = comVoz ? { resumo: resumo, wpm: wpm, intel: intel } : null;
  pararSessao();
  var pesos = Object.assign({}, FCT.PESOS_PADRAO[S.scr.modalidade] || FCT.PESOS_PADRAO.inbound), corte = S.teste && S.teste.corte != null ? S.teste.corte : E().config.notaCorte;
  if (S.teste) pesos.voz = 0; // métricas de voz nunca entram na nota de teste/seleção
  var cfgAv = { notaCorte: corte, pesos: pesos, faixas: E().config.faixas };
  var avInput = { script: S.scr, transcricao: S.trans, cliente: S.modo === 'leitura' ? null : S.cliente, config: cfgAv, voz: S.teste ? null : vozTodo, modo: S.modo };
  var av = FCT.avaliar(avInput);
  var passo = Promise.resolve(av);
  if (iaAtiva() && S.modo !== 'leitura') {
    passo = chamarIA('avaliar', { script: { nome: S.scr.nome, objetivo: S.scr.objetivo, etapas: S.scr.etapas.map(function (e) { return e.nome; }), condicoes: S.scr.condicoes, proibidas: S.scr.proibidas }, transcricao: S.trans.map(function (m) { return { quem: m.quem, texto: m.texto }; }) }).then(function (r) {
      var ok = r && r.conducao && r.comunicacao && typeof r.conducao.nota === 'number' && typeof r.comunicacao.nota === 'number' && Array.isArray(r.conducao.criterios) && Array.isArray(r.comunicacao.criterios);
      if (!ok) throw new Error('formato inesperado');
      av.blocos.forEach(function (b) { if (b.id === 'conducao' || b.id === 'comunicacao') { var x = r[b.id]; b.nota = Math.max(0, Math.min(100, Math.round(x.nota))); b.criterios = x.criterios.map(function (c) { return { nome: String(c.nome || 'Critério'), nivel: c.nivel === 2 || c.nivel === 1 || c.nivel === 0 ? c.nivel : 1, evidencia: String(c.evidencia || ''), motivo: String(c.motivo || ''), melhor: String(c.melhor || ''), auto: 'ia' }; }); b.apuracao = 'IA externa com rubrica'; } });
      FCT.recalcular(av, pesos, corte); av.modoAvaliacao = 'ia'; return av;
    }).catch(function (e) { toast('Avaliação por IA indisponível (' + e.message + '). Usei a avaliação de demonstração.', 'err'); return av; });
  }
  passo.then(function (av2) {
    var duracao = tempoDecorrido(S);
    var base = E().base, pct = null;
    if (!S.teste && base && S.amostras.length) pct = FCT.pctDentroZona(S.amostras, base, E().config.pontoAtencao, E().config.larg);
    var candidato = S.teste ? S.teste.candidato : null;
    var mesmas = E().tentativas.filter(function (t) { return t.cenarioId === S.cen.id && t.candidato === candidato && (S.teste ? t.testeId === S.teste.id : t.tipo !== 'teste'); }).length;
    var t = {
      id: uid('t'), quando: S.t0, tipo: S.teste ? 'teste' : 'treino', cenarioId: S.cen.id, cenarioNome: S.cen.nome, scriptId: S.scr.id, scriptNome: S.scr.nome, scriptVersao: S.scr.versao, modo: S.modo, moduloId: S.cfg.moduloId || S.cen.moduloId || null,
      nota: av2.nota, aprovado: av2.aprovado, falhaCritica: av2.falhasCriticas.length > 0, duracao: Math.round(duracao), tentativaNum: mesmas + 1, avaliacao: av2, transcricao: S.trans, motivoFim: S.encerradaPor || motivo, lacunas: S.cliente.lacunas || [],
      candidato: candidato, testeId: S.teste ? S.teste.id : null, revisao: null, conhecimento: S.teste ? S.teste.conhecimento : null,
      privado: { sentimento: null, espelho: { ligado: S.espelho, pctZona: pct }, voz: E().config.guardarMetricas ? vozTodo : null }
    };
    if (!E().config.guardarMetricas) { t.privado.espelho = { ligado: S.espelho, pctZona: null }; }
    E().tentativas.push(t); logAcesso(S.teste ? 'fim_teste' : 'fim_treino'); salvar();
    APP.sessao = null; APP.sujo = false; ACOES._descartar = null;
    if (S.teste) go('#/testefim/' + t.id); else go('#/relatorio/' + t.id);
  });
}

/* ================= RELATÓRIO ================= */
var SENTIMENTOS = ['Tranquilo', 'Confiante', 'Inseguro', 'Sob pressão', 'Desconfortável'];
function barraNota(n) { return n == null ? '<span class="mut">não se aplica</span>' : '<div class="barra"><i style="width:' + n + '%"></i></div>'; }
function telaRelatorio(app, p) {
  if (p[0] === 'testefim') {
    var tf = tentativaPorId(p[1]);
    app.innerHTML = '<div class="card" style="text-align:center"><h1>Teste concluído</h1><p>Obrigado' + (tf && tf.candidato ? ', ' + esc(tf.candidato) : '') + '! Suas respostas foram registradas e serão analisadas pelo instrutor.</p><div class="linha" style="justify-content:center"><a class="btn" href="#/testes">Voltar aos testes</a></div></div>';
    return;
  }
  var t0 = tentativaPorId(p[1]);
  if (!t0) { app.innerHTML = '<div class="card">Relatório não encontrado. <a href="#/historico">Voltar</a></div>'; return; }
  var t = ehInstrutor() ? FCT.visaoInstrutor(t0) : t0, av = t.avaliacao;
  if (!ehInstrutor() && t0.tipo === 'teste') { app.innerHTML = '<div class="card"><h1>Resultado de teste</h1><p class="mut">Resultados de testes são vistos pelo instrutor. Troque de perfil para consultar.</p><a class="btn" href="#/inicio">Voltar</a></div>'; return; }
  var h = '<a href="#/' + (t0.tipo === 'teste' ? 'testes' : 'historico') + '">← Voltar</a><h1>Relatório da simulação</h1><p class="mut">' + esc(t.cenarioNome) + ' · ' + FCT.dataBR(t.quando) + ' ' + FCT.horaBR(t.quando) + ' · ' + modoNome(t.modo) + ' · tentativa ' + t.tentativaNum + ' · ' + FCT.fmtDur(t.duracao) + (t.candidato ? ' · Candidato: ' + esc(t.candidato) : '') + '</p>';
  h += '<div class="card"><div class="linha entre"><div><div class="nota ' + (av.aprovado ? '' : 'rep') + '">' + t.nota + '</div><span class="mut">de 100 · corte ' + av.corte + '</span></div><div style="text-align:right">' + (av.falhasCriticas.length ? chip('Reprovado por falha crítica', 'bad') : av.aprovado ? chip('Aprovado', 'ok') : chip('Abaixo da nota de corte', 'am')) + '<br>' + (av.modoAvaliacao === 'ia' ? chip('Avaliação com IA externa') : '<span class="chip demo">Demonstração (regras do app)</span>') + '</div></div>';
  if (av.falhasCriticas.length) h += '<div class="aviso" style="border-color:var(--bad);background:#fde3e1"><b>Falha(s) crítica(s):</b> ' + av.falhasCriticas.map(esc).join(' · ') + '<br><span class="mut">Falhas críticas reprovam a tentativa mesmo com notas altas nos outros critérios' + (av.notaBruta !== av.nota ? ' (nota sem a trava: ' + av.notaBruta + ')' : '') + '.</span></div>';
  h += '</div>';
  h += '<div class="card"><h2>Desempenho por bloco</h2>' + av.blocos.map(function (b) { return '<div style="margin:8px 0"><div class="linha entre"><b>' + esc(b.nome) + '</b><span>' + (b.nota == null ? '—' : b.nota) + (b.peso ? ' <span class="mut">(peso ' + Math.round(b.peso * 100) + '%)</span>' : '') + '</span></div>' + barraNota(b.nota) + '<div class="mut" style="font-size:.78rem">' + esc(b.apuracao) + '</div></div>'; }).join('') + '</div>';
  h += '<div class="card"><h2>Pontos fortes</h2><ul>' + av.fortes.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
  h += '<div class="card"><h2>Prioridades de melhoria <span class="mut" style="font-weight:400">(no máximo 3)</span></h2>' + (av.prioridades.length ? av.prioridades.map(function (x, i) { return '<div style="margin-bottom:10px"><b>' + (i + 1) + '. ' + esc(x.criterio) + '</b><br><span class="mut">' + esc(x.motivo) + '</span>' + (x.evidencia ? '<br><i>Trecho: "' + esc(x.evidencia) + '"</i>' : '') + (x.melhor ? '<br><span style="color:var(--ok)">Como dizer melhor: ' + esc(x.melhor) + '</span>' : '') + '</div>'; }).join('') : '<p>Nenhuma prioridade: ótimo trabalho!</p>') + '</div>';
  if (av.etapasNaoCumpridas.length) h += '<div class="card"><h2>Etapas do script não cumpridas</h2><ul>' + av.etapasNaoCumpridas.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
  if (av.oportunidades.length) h += '<div class="card"><h2>Oportunidades perdidas</h2><ul>' + av.oportunidades.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
  if (t.lacunas && t.lacunas.length && ehInstrutor()) h += '<div class="card"><h2>Lacunas no script</h2>' + t.lacunas.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>';
  h += '<details><summary>Detalhe de cada critério (com evidência)</summary>' + av.blocos.map(function (b) { return b.criterios.length ? '<h3>' + esc(b.nome) + '</h3><table class="t">' + b.criterios.map(function (c) { return '<tr><td style="width:46%"><b>' + esc(c.nome) + '</b><br><span class="mut">' + (c.nivel == null ? 'não se aplica' : ['não fez', 'parcial', 'fez bem'][c.nivel]) + (c.critica ? ' · crítico' : '') + '</span></td><td>' + esc(c.motivo) + (c.evidencia ? '<br><i>"' + esc(c.evidencia) + '"</i>' : '') + (c.melhor ? '<br><span style="color:var(--ok)">' + esc(c.melhor) + '</span>' : '') + '</td></tr>'; }).join('') + '</table>' : ''; }).join('') + '</details>';
  // comparação com tentativa anterior (mesmo cenário)
  var anteriores = E().tentativas.filter(function (x) { return x.cenarioId === t.cenarioId && x.quando < t.quando && x.tipo === t0.tipo && x.candidato === t0.candidato; }).sort(function (a, b) { return b.quando - a.quando; });
  if (anteriores.length) { var ant = anteriores[0], d = t.nota - ant.nota; h += '<div class="card"><h2>Comparação com a tentativa anterior</h2><p>' + ant.nota + ' → <b>' + t.nota + '</b> (' + (d > 0 ? '+' : '') + d + ' ponto(s)). <a href="#/comparar/' + ant.id + '/' + t0.id + '">Comparar lado a lado</a></p></div>'; }
  // voz e autopercepção: só para o operador (não aparece no perfil instrutor)
  if (!ehInstrutor() && t0.privado) {
    var pv = t0.privado, vz = pv.voz;
    if (vz && vz.resumo) {
      h += '<div class="card"><h2>Sua voz nesta simulação <span class="chip">só você vê</span></h2><table class="t"><tr><td>Velocidade</td><td>' + (vz.wpm ? vz.wpm + ' palavras/min' : '—') + '</td></tr><tr><td>Pausas</td><td>' + vz.resumo.pausas + ' (' + vz.resumo.pausasLongas + ' longas)</td></tr><tr><td>Volume (relativo)</td><td>' + (vz.resumo.db != null ? Math.round(vz.resumo.db) + ' dB' : '—') + '</td></tr><tr><td>Tom médio</td><td>' + (vz.resumo.f0 ? Math.round(vz.resumo.f0) + ' Hz' : '—') + '</td></tr><tr><td>Inteligibilidade estimada</td><td>' + (vz.intel != null ? vz.intel + '%' : '—') + ' <span class="mut">(confiança do reconhecimento de fala; é aproximada)</span></td></tr></table>';
      if (E().base) { var fr = [FCT.fraseDiff('wpm', vz.wpm, E().base), FCT.fraseDiff('db', vz.resumo.db, E().base), FCT.fraseDiff('f0', vz.resumo.f0, E().base)].filter(Boolean); h += '<p><b>Comparado com a sua base:</b></p><ul>' + fr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
      if (pv.espelho && pv.espelho.pctZona != null) h += '<p><b>Tempo dentro da sua zona</b> (' + E().config.pontoAtencao.map(FCT.nomeMetrica).join(' e ') + '): ' + Math.round(pv.espelho.pctZona * 100) + '% — sua meta: ' + Math.round(E().config.metaZona * 100) + '%.</p>';
      h += '</div>';
    }
    h += '<div class="card"><h2>Como você se sentiu? <span class="chip">só você vê</span></h2><p class="mut">Opcional. Não há resposta certa: é só para você acompanhar a sua autopercepção ao longo do tempo. Nunca entra na nota nem aparece para o instrutor.</p><div class="linha" id="sent">' + SENTIMENTOS.map(function (s) { return '<button class="btn peq ' + (pv.sentimento === s ? '' : 'sec') + '" data-act="sentimento" data-id="' + t0.id + '" data-s="' + s + '" aria-pressed="' + (pv.sentimento === s) + '">' + s + '</button>'; }).join('') + '</div><div id="sentres">' + (pv.sentimento ? sentimentoTexto(t0) : '') + '</div></div>';
  }
  h += '<details><summary>Transcrição</summary>' + transcricaoHtml(t) + '</details>';
  if (t0.tipo === 'teste' && t0.conhecimento && ehInstrutor()) h += '<div class="card"><h2>Teste de conhecimento</h2><p>Nota <b>' + t0.conhecimento.nota + '</b> (' + t0.conhecimento.acertos + ' de ' + t0.conhecimento.total + ' acertos). <span class="mut">Não entra na nota da simulação; use como evidência complementar.</span></p></div>';
  if (t0.tipo === 'teste' && ehInstrutor()) h += revisaoHtml(t0);
  var rec = moduloPorId(moduloRecomendado(av, t.moduloId));
  h += '<div class="card"><h2>Próximo exercício recomendado</h2><p>' + (rec ? '<b>' + esc(rec.titulo) + '</b>' : '') + '</p><div class="linha"><a class="btn" href="#/aula/' + rec.id + '">Estudar o módulo</a><button class="btn sec" data-act="treinarCenario" data-c="' + rec.cenarioIds[0] + '" data-m="' + rec.id + '">Simular o cenário</button><button class="btn sec" data-act="treinarCenario" data-c="' + t.cenarioId + '" data-m="' + (t.moduloId || '') + '">Refazer este cenário</button></div></div>';
  h += '<div class="linha"><button class="btn sec" data-act="pdfRelatorio" data-id="' + t0.id + '">Baixar PDF</button>' + (t0.tipo === 'teste' ? '' : '<button class="btn sec" data-act="excluirTent" data-id="' + t0.id + '">Excluir esta tentativa</button>') + '</div>';
  app.innerHTML = h;
}
function sentimentoTexto(t) {
  var vz = t.privado.voz, s = t.privado.sentimento, txt = '<div class="aviso">Você registrou: <b>' + esc(s) + '</b>.';
  if (vz && vz.resumo && E().base) { var f = FCT.fraseDiff('wpm', vz.wpm, E().base); if (f) txt += ' Nesta simulação, as métricas mostraram: ' + esc(f); }
  return txt + ' O app não interpreta emoções: compare por conta própria como você se sentiu e o que as métricas registraram.</div>';
}
ACOES.sentimento = function (el) {
  var t = tentativaPorId(el.dataset.id); if (!t) return; t.privado = t.privado || {}; t.privado.sentimento = el.dataset.s; salvar();
  $$('#sent button').forEach(function (b) { var on = b.dataset.s === t.privado.sentimento; b.classList.toggle('sec', !on); b.setAttribute('aria-pressed', on); });
  $('#sentres').innerHTML = sentimentoTexto(t);
};
ACOES.excluirTent = function (el) {
  confirmar('Excluir tentativa', 'Esta tentativa será apagada do histórico. Isso não pode ser desfeito.', 'Excluir', 'Cancelar').then(function (ok) { if (!ok) return; E().tentativas = E().tentativas.filter(function (x) { return x.id !== el.dataset.id; }); salvar(); toast('Tentativa excluída.'); go('#/historico'); });
};
function revisaoHtml(t) {
  var r = t.revisao;
  return '<div class="card"><h2>Revisão do instrutor</h2>' + (r ? '<p>' + chip(r.decisao === 'aprovado' ? 'Aprovado' : r.decisao === 'reprovado' ? 'Reprovado' : 'Em análise', r.decisao === 'aprovado' ? 'ok' : r.decisao === 'reprovado' ? 'bad' : 'am') + ' por ' + esc(r.por) + ' em ' + FCT.dataBR(r.em) + (r.notaAjustada != null ? ' · nota ajustada para ' + r.notaAjustada + ' (IA/regras: ' + t.nota + ')' : '') + '<br>' + esc(r.comentario || '') + '</p>' : '<p class="mut">A decisão final é humana: revise as evidências e registre a decisão.</p>') +
    '<label class="c" for="rv_dec">Decisão</label><select id="rv_dec"><option value="aprovado">Aprovado</option><option value="reprovado">Reprovado</option><option value="analise">Em análise</option></select><label class="c" for="rv_nota">Ajuste de nota (opcional, 0 a 100)</label><input type="number" id="rv_nota" min="0" max="100" placeholder="Deixe vazio para manter ' + t.nota + '"><label class="c" for="rv_com">Comentário</label><textarea id="rv_com"></textarea><div class="erro" id="rv_erro" role="alert"></div><button class="btn" data-act="salvarRevisao" data-id="' + t.id + '" style="margin-top:8px">Registrar revisão</button>' +
    ((t.historicoRevisao || []).length ? '<details><summary>Histórico de revisões (' + t.historicoRevisao.length + ')</summary>' + t.historicoRevisao.map(function (x) { return '<p class="mut">' + FCT.dataBR(x.em) + ' ' + FCT.horaBR(x.em) + ' · ' + esc(x.decisao) + (x.notaAjustada != null ? ' · nota ' + x.notaAjustada : '') + ' · ' + esc(x.comentario || '') + '</p>'; }).join('') + '</details>' : '') + '</div>';
}
ACOES.salvarRevisao = function (el) {
  var t = tentativaPorId(el.dataset.id); if (!t) return; var nv = $('#rv_nota').value.trim(), nota = nv === '' ? null : Math.round(+nv);
  if (nota != null && (isNaN(nota) || nota < 0 || nota > 100)) { $('#rv_erro').textContent = 'A nota deve estar entre 0 e 100.'; return; }
  var rev = { decisao: $('#rv_dec').value, comentario: $('#rv_com').value.trim(), notaAjustada: nota, por: nomeUsuario(), em: Date.now() };
  t.revisao = rev; t.historicoRevisao = (t.historicoRevisao || []).concat([rev]); logAcesso('revisao_teste'); salvar(); toast('Revisão registrada.'); render();
};
