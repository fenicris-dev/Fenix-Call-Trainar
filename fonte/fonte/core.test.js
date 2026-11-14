const assert = require('assert');
const FCT = require('../src/core.js');
const D = require('../src/data.js');
let ok = 0, falhas = [];
function t(nome, fn) { try { fn(); ok++; console.log('  ok  ' + nome); } catch (e) { falhas.push(nome + ' -> ' + e.message); console.log('FALHA ' + nome + ' -> ' + e.message); } }

function seno(freq, amp, sr, n) { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = amp * Math.sin(2 * Math.PI * freq * i / sr); return b; }
// sinal "vozeado" com harmônicas
function vozeado(f0, amp, sr, n) { const b = new Float32Array(n); for (let i = 0; i < n; i++) { let v = 0; for (let h = 1; h <= 5; h++) v += Math.sin(2 * Math.PI * f0 * h * i / sr) / h; b[i] = amp * v / 2; } return b; }

console.log('# Texto');
t('norm remove acentos', () => assert.strictEqual(FCT.norm('Olá, Ação!'), 'ola, acao!'));
t('contarPalavras', () => assert.strictEqual(FCT.contarPalavras('Bom dia, tudo bem?'), 4));
t('vícios de linguagem', () => assert.strictEqual(FCT.contarVicios('Aí, tipo, né, eu acho, aham').total, 3));
t('temAlgum ignora acento e caixa', () => assert.ok(FCT.temAlgum('BOA TARDE, Empresa', ['boa tarde'])));

console.log('# Voz');
t('RMS e dB de seno 0,1', () => { const r = FCT.rms(seno(200, 0.1, 48000, 2048)); assert.ok(Math.abs(FCT.paraDb(r) - (-23)) < 0.6, FCT.paraDb(r)); });
[120, 150, 200, 260].forEach(f => t('tom ' + f + ' Hz detectado (±3%)', () => { const r = FCT.detectarTom(vozeado(f, 0.3, 48000, 2048), 48000); assert.ok(Math.abs(r.f0 - f) / f < 0.03, 'obtido ' + r.f0); }));
t('silêncio não tem tom', () => assert.strictEqual(FCT.detectarTom(new Float32Array(2048), 48000).f0, 0));
t('ruído sem tom claro', () => { const b = new Float32Array(2048); let s = 7; for (let i = 0; i < b.length; i++) { s = (s * 16807) % 2147483647; b[i] = (s / 2147483647 - 0.5) * 0.4; } assert.strictEqual(FCT.detectarTom(b, 48000).f0, 0); });

t('Rastreador conta pausas', () => {
  const r = new FCT.Rastreador({ limiarDb: -45 });
  let tt = 0;
  const seg = (dur, db, f0) => { for (let i = 0; i < dur * 20; i++) { r.quadro({ t: tt, db: db, f0: f0 }); tt += 0.05; } };
  seg(2, -20, 150); seg(1, -70, 0); seg(2, -22, 160); seg(2, -70, 0); seg(1, -21, 155);
  const s = r.resumo();
  assert.strictEqual(s.pausas, 2); assert.strictEqual(s.pausasLongas, 1);
  assert.ok(s.tFala > 4.5 && s.tFala < 5.5, 'tFala ' + s.tFala);
  assert.ok(Math.abs(s.f0 - 155) < 6);
});
t('silencioAtual cresce sem fala', () => {
  const r = new FCT.Rastreador({ limiarDb: -45 }); let tt = 0;
  for (let i = 0; i < 20; i++) { r.quadro({ t: tt, db: -20, f0: 150 }); tt += 0.05; }
  for (let i = 0; i < 100; i++) { r.quadro({ t: tt, db: -80, f0: 0 }); tt += 0.05; }
  assert.ok(r.silencioAtual() > 4.5);
});

