/* Fênix Call Trainer — lógica central (sem acesso a DOM). Testável em Node. */
(function (root) {
  'use strict';
  var FCT = {};
  FCT.VERSAO = '1.0';

  /* ============ Utilitários de texto ============ */
  FCT.norm = function (s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  };
  FCT.palavras = function (s) {
    var m = FCT.norm(s).match(/[a-z0-9]+/g);
    return m ? m : [];
  };
  FCT.contarPalavras = function (s) { return FCT.palavras(s).length; };
  FCT.frases = function (s) {
    return String(s || '').split(/[.!?\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  };
  FCT.temAlgum = function (texto, lista) {
    var t = ' ' + FCT.norm(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    for (var i = 0; i < lista.length; i++) {
      var k = ' ' + FCT.norm(lista[i]).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
      if (k.trim() && t.indexOf(k) >= 0) return lista[i];
      // permite prefixo (ex.: "ajud" casa "ajudar")
      var kk = k.trim();
      if (kk && kk.length >= 4 && t.indexOf(' ' + kk) >= 0 && lista[i].slice(-1) === '*') return lista[i];
    }
    return null;
  };
  FCT.trecho = function (t, n) { t = String(t || ''); return t.length > (n || 140) ? t.slice(0, n || 140) + '…' : t; };

  var VICIOS = ['ne', 'tipo', 'entao', 'aham', 'eh', 'ahn', 'hum', 'ai', 'cara', 'mano', 'sabe', 'assim', 'meio'];
  var VICIOS_FORTES = ['ne', 'tipo', 'aham', 'eh', 'ahn', 'hum', 'cara', 'mano'];
  FCT.contarVicios = function (texto) {
    var p = FCT.palavras(texto), n = 0, ocorr = {};
    for (var i = 0; i < p.length; i++) {
      if (VICIOS_FORTES.indexOf(p[i]) >= 0) { n++; ocorr[p[i]] = (ocorr[p[i]] || 0) + 1; }
      else if (p[i] === 'entao' && i > 0 && p[i - 1] === 'entao') { n++; }
    }
    return { total: n, porPalavra: ocorr };
  };

  /* ============ Voz: métricas puras ============ */
  FCT.rms = function (buf) {
    var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / (buf.length || 1));
  };
  FCT.paraDb = function (r) { return 20 * Math.log10(Math.max(r, 1e-8)); };

  // Autocorrelação normalizada. Retorna {f0, clareza}; f0=0 se sem voz tonal.
  FCT.detectarTom = function (buf, sr) {
    var n = buf.length, minF = 70, maxF = 400;
    var minLag = Math.floor(sr / maxF), maxLag = Math.min(Math.floor(sr / minF), n - 1);
    var e0 = 0; for (var i = 0; i < n; i++) e0 += buf[i] * buf[i];
    if (e0 / n < 1e-6) return { f0: 0, clareza: 0 };
    var melhor = -1, lagM = 0, corr = new Float32Array(maxLag + 2);
    for (var lag = minLag; lag <= maxLag; lag++) {
      var c = 0, e1 = 0;
      for (var j = 0; j < n - lag; j++) { c += buf[j] * buf[j + lag]; e1 += buf[j + lag] * buf[j + lag]; }
      var nc = c / Math.sqrt((e0 || 1) * (e1 || 1));
      corr[lag] = nc;
    }
    // primeiro pico alto (evita sub-harmônicos)
    var limiar = 0.0;
    for (var l = minLag; l <= maxLag; l++) if (corr[l] > limiar) limiar = corr[l];
    if (limiar < 0.5) return { f0: 0, clareza: limiar };
    var alvo = limiar * 0.9;
    for (var l2 = minLag + 1; l2 < maxLag; l2++) {
      if (corr[l2] >= alvo && corr[l2] >= corr[l2 - 1] && corr[l2] >= corr[l2 + 1]) { lagM = l2; melhor = corr[l2]; break; }
    }
    if (!lagM) return { f0: 0, clareza: limiar };
    // interpolação parabólica
    var a = corr[lagM - 1], b = corr[lagM], c2 = corr[lagM + 1];
    var den = (a - 2 * b + c2), desl = den ? 0.5 * (a - c2) / den : 0;
    return { f0: sr / (lagM + desl), clareza: melhor };
  };

  FCT.mediana = function (arr) {
    if (!arr.length) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; }), m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  FCT.quantil = function (arr, q) {
    if (!arr.length) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var pos = (a.length - 1) * q, b = Math.floor(pos), r = pos - b;
    return a[b + 1] !== undefined ? a[b] + r * (a[b + 1] - a[b]) : a[b];
  };
  FCT.media = function (arr) { return arr.length ? arr.reduce(function (x, y) { return x + y; }, 0) / arr.length : 0; };

  /* Rastreador de fala: recebe quadros {t (s), db, f0} e produz resumo de volume, tom e pausas. */
  function Rastreador(opts) {
    opts = opts || {};
    this.limiarDb = opts.limiarDb != null ? opts.limiarDb : -48; // ajustável por calibração de ruído
    this.pausaMin = opts.pausaMin || 0.4;
    this.pausaLonga = opts.pausaLonga || 1.5;
    this.reset();
  }
  Rastreador.prototype.reset = function () {
    this.quadros = []; this.dbs = []; this.f0s = [];
    this.tFala = 0; this.tSilencio = 0; this.ultT = null; this.estado = 'silencio'; this.inicioEstado = null;
    this.pausas = []; this.ultimaFalaT = null; this.t0 = null; this.emFala = false;
  };
  Rastreador.prototype.quadro = function (q) {
    if (this.t0 == null) this.t0 = q.t;
    var dt = this.ultT == null ? 0 : Math.max(0, q.t - this.ultT);
    this.ultT = q.t;
    var fala = q.db > this.limiarDb;
    if (fala) {
      this.tFala += dt; this.dbs.push(q.db); if (q.f0 > 0) this.f0s.push(q.f0);
      if (this.estado === 'silencio') {
        if (this.inicioEstado != null && this.ultimaFalaT != null) {
          var dur = q.t - this.inicioEstado;
          if (dur >= this.pausaMin) { this.pausas.push(dur); this.ultPausaT = q.t; }
        }
        this.estado = 'fala'; this.inicioEstado = q.t;
      }
      this.ultimaFalaT = q.t;
    } else {
      this.tSilencio += dt;
      if (this.estado === 'fala') { this.estado = 'silencio'; this.inicioEstado = q.t; }
    }
    this.quadros.push(q);
  };
  // segundos falando sem nenhuma pausa (>= pausaMin); 0 se está em silêncio
  Rastreador.prototype.semPausaAtual = function () {
    if (this.estado !== 'fala' || this.ultT == null) return 0;
    var ref = this.ultPausaT != null ? this.ultPausaT : this.t0;
    return Math.max(0, this.ultT - ref);
  };
  Rastreador.prototype.silencioAtual = function () {
    if (this.estado === 'silencio' && this.ultimaFalaT != null && this.ultT != null) return this.ultT - this.ultimaFalaT;
    return 0;
  };
  Rastreador.prototype.resumo = function () {
    var dur = this.t0 == null ? 0 : (this.ultT - this.t0);
    var pausasLongas = this.pausas.filter(function (p) { return p >= 1.5; }).length;
    var f0m = FCT.mediana(this.f0s);
    var variacao = 0;
    if (this.f0s.length > 4 && f0m > 0) {
      var p10 = FCT.quantil(this.f0s, 0.1), p90 = FCT.quantil(this.f0s, 0.9);
      variacao = (p90 - p10) / f0m; // amplitude relativa do tom
    }
    return {
      duracao: dur, tFala: this.tFala,
      db: this.dbs.length ? FCT.mediana(this.dbs) : null,
      dbVar: this.dbs.length ? (FCT.quantil(this.dbs, 0.9) - FCT.quantil(this.dbs, 0.1)) : 0,
      f0: f0m || null, f0Var: variacao,
      pausas: this.pausas.length, pausaMedia: this.pausas.length ? FCT.media(this.pausas) : 0, pausasLongas: pausasLongas,
      taxaPausas: dur > 0 ? this.pausas.length / (dur / 60) : 0
    };
  };
  FCT.Rastreador = Rastreador;

  /* ============ Linha de base e zonas ============ */
  // m = {wpm, db, f0, taxaPausas}. Zonas em torno da mediana pessoal.
  FCT.criarBase = function (resumo, palavrasLidas, segundosLeitura) {
    var wpm = segundosLeitura > 0 ? (palavrasLidas / (segundosLeitura / 60)) : 0;
    return {
      wpm: Math.round(wpm), db: resumo.db, f0: resumo.f0, taxaPausas: resumo.taxaPausas,
      f0Var: resumo.f0Var, criadoEm: Date.now()
    };
  };
  FCT.LARGURA_PADRAO = { wpm: 0.25, db: 6, f0: 0.2, pausa: 0.5 }; // wpm/f0/pausa relativos; db em dB absolutos
  FCT.zona = function (metrica, base, larg) {
    larg = larg || FCT.LARGURA_PADRAO;
    if (!base) return null;
    if (metrica === 'wpm' && base.wpm) return { min: base.wpm * (1 - larg.wpm), max: base.wpm * (1 + larg.wpm), centro: base.wpm };
    if (metrica === 'db' && base.db != null) return { min: base.db - larg.db, max: base.db + larg.db, centro: base.db };
    if (metrica === 'f0' && base.f0) return { min: base.f0 * (1 - larg.f0), max: base.f0 * (1 + larg.f0), centro: base.f0 };
    if (metrica === 'pausa' && base.taxaPausas != null) {
      var c = Math.max(base.taxaPausas, 1);
      return { min: Math.max(0, c * (1 - larg.pausa)), max: c * (1 + larg.pausa), centro: c };
    }
    return null;
  };
  FCT.statusZona = function (metrica, valor, base, larg) {
    var z = FCT.zona(metrica, base, larg);
    if (!z || valor == null || isNaN(valor)) return { status: 'sem', zona: z };
    if (valor < z.min) return { status: 'abaixo', zona: z };
    if (valor > z.max) return { status: 'acima', zona: z };
    return { status: 'dentro', zona: z };
  };
  FCT.diffBase = function (metrica, valor, base) {
    if (!base || valor == null) return null;
    var b = metrica === 'wpm' ? base.wpm : metrica === 'db' ? base.db : metrica === 'f0' ? base.f0 : base.taxaPausas;
    if (!b) return null;
    if (metrica === 'db') return { abs: valor - b, tipo: 'db' };
    return { pct: Math.round(((valor - b) / b) * 100), tipo: 'pct' };
  };
  var NOMES = { wpm: 'velocidade', db: 'volume', f0: 'tom', pausa: 'pausas' };
  FCT.nomeMetrica = function (m) { return NOMES[m] || m; };
  FCT.fraseDiff = function (metrica, valor, base) {
    var d = FCT.diffBase(metrica, valor, base);
    if (!d) return '';
    if (d.tipo === 'db') {
      if (Math.abs(d.abs) < 1) return 'Seu volume ficou igual ao da sua base.';
      return 'Seu volume ficou ' + Math.abs(Math.round(d.abs)) + ' dB ' + (d.abs > 0 ? 'acima' : 'abaixo') + ' da sua base.';
    }
    var nome = { wpm: 'velocidade', f0: 'tom', pausa: 'taxa de pausas' }[metrica];
    if (Math.abs(d.pct) < 3) return 'Sua ' + nome + ' ficou igual à da sua base.';
    var verbo = metrica === 'wpm' ? (d.pct > 0 ? 'mais rápido' : 'mais devagar') : (d.pct > 0 ? 'acima' : 'abaixo');
    if (metrica === 'wpm') return 'Você falou ' + Math.abs(d.pct) + '% ' + verbo + ' que na sua base.';
    return 'Sua ' + nome + ' ficou ' + Math.abs(d.pct) + '% ' + verbo + ' da sua base.';
  };
  // Alertas neutros: sem rótulo emocional, sempre com dica prática.
  FCT.alertas = function (est, base, cfg) {
    cfg = cfg || {}; var out = [];
    var semPausaS = cfg.semPausaS || 20;
    if (est.wpm && base) {
      var s = FCT.statusZona('wpm', est.wpm, base, cfg.larg);
      if (s.status === 'acima') out.push({ id: 'wpm', texto: 'Ritmo acelerou', dica: 'Faça uma pausa curta e respire antes da próxima frase.' });
      if (s.status === 'abaixo') out.push({ id: 'wpm', texto: 'Ritmo mais lento que a sua base', dica: 'Se quiser, retome um ritmo um pouco mais ágil.' });
    }
    if (est.db != null && base) {
      var d = FCT.statusZona('db', est.db, base, cfg.larg);
      if (d.status === 'abaixo') out.push({ id: 'db', texto: 'Volume abaixo da sua base', dica: 'Aproxime o microfone e projete um pouco mais a voz.' });
      if (d.status === 'acima') out.push({ id: 'db', texto: 'Volume acima da sua base', dica: 'Afaste um pouco o microfone ou fale com mais suavidade.' });
    }
    if (est.f0 && base) {
      var f = FCT.statusZona('f0', est.f0, base, cfg.larg);
      if (f.status === 'acima') out.push({ id: 'f0', texto: 'Tom acima da sua base', dica: 'Solte os ombros e fale a partir de uma respiração mais profunda.' });
      if (f.status === 'abaixo') out.push({ id: 'f0', texto: 'Tom abaixo da sua base', dica: 'Sorria levemente e dê mais variação à entonação.' });
    }
    if (est.semPausaS != null && est.semPausaS >= semPausaS) {
      out.push({ id: 'pausa', texto: 'Sem pausas há ' + Math.round(est.semPausaS) + ' s', dica: 'Termine a ideia e respire.' });
    }
    if (est.vicios != null && est.vicios >= (cfg.viciosMax || 3)) {
      out.push({ id: 'vicios', texto: 'Muitos vícios de linguagem nesta resposta', dica: 'Troque o vício por uma pausa curta.' });
    }
    return out;
  };

  // Porcentagem de quadros dentro da zona para as métricas escolhidas
  FCT.pctDentroZona = function (amostras, base, metricas, larg) {
    // amostras: [{wpm, db, f0, pausa}] — uma por janela
    var tot = 0, dentro = 0;
    amostras.forEach(function (a) {
      metricas.forEach(function (m) {
        var v = a[m]; if (v == null || !v) return;
        var s = FCT.statusZona(m, v, base, larg);
        if (s.status === 'sem') return;
        tot++; if (s.status === 'dentro') dentro++;
      });
    });
    return tot ? dentro / tot : null;
  };

  /* ============ Faixas-alvo por operação (configuráveis) ============ */
  FCT.FAIXAS_PADRAO = { wpm: [110, 170], pausasLongasMax: 3, viciosPor100: 3 };

  /* ============ Cliente virtual (modo Demonstração, por regras) ============ */
  FCT.PERFIS = {
    colaborativo: { nome: 'Colaborativo', paciencia: 6, tom: 'cordial' },
    apressado: { nome: 'Apressado', paciencia: 3, tom: 'curto' },
    desconfiado: { nome: 'Desconfiado', paciencia: 4, tom: 'cauteloso' },
    indeciso: { nome: 'Indeciso', paciencia: 5, tom: 'hesitante' },
    irritado: { nome: 'Irritado', paciencia: 3, tom: 'ríspido' },
    cancelar: { nome: 'Quer cancelar', paciencia: 4, tom: 'firme' },
    concorrente: { nome: 'Compara com concorrente', paciencia: 4, tom: 'comparativo' },
    desconhece: { nome: 'Não conhece o produto', paciencia: 5, tom: 'curioso' }
  };
  FCT.NIVEIS = { 1: 'Iniciante', 2: 'Intermediário', 3: 'Avançado', 4: 'Especialista' };

  var FALAS = {
    colaborativo: {
      motivo: ['Olá! Tudo bem? Eu estava querendo entender melhor sobre {assunto}.'],
      detalhe: ['Claro, posso explicar: {detalhe}'],
      obj: ['Hum, mas eu fiquei com uma dúvida: {obj}', 'Entendi. Só que {obj}', 'Certo, mas ainda me preocupa o seguinte: {obj}'],
      repete: ['Desculpe, não ficou claro pra mim. {obj}'],
      aceita: ['Entendi, faz sentido. Pode seguir então.', 'Perfeito, gostei. Vamos em frente.'],
      recusa: ['Obrigado pela atenção, mas vou pensar com calma e retorno depois.'],
      neutro: ['Certo, pode continuar.', 'Entendi. E depois?', 'Ok, estou ouvindo.']
    },
    apressado: {
      motivo: ['Oi, tenho pouco tempo. É sobre {assunto}, seja direto, por favor.'],
      detalhe: ['Resumindo: {detalhe}'],
      obj: ['Mas rapidinho: {obj}', 'Tá, só que {obj}'],
      repete: ['Não tenho tempo pra enrolação. {obj}'],
      aceita: ['Ok, fechado. Vamos resolver logo.'],
      recusa: ['Não vai dar agora. Preciso desligar.'],
      neutro: ['Certo, vai direto ao ponto.', 'Ok. E aí?']
    },
    desconfiado: {
      motivo: ['Alô? Quem está falando mesmo? É sobre {assunto}?'],
      detalhe: ['Tá bom. O que eu preciso saber é: {detalhe}'],
      obj: ['Hum... {obj} Como eu sei que isso é verdade?', 'Isso eu já ouvi antes. {obj}'],
      repete: ['Você não respondeu minha dúvida. {obj}'],
      aceita: ['Tá, parece certo. Mas quero tudo registrado.'],
      recusa: ['Não me sinto seguro pra continuar. Vou verificar por conta própria.'],
      neutro: ['Hum, sei.', 'Continua, estou prestando atenção.']
    },
    indeciso: {
      motivo: ['Oi... então, eu queria ver sobre {assunto}, mas não sei bem se vale a pena.'],
      detalhe: ['É que {detalhe}'],
      obj: ['Hum, será? {obj}', 'Não sei... {obj}'],
      repete: ['Fiquei confuso ainda. {obj}'],
      aceita: ['Tá bom, acho que posso tentar então.'],
      recusa: ['Preciso pensar mais um pouco. Me liga outra hora?'],
      neutro: ['Aham, entendi... acho.', 'Hum, e o que mais?']
    },
    irritado: {
      motivo: ['Finalmente alguém atende! Estou muito chateado com {assunto}!'],
      detalhe: ['O problema é: {detalhe} Isso é um absurdo!'],
      obj: ['E ainda por cima {obj}', 'Não acho justo. {obj}'],
      repete: ['Você não está me ouvindo! {obj}'],
      aceita: ['Tá bom, se resolver de verdade eu aceito.'],
      recusa: ['Chega, isso não resolve nada. Quero falar com outra pessoa.'],
      neutro: ['Hum. Continue.', 'Estou esperando uma solução.']
    },
    cancelar: {
      motivo: ['Olá. Quero cancelar {assunto}.'],
      detalhe: ['O motivo é: {detalhe}'],
      obj: ['Mesmo assim, {obj}', 'Já decidi, mas {obj}'],
      repete: ['Eu já disse. {obj}'],
      aceita: ['Tá, se for assim eu fico mais um tempo.'],
      recusa: ['Não adianta, quero cancelar mesmo.'],
      neutro: ['Entendi. Mas continuo querendo cancelar.', 'Certo. E então?']
    },
    concorrente: {
      motivo: ['Oi. Estou olhando {assunto}, mas também estou vendo a concorrência.'],
      detalhe: ['A outra empresa me ofereceu: {detalhe}'],
      obj: ['Na concorrência é diferente: {obj}', 'Comparando, {obj}'],
      repete: ['Isso não responde a comparação. {obj}'],
      aceita: ['Tá, com esses argumentos eu fico com vocês.'],
      recusa: ['Vou ficar com a outra empresa mesmo.'],
      neutro: ['Certo, continue.', 'E o que mais vocês têm de diferente?']
    },
    desconhece: {
      motivo: ['Oi, boa tarde. Me falaram de {assunto}, mas eu não sei o que é.'],
      detalhe: ['Eu só sei que {detalhe}'],
      obj: ['Mas como funciona isso? {obj}', 'Não entendi bem. {obj}'],
      repete: ['Ainda não entendi. {obj}'],
      aceita: ['Ah, agora entendi! Quero experimentar.'],
      recusa: ['Ainda está confuso, vou pesquisar antes.'],
      neutro: ['Certo, vai me explicando.', 'Entendi, pode seguir.']
    }
  };

  // Intenções detectadas na fala do operador (regras simples, determinísticas)
  var PAL_SAUDACAO = ['bom dia', 'boa tarde', 'boa noite', 'ola', 'oi '];
  var PAL_EMPATIA = ['entendo', 'compreendo', 'sinto muito', 'imagino', 'lamento', 'desculp', 'peco desculpas', 'sei que', 'faz sentido', 'tem razao', 'obrigado por avisar', 'agradeco'];
  var PAL_BENEF = ['beneficio', 'vantagem', 'inclui', 'garante', 'economi', 'desconto', 'gratis', 'sem custo', 'ganha', 'oferece', 'plano', 'cobertura', 'prazo', 'suporte'];
  var PAL_FECHAR = ['posso ajudar em mais', 'mais alguma duvida', 'mais alguma coisa', 'tenha um otimo', 'tenha uma otima', 'obrigado por ligar', 'obrigada por ligar', 'agradeco o contato', 'foi um prazer', 'ate logo', 'ate mais', 'bom resto de'];
  var PAL_PROPOR = ['posso fechar', 'vamos fechar', 'posso registrar', 'quer aderir', 'podemos seguir', 'posso agendar', 'posso confirmar', 'gostaria de aceitar', 'fechamos', 'posso aplicar', 'quer contratar', 'posso proceder', 'posso enviar', 'combinado'];
  var PAL_RESUMO = ['resumindo', 'entao combinamos', 'ficou combinado', 'recapitulando', 'so para confirmar', 'para resumir', 'entao ficou'];
  var PAL_PROXIMO = ['proximo passo', 'a partir de agora', 'voce vai receber', 'vou enviar', 'vou registrar', 'em ate', 'prazo de'];
  var PAL_GROSSO = ['idiota', 'burro', 'burra', 'cala a boca', 'cale a boca', 'imbecil', 'estupido', 'estupida', 'otario', 'incompetente', 'problema e seu', 'nao e problema meu'];
  var PAL_PROMESSA = ['garanto', 'prometo', '100%', 'cem por cento', 'sem nenhum risco', 'nunca vai', 'nunca falha', 'com certeza absoluta'];
  FCT.PAL = { saudacao: PAL_SAUDACAO, empatia: PAL_EMPATIA, benef: PAL_BENEF, fechar: PAL_FECHAR, propor: PAL_PROPOR, resumo: PAL_RESUMO, proximo: PAL_PROXIMO, grosso: PAL_GROSSO, promessa: PAL_PROMESSA };

  FCT.intencoes = function (texto, script) {
    var t = texto || '', n = FCT.norm(t);
    var i = {
      saudacao: !!FCT.temAlgum(t, PAL_SAUDACAO),
      empatia: !!FCT.temAlgum(t, PAL_EMPATIA),
      beneficio: !!FCT.temAlgum(t, PAL_BENEF),
      fechar: !!FCT.temAlgum(t, PAL_FECHAR),
      propor: !!FCT.temAlgum(t, PAL_PROPOR),
      resumo: !!FCT.temAlgum(t, PAL_RESUMO),
      proximo: !!FCT.temAlgum(t, PAL_PROXIMO),
      grosso: !!FCT.temAlgum(t, PAL_GROSSO),
      promessa: !!FCT.temAlgum(t, PAL_PROMESSA),
      pergunta: /\?/.test(t) || /\b(como|qual|quais|quando|onde|por que|porque|o que|quanto|voce pode|poderia)\b/.test(n),
      perguntaAberta: /\b(como|o que|qual|quais|quando|por que|porque|para que|em que)\b/.test(n) && (/\?/.test(t) || n.indexOf('me conte') >= 0 || n.indexOf('me diga') >= 0),
      numeros: /\d/.test(t),
      palavras: FCT.contarPalavras(t)
    };
    i.apresentacao = /\b(meu nome|me chamo|aqui (e|eh)|sou (o|a) |falo com|atendente)\b/.test(n);
    i.identificacao = /\b(confirmar|confirmo|confirma|me informe|me informa|pode informar|poderia informar)\b.*\b(cpf|nome completo|data de nascimento|cadastro|titular|protocolo|e-?mail|endereco)\b/.test(n) || /\b(cpf|data de nascimento|nome completo)\b.*\b(por favor|poderia|pode)\b/.test(n);
    return i;
  };

  function rngSemente(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function escolhe(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function preencher(t, vars) { return t.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; }); }

  // cenario: {perfil, nivel, assunto, detalhe, objecoes:[texto...], respostas:{}} ; script: objeto de script
  FCT.novoCliente = function (cenario, script, seed) {
    var perfil = FCT.PERFIS[cenario.perfil] || FCT.PERFIS.colaborativo;
    var nObj = Math.min((cenario.objecoes || []).length, [0, 1, 2, 3, 4][cenario.nivel || 1]);
    return {
      cenarioId: cenario.id, perfil: cenario.perfil, nivel: cenario.nivel || 1,
      paciencia: perfil.paciencia + (cenario.nivel <= 1 ? 2 : cenario.nivel >= 4 ? -1 : 0),
      pacienciaMax: perfil.paciencia + (cenario.nivel <= 1 ? 2 : cenario.nivel >= 4 ? -1 : 0),
      fila: (cenario.objecoes || []).slice(0, nObj), objAtual: null, objResolvidas: 0, objTotal: nObj,
      fase: 'abertura', detalheRevelado: false, aceitou: null, encerrada: false, motivoFim: null,
      turnos: 0, rng: null, seed: seed || 12345, usos: 0, lacunas: [], eventos: []
    };
  };
  FCT.clienteRng = function (est) { if (!est._r) est._r = rngSemente(est.seed + est.turnos * 977); return est._r; };

  // Verifica se o operador "tratou" a objeção: acolheu/argumentou com conteúdo.
  FCT.tratouObjecao = function (i, texto, objecao, script) {
    if (i.palavras < 6) return false;
    var base = i.empatia || i.beneficio || i.numeros;
    var dica = false;
    if (objecao && objecao.palavrasChave) dica = !!FCT.temAlgum(texto, objecao.palavrasChave);
    return !!(base || dica) && i.palavras >= 8;
  };

  FCT.responderCliente = function (est, textoOp, cenario, script) {
    var i = FCT.intencoes(textoOp, script);
    est.turnos++;
    est._r = rngSemente(est.seed + est.turnos * 977);
    var rng = est._r;
    var falas = FALAS[est.perfil] || FALAS.colaborativo;
    var vars = { assunto: cenario.assunto || 'o serviço', detalhe: cenario.detalhe || 'preciso de uma solução', obj: '' };
    var evento = { turno: est.turnos, intencoes: i, acao: '' };
    var resp = '';

    // 1. Grosseria encerra rápido, qualquer nível
    if (i.grosso) {
      est.paciencia = 0; est.encerrada = true; est.motivoFim = 'grosseria';
      evento.acao = 'encerra_grosseria';
      est.eventos.push(evento);
      return { texto: 'Não admito ser tratado assim. Vou encerrar a ligação.', encerrou: true, motivo: 'grosseria', evento: evento };
    }

    // 2. Respostas muito curtas/vazias gastam paciência
    var vazio = i.palavras < 3;
    if (vazio) { est.paciencia -= 1; }

    // 3. Fases
    if (est.fase === 'abertura') {
      if (i.saudacao || i.apresentacao || i.palavras >= 3) {
        est.fase = 'motivo';
        resp = preencher(escolhe(rng, falas.motivo), vars);
        evento.acao = 'motivo';
        if (!i.apresentacao && est.perfil === 'desconfiado') resp = 'Alô? Quem está falando? Qual o seu nome e de qual empresa?';
      } else {
        resp = 'Alô? Não ouvi direito.';
        evento.acao = 'aguarda_saudacao';
      }
    } else if (est.fase === 'motivo') {
      // operador precisa perguntar/explorar; empatia ajuda
      if (i.pergunta || i.empatia) {
        est.fase = 'conduz';
        est.detalheRevelado = true;
        resp = preencher(escolhe(rng, falas.detalhe), vars);
        evento.acao = 'revela_detalhe';
        if (est.fila.length) { est.objAtual = est.fila.shift(); }
        if (est.objAtual) {
          vars.obj = est.objAtual.texto;
          resp += ' ' + preencher(escolhe(rng, falas.obj), vars);
          evento.acao = 'revela_detalhe_e_objecao';
          evento.objecao = est.objAtual.id;
        }
      } else {
        // operador começou a empurrar sem perguntar
        est.paciencia -= 1;
        resp = escolhe(rng, falas.neutro) + ' Mas você ainda não entendeu o que eu preciso, né?';
        evento.acao = 'pede_exploracao';
        evento.oportunidadePerdida = 'Faltou perguntar o que o cliente precisa antes de oferecer.';
      }
    } else if (est.fase === 'conduz') {
      if (est.objAtual) {
        var tratou = FCT.tratouObjecao(i, textoOp, est.objAtual, script);
        if (tratou) {
          est.objResolvidas++;
          evento.acao = 'objecao_tratada'; evento.objecao = est.objAtual.id;
          est.objAtual = est.fila.length ? est.fila.shift() : null;
          if (est.objAtual) {
            vars.obj = est.objAtual.texto;
            resp = preencher(escolhe(rng, falas.obj), vars);
            evento.acao = 'nova_objecao'; evento.objecao = est.objAtual.id;
          } else {
            est.fase = 'proposta';
            resp = escolhe(rng, falas.neutro) + ' E agora, qual o próximo passo?';
          }
        } else {
          est.paciencia -= 1;
          vars.obj = est.objAtual.texto;
          resp = preencher(escolhe(rng, falas.repete), vars);
          evento.acao = 'repete_objecao'; evento.objecao = est.objAtual.id;
          evento.oportunidadePerdida = 'Objeção não tratada: acolha, esclareça e confirme.';
        }
      } else {
        est.fase = 'proposta';
        resp = escolhe(rng, falas.neutro);
        evento.acao = 'sem_objecao';
      }
    } else if (est.fase === 'proposta') {
      if (i.propor || i.proximo || i.resumo) {
        var tudoOk = est.objResolvidas >= est.objTotal && est.paciencia > 0;
        est.aceitou = tudoOk && !(est.perfil === 'cancelar' && est.nivel >= 4 && est.paciencia < est.pacienciaMax - 3);
        est.fase = 'fechamento';
        resp = preencher(escolhe(rng, est.aceitou ? falas.aceita : falas.recusa), vars);
        evento.acao = est.aceitou ? 'aceita' : 'recusa';
      } else {
        est.paciencia -= vazio ? 0 : 0;
        resp = escolhe(rng, falas.neutro);
        evento.acao = 'aguarda_proposta';
      }
    } else if (est.fase === 'fechamento') {
      if (i.fechar || i.resumo || i.proximo) {
        est.encerrada = true; est.motivoFim = 'fechamento';
        resp = 'Obrigado. Até logo!';
        evento.acao = 'encerra_fechamento';
        est.eventos.push(evento);
        return { texto: resp, encerrou: true, motivo: 'fechamento', evento: evento };
      }
      resp = 'Certo. Era só isso?';
      evento.acao = 'aguarda_encerramento';
    }

    // 4. Paciência esgotada
    if (est.paciencia <= 0 && !est.encerrada) {
      est.encerrada = true; est.motivoFim = 'paciencia';
      evento.acao = 'encerra_paciencia';
      est.eventos.push(evento);
      return { texto: 'Desculpe, mas não estou conseguindo resolver isso. Vou desligar.', encerrou: true, motivo: 'paciencia', evento: evento };
    }

    // 5. Lacunas: cliente pergunta preço/prazo e script não tem a informação
    if (/\b(quanto|valor|preco|custa|mensalidade)\b/.test(FCT.norm(textoOp)) === false && est.fase === 'conduz' && cenario.perguntaValor && !est._perguntouValor && est.turnos >= 3) {
      est._perguntouValor = true;
      resp += ' E qual é o valor disso?';
      evento.acao += '+pergunta_valor';
      if (!script || !script.condicoes || !String(script.condicoes).trim()) {
        est.lacunas.push('O cliente perguntou o valor, mas o script não tem "condições comerciais" cadastradas.');
        evento.lacuna = true;
      }
    }

    est.eventos.push(evento);
    return { texto: resp, encerrou: false, evento: evento };
  };

  /* ============ Avaliador (modo Demonstração: regras + heurísticas) ============ */
  FCT.PESOS_PADRAO = {
    inbound: { script: 0.25, conducao: 0.25, comunicacao: 0.15, voz: 0.10, conformidade: 0.25 },
    outbound: { script: 0.20, conducao: 0.30, comunicacao: 0.15, voz: 0.10, conformidade: 0.25 },
    consultivo: { script: 0.15, conducao: 0.35, comunicacao: 0.15, voz: 0.10, conformidade: 0.25 },
    retencao: { script: 0.15, conducao: 0.35, comunicacao: 0.15, voz: 0.10, conformidade: 0.25 }
  };
  FCT.NOMES_BLOCOS = { script: 'Script e procedimento', conducao: 'Condução do atendimento', comunicacao: 'Comunicação', voz: 'Voz', conformidade: 'Conformidade' };

  function nivelParaNota(n) { return n === 2 ? 100 : n === 1 ? 50 : 0; }
  function mediaNiveis(cs) {
    var ap = cs.filter(function (c) { return c.nivel != null; });
    if (!ap.length) return null;
    return Math.round(FCT.media(ap.map(function (c) { return nivelParaNota(c.nivel); })));
  }

  // transcricao: [{quem:'op'|'cl', texto}], clienteEst: estado final do cliente, voz: {resumo, wpm, vicios...} | null
  FCT.avaliar = function (args) {
    var script = args.script || {}, trans = args.transcricao || [], cliente = args.cliente || null;
    var cfg = args.config || {}, voz = args.voz || null, modo = args.modo || 'texto';
    var opMsgs = trans.filter(function (m) { return m.quem === 'op'; });
    var todoOp = opMsgs.map(function (m) { return m.texto; }).join(' \n ');
    var criticas = [], fortes = [], melhorar = [], perdidas = [], naoCumpridas = [];
    var blocos = [];

    // ---- A. Script (checklist em código) ----
    var etapas = script.etapas || [];
    var critScript = etapas.map(function (e) {
      var kws = e.palavras || [];
      var achou = null, evid = null;
      for (var i = 0; i < opMsgs.length && !achou; i++) {
        var k = FCT.temAlgum(opMsgs[i].texto, kws);
        if (k) { achou = k; evid = opMsgs[i].texto; }
      }
      var nivel = achou ? 2 : 0;
      if (!achou && e.obrigatoria === false) nivel = null; // opcional não cumprida não pesa
      if (!achou && e.obrigatoria !== false) naoCumpridas.push(e.nome);
      return {
        nome: e.nome, nivel: nivel, obrigatoria: e.obrigatoria !== false,
        evidencia: evid ? FCT.trecho(evid) : '',
        motivo: achou ? 'Encontrado: "' + achou + '".' : (e.obrigatoria === false ? 'Etapa opcional não realizada.' : 'Não foi encontrada nenhuma das expressões esperadas para esta etapa.'),
        melhor: achou ? '' : (e.exemplo || 'Inclua esta etapa do script: ' + e.nome + '.'),
        auto: 'codigo'
      };
    });
    var notaScript = mediaNiveis(critScript);
    blocos.push({ id: 'script', nome: FCT.NOMES_BLOCOS.script, nota: notaScript, criterios: critScript, apuracao: 'Checklist em código' });

    // ---- B. Condução ----
    var intens = opMsgs.map(function (m) { return FCT.intencoes(m.texto, script); });
    var nEmpatia = intens.filter(function (x) { return x.empatia; }).length;
    var nPergAb = intens.filter(function (x) { return x.perguntaAberta; }).length;
    var nPerg = intens.filter(function (x) { return x.pergunta; }).length;
    var eventos = cliente ? cliente.eventos : [];
    var objTotal = cliente ? cliente.objTotal : 0, objRes = cliente ? cliente.objResolvidas : 0;
    var evidEmp = null, evidPerg = null;
    opMsgs.forEach(function (m, idx) { if (!evidEmp && intens[idx].empatia) evidEmp = m.texto; if (!evidPerg && intens[idx].perguntaAberta) evidPerg = m.texto; });
    var critCond = [];
    critCond.push({
      nome: 'Escuta ativa e empatia', nivel: nEmpatia >= 2 ? 2 : nEmpatia === 1 ? 1 : 0, evidencia: FCT.trecho(evidEmp || ''),
      motivo: nEmpatia ? 'Usou ' + nEmpatia + ' expressão(ões) de acolhimento.' : 'Nenhuma expressão de acolhimento detectada (ex.: "entendo", "compreendo").',
      melhor: nEmpatia >= 2 ? '' : 'Antes de responder, reconheça o que o cliente disse: "Entendo, isso realmente incomoda. Vou ver como resolver."', auto: 'regras'
    });
    critCond.push({
      nome: 'Descoberta da necessidade', nivel: nPergAb >= 2 ? 2 : (nPerg >= 1 ? 1 : 0), evidencia: FCT.trecho(evidPerg || ''),
      motivo: 'Perguntas abertas: ' + nPergAb + '; perguntas no total: ' + nPerg + '.',
      melhor: nPergAb >= 2 ? '' : 'Use perguntas abertas: "Como isso tem afetado o senhor?" / "O que é mais importante para você nessa escolha?"', auto: 'regras'
    });
    if (objTotal > 0) {
      var nv = objRes >= objTotal ? 2 : objRes > 0 ? 1 : 0;
      critCond.push({
        nome: 'Tratamento de objeções', nivel: nv, evidencia: '',
        motivo: 'Objeções tratadas: ' + objRes + ' de ' + objTotal + '.',
        melhor: nv === 2 ? '' : 'Siga o método: acolher → esclarecer → responder → confirmar ("Isso responde a sua dúvida?").', auto: 'regras'
      });
      if (nv < 2) perdidas.push('Objeção do cliente sem tratamento adequado.');
    }
    var fechou = intens.some(function (x) { return x.propor || x.resumo || x.proximo; });
    var resolvido = cliente ? (cliente.aceitou === true || cliente.motivoFim === 'fechamento') : null;
    critCond.push({
      nome: 'Resolução e próximo passo', nivel: (resolvido && fechou) ? 2 : (fechou ? 1 : 0), evidencia: '',
      motivo: fechou ? (resolvido ? 'Propôs/confirmou o próximo passo e o cliente aceitou.' : 'Propôs o próximo passo, mas o cliente não aceitou.') : 'Não houve proposta nem confirmação de próximo passo.',
      melhor: fechou ? '' : 'Feche com resumo e ação: "Então combinamos X. O próximo passo é Y, em até Z."', auto: 'regras'
    });
    if (cliente && (cliente.motivoFim === 'paciencia')) perdidas.push('O cliente encerrou a ligação por falta de resolução.');
    eventos.forEach(function (e) { if (e.oportunidadePerdida && perdidas.indexOf(e.oportunidadePerdida) < 0) perdidas.push(e.oportunidadePerdida); });
    if (modo === 'leitura') {
      blocos.push({ id: 'conducao', nome: FCT.NOMES_BLOCOS.conducao, nota: null, criterios: [], apuracao: 'Não se aplica na leitura guiada (bloco não pesa na nota)' });
      perdidas = [];
    } else {
      blocos.push({ id: 'conducao', nome: FCT.NOMES_BLOCOS.conducao, nota: mediaNiveis(critCond), criterios: critCond, apuracao: 'Regras de demonstração (IA externa opcional)' });
    }

    // ---- C. Comunicação ----
    var frases = FCT.frases(todoOp), nPal = FCT.contarPalavras(todoOp);
    var mediaFrase = frases.length ? nPal / frases.length : 0;
    var vicios = FCT.contarVicios(todoOp).total;
    var viciosPor100 = nPal ? (vicios / nPal) * 100 : 0;
    var mediaTurno = opMsgs.length ? nPal / opMsgs.length : 0;
    var conectores = FCT.temAlgum(todoOp, ['primeiro', 'depois', 'por fim', 'alem disso', 'por isso', 'entao', 'ou seja', 'por exemplo']);
    var critCom = [
      { nome: 'Clareza (tamanho das frases)', nivel: mediaFrase === 0 ? 0 : mediaFrase <= 20 ? 2 : mediaFrase <= 30 ? 1 : 0, evidencia: '', motivo: 'Média de ' + mediaFrase.toFixed(1) + ' palavras por frase.', melhor: mediaFrase <= 20 ? '' : 'Divida frases longas em ideias curtas, com uma informação por vez.', auto: 'regras' },
      { nome: 'Objetividade', nivel: mediaTurno === 0 ? 0 : (mediaTurno >= 6 && mediaTurno <= 45) ? 2 : (mediaTurno > 45 || mediaTurno >= 3) ? 1 : 0, evidencia: '', motivo: 'Média de ' + mediaTurno.toFixed(1) + ' palavras por fala.', melhor: mediaTurno < 6 ? 'Respostas muito curtas parecem secas; complete com uma explicação breve.' : (mediaTurno > 45 ? 'Respostas longas cansam; vá direto ao ponto e confirme o entendimento.' : ''), auto: 'regras' },
      { nome: 'Vocabulário e vícios de linguagem', nivel: viciosPor100 <= 1 ? 2 : viciosPor100 <= 3 ? 1 : 0, evidencia: '', motivo: vicios + ' vício(s) detectado(s) (' + viciosPor100.toFixed(1) + ' por 100 palavras).', melhor: viciosPor100 <= 1 ? '' : 'Troque "né", "tipo", "aham" por uma pausa curta.', auto: 'regras' },
      { nome: 'Organização das ideias', nivel: conectores ? 2 : (opMsgs.length >= 3 ? 1 : 0), evidencia: '', motivo: conectores ? 'Usou conectores que organizam a fala ("' + conectores + '").' : 'Poucos marcadores de sequência.', melhor: conectores ? '' : 'Use marcadores: "primeiro…, depois…, por fim…".', auto: 'regras' }
    ];
    blocos.push({ id: 'comunicacao', nome: FCT.NOMES_BLOCOS.comunicacao, nota: mediaNiveis(critCom), criterios: critCom, apuracao: 'Regras de demonstração (IA externa opcional)' });

    // ---- D. Voz (só se houve voz) ----
    var faixas = cfg.faixas || FCT.FAIXAS_PADRAO;
    if (voz && voz.resumo && (voz.resumo.duracao || 0) > 3) {
      var r = voz.resumo, critV = [];
      if (voz.wpm) {
        var dentroW = voz.wpm >= faixas.wpm[0] && voz.wpm <= faixas.wpm[1];
        var pertoW = voz.wpm >= faixas.wpm[0] * 0.85 && voz.wpm <= faixas.wpm[1] * 1.15;
        critV.push({ nome: 'Velocidade da fala', nivel: dentroW ? 2 : pertoW ? 1 : 0, evidencia: '', motivo: Math.round(voz.wpm) + ' palavras/min (faixa-alvo da operação: ' + faixas.wpm[0] + '–' + faixas.wpm[1] + ').', melhor: dentroW ? '' : 'Ajuste o ritmo para a faixa-alvo desta operação.', auto: 'audio' });
      }
      critV.push({ nome: 'Pausas', nivel: r.pausasLongas <= (faixas.pausasLongasMax || 3) ? 2 : r.pausasLongas <= (faixas.pausasLongasMax || 3) + 2 ? 1 : 0, evidencia: '', motivo: r.pausas + ' pausa(s); ' + r.pausasLongas + ' longa(s).', melhor: r.pausasLongas <= (faixas.pausasLongasMax || 3) ? '' : 'Reduza pausas longas organizando a resposta antes de falar.', auto: 'audio' });
      critV.push({ nome: 'Vícios de linguagem (fala)', nivel: viciosPor100 <= (faixas.viciosPor100 || 3) ? 2 : 1, evidencia: '', motivo: viciosPor100.toFixed(1) + ' por 100 palavras.', melhor: '', auto: 'audio' });
      blocos.push({ id: 'voz', nome: FCT.NOMES_BLOCOS.voz, nota: mediaNiveis(critV), criterios: critV, apuracao: 'Métricas de áudio vs. faixa-alvo (sem leitura emocional)' });
    } else {
      blocos.push({ id: 'voz', nome: FCT.NOMES_BLOCOS.voz, nota: null, criterios: [], apuracao: 'Sem áudio nesta tentativa (bloco não pesa na nota)' });
    }

    // ---- E. Conformidade ----
    var critConf = [];
    var proib = (script.proibidas || []).filter(Boolean);
    var achouProib = null, evProib = null;
    opMsgs.forEach(function (m) { if (!achouProib) { var k = FCT.temAlgum(m.texto, proib); if (k) { achouProib = k; evProib = m.texto; } } });
    if (achouProib) criticas.push('Expressão proibida pelo script: "' + achouProib + '".');
    critConf.push({ nome: 'Expressões proibidas pelo script', nivel: achouProib ? 0 : 2, critica: !!achouProib, evidencia: FCT.trecho(evProib || ''), motivo: achouProib ? 'Usou "' + achouProib + '".' : 'Nenhuma expressão proibida.', melhor: achouProib ? 'Substitua por uma forma permitida pelo script.' : '', auto: 'codigo' });

    var achouGrosso = null, evGrosso = null;
    opMsgs.forEach(function (m) { if (!achouGrosso) { var k = FCT.temAlgum(m.texto, PAL_GROSSO); if (k) { achouGrosso = k; evGrosso = m.texto; } } });
    if (achouGrosso) criticas.push('Desrespeito ao cliente.');
    critConf.push({ nome: 'Respeito ao cliente', nivel: achouGrosso ? 0 : 2, critica: !!achouGrosso, evidencia: FCT.trecho(evGrosso || ''), motivo: achouGrosso ? 'Linguagem desrespeitosa detectada.' : 'Tratamento respeitoso.', melhor: achouGrosso ? 'Mantenha sempre a cordialidade, mesmo diante de ofensas.' : '', auto: 'codigo' });

    var achouProm = null, evProm = null;
    var permitidas = (script.promessasPermitidas || []);
    opMsgs.forEach(function (m) {
      if (achouProm) return;
      var k = FCT.temAlgum(m.texto, PAL_PROMESSA);
      if (k && !FCT.temAlgum(k, permitidas)) { achouProm = k; evProm = m.texto; }
    });
    if (achouProm) criticas.push('Promessa indevida ("' + achouProm + '").');
    critConf.push({ nome: 'Ausência de promessas indevidas', nivel: achouProm ? 0 : 2, critica: !!achouProm, evidencia: FCT.trecho(evProm || ''), motivo: achouProm ? 'Usou "' + achouProm + '", que cria expectativa que o script não garante.' : 'Sem promessas indevidas.', melhor: achouProm ? 'Prefira: "o procedimento previsto é…" em vez de garantir resultado.' : '', auto: 'regras' });

    var vazou = null;
    opMsgs.forEach(function (m) { if (!vazou && /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(m.texto) && /(cpf|titular)/.test(FCT.norm(m.texto)) && /(seu|do senhor|da senhora|cpf e|cpf:|cpf )/.test(FCT.norm(m.texto))) vazou = m.texto; if (!vazou && /\b(\d{4}[ -]?){3}\d{4}\b/.test(m.texto)) vazou = m.texto; });
    if (vazou) criticas.push('Dado pessoal lido em voz alta/escrito completo.');
    critConf.push({ nome: 'Proteção de dados do cliente', nivel: vazou ? 0 : 2, critica: !!vazou, evidencia: FCT.trecho(vazou || ''), motivo: vazou ? 'Exibiu dado pessoal completo (CPF/cartão). Peça ao cliente que informe, ou confirme apenas os últimos dígitos.' : 'Nenhum dado pessoal completo exposto.', melhor: vazou ? 'Diga: "Pode me confirmar os três últimos dígitos do CPF?"' : '', auto: 'regras' });

    if (script.exigeIdentificacao) {
      var idOk = intens.some(function (x) { return x.identificacao; });
      critConf.push({ nome: 'Confirmação de identidade', nivel: idOk ? 2 : 0, critica: !idOk, evidencia: '', motivo: idOk ? 'Solicitou confirmação de identidade.' : 'O script exige confirmar a identidade antes de tratar dados da conta.', melhor: idOk ? '' : 'Peça: "Para sua segurança, pode confirmar seu nome completo e data de nascimento?"', auto: 'regras' });
      if (!idOk) criticas.push('Não confirmou a identidade do cliente.');
    }
    blocos.push({ id: 'conformidade', nome: FCT.NOMES_BLOCOS.conformidade, nota: mediaNiveis(critConf), criterios: critConf, apuracao: 'Código + regras; falhas críticas reprovam' });

    // ---- Nota final com pesos redistribuídos ----
    var pesos = Object.assign({}, (cfg.pesos || FCT.PESOS_PADRAO[script.modalidade || 'inbound'] || FCT.PESOS_PADRAO.inbound));
    var somaP = 0, somaN = 0;
    blocos.forEach(function (b) { b.peso = pesos[b.id] || 0; if (b.nota != null) { somaP += b.peso; somaN += b.peso * b.nota; } });
    var bruta = somaP ? Math.round(somaN / somaP) : 0;
    var corte = cfg.notaCorte != null ? cfg.notaCorte : 70;
    var nota = criticas.length ? Math.min(bruta, Math.max(0, corte - 1)) : bruta;
    var aprovado = !criticas.length && nota >= corte;

    // ---- Pontos fortes / prioridades (máx. 3) ----
    blocos.forEach(function (b) {
      b.criterios.forEach(function (c) { if (c.nivel === 2 && fortes.length < 3 && b.id !== 'conformidade') fortes.push(c.nome + ': ' + c.motivo); });
    });
    var pend = [];
    blocos.forEach(function (b) { b.criterios.forEach(function (c) { if (c.nivel === 0 || c.nivel === 1) pend.push({ b: b.id, c: c, pri: (c.critica ? 100 : 0) + (c.nivel === 0 ? 20 : 10) + ((pesos[b.id] || 0) * 10) }); }); });
    pend.sort(function (a, b) { return b.pri - a.pri; });
    pend.slice(0, 3).forEach(function (p) { melhorar.push({ criterio: p.c.nome, motivo: p.c.motivo, melhor: p.c.melhor, evidencia: p.c.evidencia }); });
    if (!fortes.length) fortes.push('Você concluiu a simulação — ponto de partida para evoluir.');

    return {
      nota: nota, notaBruta: bruta, aprovado: aprovado, corte: corte, falhasCriticas: criticas,
      blocos: blocos, fortes: fortes, prioridades: melhorar, etapasNaoCumpridas: naoCumpridas, oportunidades: perdidas,
      modoAvaliacao: args.ia ? 'ia' : 'demonstracao', modo: modo,
      estatisticas: { palavrasOp: nPal, falasOp: opMsgs.length, vicios: vicios, mediaFrase: Math.round(mediaFrase * 10) / 10 }
    };
  };

  // Recalcula a nota depois de trocar blocos (ex.: resultado de IA externa). Falhas críticas continuam valendo.
  FCT.recalcular = function (av, pesos, corte) {
    var somaP = 0, somaN = 0;
    av.blocos.forEach(function (b) { b.peso = pesos[b.id] || 0; if (b.nota != null) { somaP += b.peso; somaN += b.peso * b.nota; } });
    av.notaBruta = somaP ? Math.round(somaN / somaP) : 0;
    av.nota = av.falhasCriticas.length ? Math.min(av.notaBruta, Math.max(0, corte - 1)) : av.notaBruta;
    av.aprovado = !av.falhasCriticas.length && av.nota >= corte; av.corte = corte;
    return av;
  };

  /* ============ Diagnóstico e quizzes ============ */
  FCT.corrigirQuiz = function (quiz, respostas) {
    var ac = 0, det = [];
    quiz.forEach(function (q, i) { var ok = respostas[i] === q.correta; if (ok) ac++; det.push({ ok: ok, q: q.p, certa: q.opcoes[q.correta], explica: q.explica }); });
    return { acertos: ac, total: quiz.length, nota: Math.round((ac / quiz.length) * 100), detalhes: det };
  };

  /* ============ Domínio de módulos ============ */
  // tentativas: [{cenarioId, moduloId?, nota, aprovado, quando, falhaCritica}]
  FCT.dominio = function (cenarioIds, tentativas, corte, nSeguidas, agora) {
    nSeguidas = nSeguidas || 3; agora = agora || Date.now();
    var ts = tentativas.filter(function (t) { return cenarioIds.indexOf(t.cenarioId) >= 0 && t.tipo !== 'teste'; }).sort(function (a, b) { return a.quando - b.quando; });
    var seq = 0, melhorSeq = 0, dominadoEm = null;
    ts.forEach(function (t) {
      var ok = !t.falhaCritica && t.nota >= corte;
      seq = ok ? seq + 1 : 0;
      if (seq > melhorSeq) melhorSeq = seq;
      if (seq >= nSeguidas && !dominadoEm) dominadoEm = t.quando;
    });
    var seqAtual = 0;
    for (var i = ts.length - 1; i >= 0; i--) { if (!ts[i].falhaCritica && ts[i].nota >= corte) seqAtual++; else break; }
    var dominado = dominadoEm != null && seqAtual >= 1 || seqAtual >= nSeguidas;
    var revisao = null;
    if (dominado) {
      var ref = dominadoEm || ts[ts.length - 1].quando, d7 = 7 * 864e5, d30 = 30 * 864e5;
      var ult = ts.length ? ts[ts.length - 1].quando : ref;
      var desde = agora - ref;
      if (desde >= d30 && ult < ref + d30) revisao = 'revisao30';
      else if (desde >= d7 && ult < ref + d7) revisao = 'revisao7';
    }
    return { seqAtual: seqAtual, melhorSeq: melhorSeq, necessarias: nSeguidas, dominado: !!dominado, dominadoEm: dominadoEm, revisao: revisao, tentativas: ts.length };
  };

  /* ============ Estatísticas ============ */
  FCT.agruparPorPeriodo = function (tentativas, periodo) {
    var grupos = {};
    tentativas.forEach(function (t) {
      var d = new Date(t.quando), chave;
      if (periodo === 'mes') chave = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      else if (periodo === 'semana') {
        var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate()); dt.setDate(dt.getDate() - dt.getDay());
        chave = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
      } else chave = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      (grupos[chave] = grupos[chave] || []).push(t.nota);
    });
    return Object.keys(grupos).sort().map(function (k) { return { chave: k, media: Math.round(FCT.media(grupos[k])), n: grupos[k].length }; });
  };
  FCT.dataBR = function (ts) {
    var d = new Date(ts); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  };
  FCT.horaBR = function (ts) { var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  FCT.fmtDur = function (s) { s = Math.round(s || 0); var m = Math.floor(s / 60), r = s % 60; return m + ':' + ('0' + r).slice(-2); };

  /* ============ Armazenamento local (versão do esquema) ============ */
  FCT.ESQUEMA = 1;
  FCT.estadoVazio = function () {
    return {
      esquema: FCT.ESQUEMA, criadoEm: Date.now(), perfil: 'operador',
      usuario: { nome: '', onboarding: false },
      consentimento: { voz: false, em: null },
      config: { espelho: false, alertas: true, guardarMetricas: true, larg: { wpm: 0.25, db: 6, f0: 0.2, pausa: 0.5 }, pontoAtencao: ['wpm', 'f0'], metaZona: 0.8, notaCorte: 70, nSeguidas: 3, falar: true, aiEndpoint: '', aiAtivo: false, faixas: { wpm: [110, 170], pausasLongasMax: 3, viciosPor100: 3 } },
      base: null, scripts: [], cenarios: [], testes: [], tentativas: [], modulos: {}, diagnostico: null, logAcesso: [], revisoes: []
    };
  };
  FCT.migrar = function (e) {
    if (!e || typeof e !== 'object') return FCT.estadoVazio();
    var v = FCT.estadoVazio();
    Object.keys(v).forEach(function (k) { if (e[k] === undefined) e[k] = v[k]; });
    Object.keys(v.config).forEach(function (k) { if (e.config[k] === undefined) e.config[k] = v.config[k]; });
    e.esquema = FCT.ESQUEMA;
    return e;
  };
  FCT.validarBackup = function (obj) {
    if (!obj || typeof obj !== 'object') return 'Arquivo inválido.';
    if (obj.app !== 'fenix-call-trainer') return 'Este arquivo não é um backup do Fênix Call Trainer.';
    if (!obj.dados || typeof obj.dados !== 'object') return 'Backup sem dados.';
    if (!Array.isArray(obj.dados.scripts) || !Array.isArray(obj.dados.tentativas)) return 'Backup incompleto.';
    return null;
  };

  /* Visão do instrutor: NUNCA inclui espelho, sentimento ou dados privados. */
  FCT.visaoInstrutor = function (tentativa) {
    var c = JSON.parse(JSON.stringify(tentativa));
    delete c.privado; delete c.sentimento; delete c.espelho; delete c.voz;
    // métricas vocais nunca chegam ao instrutor/recrutador (nem como bloco da avaliação)
    if (c.avaliacao && Array.isArray(c.avaliacao.blocos)) c.avaliacao.blocos = c.avaliacao.blocos.filter(function (b) { return b.id !== 'voz'; });
    return c;
  };

  /* Sanitiza texto do usuário antes de injetar em HTML */
  FCT.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FCT;
  root.FCT = FCT;
})(typeof window !== 'undefined' ? window : globalThis);