t('semPausaAtual mede fala contínua', () => {
  const r = new FCT.Rastreador({ limiarDb: -45 }); let tt = 0;
  for (let i = 0; i < 20; i++) { r.quadro({ t: tt, db: -20, f0: 150 }); tt += 0.05; }
  for (let i = 0; i < 20; i++) { r.quadro({ t: tt, db: -80, f0: 0 }); tt += 0.05; }
  for (let i = 0; i < 100; i++) { r.quadro({ t: tt, db: -20, f0: 150 }); tt += 0.05; }
  assert.ok(r.semPausaAtual() > 4.5 && r.semPausaAtual() < 5.5, 'semPausa ' + r.semPausaAtual());
});

console.log('# Linha de base e zonas');
const base = { wpm: 140, db: -25, f0: 150, taxaPausas: 8 };
t('zona wpm ±25%', () => { const z = FCT.zona('wpm', base); assert.ok(Math.abs(z.min - 105) < 0.01 && Math.abs(z.max - 175) < 0.01); });
t('status dentro/acima/abaixo', () => {
  assert.strictEqual(FCT.statusZona('wpm', 150, base).status, 'dentro');
  assert.strictEqual(FCT.statusZona('wpm', 180, base).status, 'acima');
  assert.strictEqual(FCT.statusZona('wpm', 100, base).status, 'abaixo');
  assert.strictEqual(FCT.statusZona('db', -17, base).status, 'acima');
  assert.strictEqual(FCT.statusZona('f0', 200, base).status, 'acima');
});
t('sem base não classifica', () => assert.strictEqual(FCT.statusZona('wpm', 150, null).status, 'sem'));
t('largura da zona ajustável', () => assert.strictEqual(FCT.statusZona('wpm', 180, base, { wpm: 0.35, db: 6, f0: 0.2, pausa: 0.5 }).status, 'dentro'));
t('frase de diferença (sem emoção)', () => {
  const f = FCT.fraseDiff('wpm', 175, base);
  assert.ok(/25% mais rápido/.test(f), f);
  assert.ok(!/(nervos|ansios|tens|raiva|eufor)/i.test(f));
});
t('alertas neutros com dica prática', () => {
  const a = FCT.alertas({ wpm: 190, db: -35, f0: 190, semPausaS: 25, vicios: 4 }, base);
  const ids = a.map(x => x.id).sort().join(',');
  assert.strictEqual(ids, 'db,f0,pausa,vicios,wpm');
  a.forEach(x => { assert.ok(x.dica && x.dica.length > 10); assert.ok(!/(nervos|ansios|tens|raiva|eufor|estress)/i.test(x.texto + x.dica)); });
});
t('sem alerta quando dentro da zona', () => assert.strictEqual(FCT.alertas({ wpm: 140, db: -25, f0: 150, semPausaS: 3, vicios: 0 }, base).length, 0));
t('pct dentro da zona', () => {
  const p = FCT.pctDentroZona([{ wpm: 140, f0: 150 }, { wpm: 190, f0: 150 }], base, ['wpm', 'f0']);
  assert.ok(Math.abs(p - 0.75) < 1e-9, p);
});

console.log('# Cliente virtual + avaliador');
const scVendas = D.scripts.find(s => s.id === 'sc_vendas');
const cn3 = D.cenarios.find(c => c.id === 'cn3');
const boas = [
  'Boa tarde! Meu nome é Ana, da Empresa Modelo. Estou falando com quem?',
  'Aqui é a Ana, da Empresa Modelo. Como posso ajudar? Me conte o que o senhor busca em uma internet.',
  'Entendo a sua preocupação. Vou ser transparente: o valor é R$ 99,90 por mês, por escrito no contrato, e você ganha mais velocidade e estabilidade.',
  'Entendo. Se quiser sair, a fidelidade é de 12 meses e o prazo do cancelamento é de três dias úteis, tudo no contrato.',
  'Posso registrar a contratação para você? O próximo passo é a instalação em até 3 dias.',
  'Então ficou combinado a instalação em até 3 dias. Posso ajudar em mais alguma coisa? Obrigada por ligar, tenha um ótimo dia!'
];
function rodar(msgs, cen, scr, seed) {
  const est = FCT.novoCliente(cen, scr, seed || 99); const trans = [];
  for (const m of msgs) { trans.push({ quem: 'op', texto: m }); const r = FCT.responderCliente(est, m, cen, scr); trans.push({ quem: 'cl', texto: r.texto }); if (r.encerrou) break; }
  return { est, trans };
}
t('conversa boa leva ao fechamento com aceite', () => {
  const { est } = rodar(boas, cn3, scVendas);
  assert.strictEqual(est.aceitou, true); assert.strictEqual(est.motivoFim, 'fechamento'); assert.strictEqual(est.objResolvidas, est.objTotal);
});
t('respostas secas esgotam a paciência', () => {
  const { est } = rodar(['Oi', 'Sim', 'Ok', 'Não', 'Hum', 'Tá', 'Ah', 'Sei'], cn3, scVendas);
  assert.strictEqual(est.motivoFim, 'paciencia');
});
t('grosseria encerra a ligação', () => {
  const { est } = rodar(['Boa tarde, meu nome é Ana.', 'Você é um idiota, não é problema meu.'], cn3, scVendas);
  assert.strictEqual(est.motivoFim, 'grosseria');
});
t('mesma semente => mesma conversa (determinístico)', () => {
  const a = rodar(boas, cn3, scVendas, 5), b = rodar(boas, cn3, scVendas, 5);
  assert.deepStrictEqual(a.trans, b.trans);
});
t('nível 1 tem menos objeções que nível 4', () => {
  assert.ok(FCT.novoCliente({ id: 'x', perfil: 'colaborativo', nivel: 1, objecoes: [1, 2, 3, 4].map(i => ({ id: 'o' + i, texto: 't' })) }).objTotal < FCT.novoCliente({ id: 'x', perfil: 'irritado', nivel: 4, objecoes: [1, 2, 3, 4].map(i => ({ id: 'o' + i, texto: 't' })) }).objTotal);
});
t('lacuna registrada quando script não tem condições', () => {
  const scr = Object.assign({}, scVendas, { condicoes: '' });
  const { est } = rodar(['Boa tarde, meu nome é Ana.', 'Como posso ajudar? Me conte o que precisa.', 'Entendo a sua preocupação, vamos conversar com calma sobre o assunto aqui.', 'Entendo bastante, vou explicar as opções disponíveis passo a passo agora.'], cn3, scr);
  assert.ok(est.lacunas.length >= 1, JSON.stringify(est.lacunas));
});

function aval(msgs, cen, scr, extra) {
  const { est, trans } = rodar(msgs, cen, scr);
  return FCT.avaliar(Object.assign({ script: scr, transcricao: trans, cliente: est, config: { notaCorte: 70 } }, extra || {}));
}
t('boa conversa: aprovada, sem falhas críticas, etapas cumpridas', () => {
  const r = aval(boas, cn3, scVendas);
  assert.strictEqual(r.falhasCriticas.length, 0);
  assert.strictEqual(r.etapasNaoCumpridas.length, 0, r.etapasNaoCumpridas.join(','));
  assert.ok(r.nota >= 70 && r.aprovado, 'nota ' + r.nota);
  assert.strictEqual(r.modoAvaliacao, 'demonstracao');
});
t('promessa indevida reprova mesmo com resto bom', () => {
  const m = boas.slice(); m[2] = m[2] + ' Garanto 100% que nunca vai cair.';
  const r = aval(m, cn3, scVendas);
  assert.ok(r.falhasCriticas.some(f => /Promessa/.test(f))); assert.strictEqual(r.aprovado, false);
  assert.ok(r.nota < 70, 'nota ' + r.nota); assert.ok(r.notaBruta >= r.nota);
});
t('expressão proibida pelo script é falha crítica', () => {
  const m = boas.slice(); m[2] = m[2] + ' E ninguém reclama do nosso serviço.';
  const r = aval(m, cn3, scVendas); assert.ok(r.falhasCriticas.some(f => /proibida/.test(f))); assert.strictEqual(r.aprovado, false);
});
t('desrespeito é falha crítica', () => {
  const m = boas.slice(); m[3] = 'Isso não é problema meu, o senhor é incompetente.';
  assert.ok(aval(m, cn3, scVendas).falhasCriticas.some(f => /Desrespeito/.test(f)));
});
t('CPF completo exposto é falha crítica', () => {
  const m = boas.slice(); m[1] = 'Aqui é a Ana. Seu CPF é 123.456.789-00, certo? Como posso ajudar?';
  assert.ok(aval(m, cn3, scVendas).falhasCriticas.some(f => /Dado pessoal/.test(f)));
});
t('identidade obrigatória: sem confirmar, falha crítica', () => {
  const scSac = D.scripts.find(s => s.id === 'sc_sac'), cn1 = D.cenarios.find(c => c.id === 'cn1');
  const r = aval(['Boa tarde, meu nome é Ana. Como posso ajudar? Me conte o que aconteceu.', 'Entendo. A fatura tem o valor da mensalidade e o proporcional do período, vou explicar cada item.', 'Isso responde a sua dúvida? Posso ajudar em mais alguma coisa? Obrigada por ligar!'], cn1, scSac);
  assert.ok(r.falhasCriticas.some(f => /identidade/.test(f)));
});
t('avaliação é estável (mesma entrada => mesmo resultado)', () => {
  const a = aval(boas, cn3, scVendas), b = aval(boas, cn3, scVendas);
  assert.deepStrictEqual(a, b);
});
t('prioridades no máximo 3', () => { const r = aval(['Oi', 'Sim', 'Ok'], cn3, scVendas); assert.ok(r.prioridades.length <= 3 && r.prioridades.length > 0); });
t('nota baixa para conversa fraca', () => { const r = aval(['Oi', 'Sim', 'Ok'], cn3, scVendas); assert.ok(r.nota < 50, 'nota ' + r.nota); });
t('bloco voz sem áudio não pesa na nota', () => { const r = aval(boas, cn3, scVendas); const v = r.blocos.find(b => b.id === 'voz'); assert.strictEqual(v.nota, null); });
t('bloco voz com áudio usa faixa-alvo (sem emoção)', () => {
  const r = aval(boas, cn3, scVendas, { voz: { resumo: { duracao: 60, pausas: 5, pausasLongas: 1 }, wpm: 150 } });
  const v = r.blocos.find(b => b.id === 'voz'); assert.ok(v.nota >= 80);
  assert.ok(!/(nervos|ansios|tens|raiva|eufor)/i.test(JSON.stringify(v)));
});
t('leitura guiada: bloco de condução não pesa', () => {
  const r = aval(['Boa tarde, meu nome é Ana, da Empresa Modelo. Como posso ajudar?'], cn3, scVendas, { modo: 'leitura' });
  assert.strictEqual(r.blocos.find(b => b.id === 'conducao').nota, null);
});
t('recalcular mantém falha crítica reprovando', () => {
  const m = boas.slice(); m[2] = m[2] + ' Garanto 100%.';
  const r = aval(m, cn3, scVendas); r.blocos.forEach(b => { if (b.nota != null) b.nota = 100; });
  FCT.recalcular(r, FCT.PESOS_PADRAO.outbound, 70);
  assert.strictEqual(r.aprovado, false); assert.ok(r.nota <= 69);
});
t('pesos configuráveis alteram a nota', () => {
  const a = aval(['Boa tarde, meu nome é Ana, como posso ajudar? Me conte.', 'Ok'], cn3, scVendas);
  const b = aval(['Boa tarde, meu nome é Ana, como posso ajudar? Me conte.', 'Ok'], cn3, scVendas, { config: { notaCorte: 70, pesos: { script: 1, conducao: 0, comunicacao: 0, voz: 0, conformidade: 0 } } });
  assert.notStrictEqual(a.nota, b.nota);
});

console.log('# Domínio, estatísticas, dados');
const agora = Date.now();
t('domínio: 3 seguidas >= corte sem falha crítica', () => {
  const ts = [75, 80, 90].map((n, i) => ({ cenarioId: 'cn1', nota: n, quando: agora - (3 - i) * 1000 }));
  assert.strictEqual(FCT.dominio(['cn1'], ts, 70, 3).dominado, true);
});
t('domínio: falha crítica zera a sequência', () => {
  const ts = [{ nota: 90, quando: 1 }, { nota: 90, quando: 2, falhaCritica: true }, { nota: 90, quando: 3 }].map(x => Object.assign({ cenarioId: 'cn1' }, x));
  const d = FCT.dominio(['cn1'], ts, 70, 3); assert.strictEqual(d.dominado, false); assert.strictEqual(d.seqAtual, 1);
});
t('domínio ignora tentativas de teste', () => {
  const ts = [75, 80, 90].map((n, i) => ({ cenarioId: 'cn1', nota: n, quando: i + 1, tipo: 'teste' }));
  assert.strictEqual(FCT.dominio(['cn1'], ts, 70, 3).dominado, false);
});
t('revisão espaçada em 7 dias', () => {
  const ts = [75, 80, 90].map((n, i) => ({ cenarioId: 'cn1', nota: n, quando: agora - 8 * 864e5 + i }));
  assert.strictEqual(FCT.dominio(['cn1'], ts, 70, 3, agora).revisao, 'revisao7');
});
t('agrupamento diário', () => { const g = FCT.agruparPorPeriodo([{ nota: 60, quando: new Date(2026, 10, 1, 10).getTime() }, { nota: 80, quando: new Date(2026, 10, 1, 15).getTime() }, { nota: 90, quando: new Date(2026, 10, 2).getTime() }], 'dia'); assert.strictEqual(g.length, 2); assert.strictEqual(g[0].media, 70); });
t('data dd/mm/aaaa', () => assert.strictEqual(FCT.dataBR(new Date(2026, 10, 13).getTime()), '13/11/2026'));
t('corrigirQuiz', () => { const r = FCT.corrigirQuiz(D.diagnostico, [1, 1, 1, 1, 1, 0]); assert.strictEqual(r.acertos, 5); assert.strictEqual(r.nota, 83); });
t('visão do instrutor remove dados privados', () => {
  const v = FCT.visaoInstrutor({ id: 1, nota: 80, sentimento: 'inseguro', espelho: { x: 1 }, voz: { wpm: 150 }, privado: { a: 1 }, candidato: 'Zé' });
  assert.ok(!('sentimento' in v) && !('espelho' in v) && !('privado' in v) && !('voz' in v)); assert.strictEqual(v.nota, 80);
});
t('visão do instrutor remove o bloco Voz da avaliação', () => {
  const v = FCT.visaoInstrutor({ id: 1, avaliacao: { blocos: [{ id: 'script' }, { id: 'voz' }] } });
  assert.deepStrictEqual(v.avaliacao.blocos.map(b => b.id), ['script']);
});
t('migrar completa campos faltantes', () => { const e = FCT.migrar({ scripts: [] }); assert.ok(e.config && e.config.nSeguidas === 3 && Array.isArray(e.tentativas)); });
t('validar backup', () => { assert.ok(FCT.validarBackup({}) !== null); assert.strictEqual(FCT.validarBackup({ app: 'fenix-call-trainer', dados: { scripts: [], tentativas: [] } }), null); });
t('esc evita injeção de HTML', () => assert.strictEqual(FCT.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;'));
t('dados: 8 cenários, 10 módulos, trilha aponta para cenários existentes', () => {
  assert.strictEqual(D.cenarios.length, 8); assert.strictEqual(D.modulos.length, 10);
  D.modulos.forEach(m => m.cenarioIds.forEach(id => assert.ok(D.cenarios.find(c => c.id === id), m.id + ' -> ' + id)));
  D.cenarios.forEach(c => { assert.ok(D.scripts.find(s => s.id === c.scriptId)); assert.ok(FCT.PERFIS[c.perfil]); });
});

console.log('\n' + ok + ' ok, ' + falhas.length + ' falha(s)');
if (falhas.length) { console.log(falhas.join('\n')); process.exit(1); }
