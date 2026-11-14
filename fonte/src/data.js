/* Conteúdo inicial do Fênix Call Trainer: scripts-modelo, cenários-modelo, trilha base e diagnóstico.
   Tudo aqui é MODELO EDITÁVEL — empresa, produto e condições são fictícios e não representam dados reais. */
(function (root) {
  'use strict';
  var D = {};

  D.OPERACOES = [
    { id: 'inbound', nome: 'Receptivo (SAC, suporte, informações)' },
    { id: 'outbound', nome: 'Ativo (vendas, cobrança, pesquisa)' },
    { id: 'consultivo', nome: 'Consultivo (diagnóstico e negociação)' },
    { id: 'retencao', nome: 'Retenção e relacionamento' }
  ];

  function etapa(id, nome, palavras, exemplo, obrig) { return { id: id, nome: nome, palavras: palavras, exemplo: exemplo, obrigatoria: obrig !== false }; }

  var SAUD = etapa('saud', 'Saudação', ['bom dia', 'boa tarde', 'boa noite', 'ola'], 'Comece com: "Bom dia! Você está falando com a Empresa Modelo."');
  var APRES = etapa('apres', 'Apresentação do operador', ['meu nome', 'me chamo', 'aqui e', 'sou o', 'sou a'], 'Apresente-se: "Meu nome é Ana, vou te ajudar hoje."');
  var ENCER = etapa('encer', 'Encerramento', ['mais alguma duvida', 'posso ajudar em mais', 'mais alguma coisa', 'tenha um otimo', 'tenha uma otima', 'obrigado por ligar', 'obrigada por ligar', 'agradeco o contato', 'foi um prazer'], 'Encerre com: "Posso ajudar em mais alguma coisa? Obrigado por ligar, tenha um ótimo dia!"');
  var ID = etapa('id', 'Confirmação de identidade', ['confirmar', 'confirma', 'cpf', 'data de nascimento', 'nome completo'], 'Peça: "Para sua segurança, pode confirmar seu nome completo e data de nascimento?"');
  var NECES = etapa('neces', 'Identificação da necessidade', ['como posso ajudar', 'o que voce precisa', 'qual o motivo', 'em que posso', 'me conte', 'qual a sua duvida', 'qual e a sua duvida', 'o que aconteceu', 'como isso'], 'Pergunte: "Em que posso te ajudar hoje?" e deixe o cliente explicar.');

  D.scripts = [
    {
      id: 'sc_sac', modelo: true, nome: 'SAC — Dúvida sobre fatura', empresa: 'Empresa Modelo', modalidade: 'inbound', tipo: 'flexivel',
      produto: 'Plano Internet Modelo', objetivo: 'Esclarecer a fatura e resolver a dúvida na primeira ligação.', publico: 'Cliente atual com dúvida sobre cobrança.',
      etapas: [SAUD, APRES, ID, NECES,
        etapa('expl', 'Explicação da fatura', ['fatura', 'cobranca', 'valor', 'vencimento', 'lancamento', 'periodo'], 'Explique cada item da fatura de forma simples, um por vez.'),
        etapa('conf', 'Confirmação de entendimento', ['ficou claro', 'faz sentido', 'entendeu', 'tudo certo', 'ficou alguma duvida', 'isso responde'], 'Pergunte: "Isso responde a sua dúvida?"'),
        ENCER],
      perguntas: 'Qual item da fatura gerou dúvida? Desde quando percebeu?',
      argumentos: 'A fatura mostra mensalidade, serviços adicionais e proporcional do primeiro mês.',
      objecoes: [{ objecao: 'Acho que fui cobrado a mais', resposta: 'Acolher, mostrar o item e, se houver erro, abrir contestação.' }],
      faq: 'Segunda via: disponível no aplicativo e por e-mail.',
      condicoes: 'Contestação: análise em até 5 dias úteis. (modelo editável)',
      proibidas: ['nao e problema meu', 'ja falei', 'nao tem o que fazer'], promessasPermitidas: [], exigeIdentificacao: true,
      encerramento: 'Resumir o que foi resolvido e perguntar se há mais alguma dúvida.', orientacoes: 'Evite jargão técnico.',
      versao: 1, arquivado: false, historico: []
    },
    {
      id: 'sc_vendas', modelo: true, nome: 'Vendas ativas — Oferta de plano', empresa: 'Empresa Modelo', modalidade: 'outbound', tipo: 'consultivo',
      produto: 'Plano Internet Modelo 300 Mega', objetivo: 'Entender a necessidade e apresentar o plano adequado.', publico: 'Cliente da base com interesse em melhorar a velocidade.',
      etapas: [SAUD, APRES, NECES,
        etapa('benef', 'Apresentação de benefícios', ['beneficio', 'vantagem', 'inclui', 'voce ganha', 'mais velocidade', 'estabilidade', 'desconto'], 'Conecte o benefício à necessidade que o cliente contou.'),
        etapa('valor', 'Condições comerciais', ['por mes', 'mensal', 'reais', 'r$', 'valor', 'fidelidade', 'sem fidelidade'], 'Informe o valor e as condições com clareza (conforme o script).'),
        etapa('fecha', 'Proposta de fechamento', ['posso fechar', 'vamos fechar', 'podemos seguir', 'quer contratar', 'quer aderir', 'posso registrar', 'posso agendar', 'fechamos'], 'Pergunte: "Posso registrar a contratação para você?"'),
        ENCER],
      perguntas: 'Quantas pessoas usam a internet? Para que usam mais? O que mais incomoda hoje?',
      argumentos: 'Mais velocidade para vários dispositivos; Wi-Fi estável; instalação agendada.',
      objecoes: [{ objecao: 'Está caro', resposta: 'Argumento de valor: comparar custo por benefício.' }, { objecao: 'Já tenho outro provedor', resposta: 'Perguntar o que falta no atual e conectar ao plano.' }],
      faq: 'Instalação: em até 3 dias úteis. (modelo editável)',
      condicoes: 'Plano 300 Mega: R$ 99,90 por mês, sem taxa de adesão, fidelidade de 12 meses. (valores fictícios, modelo editável)',
      proibidas: ['sem nenhum custo escondido', 'ninguem reclama'], promessasPermitidas: [], exigeIdentificacao: false,
      encerramento: 'Resumir a contratação e o prazo de instalação.', orientacoes: 'Não pressione; faça perguntas antes de oferecer.',
      versao: 1, arquivado: false, historico: []
    },
    {
      id: 'sc_ret', modelo: true, nome: 'Retenção — Pedido de cancelamento', empresa: 'Empresa Modelo', modalidade: 'retencao', tipo: 'consultivo',
      produto: 'Plano Internet Modelo', objetivo: 'Entender o motivo e oferecer alternativa antes de cancelar.', publico: 'Cliente que pediu cancelamento.',
      etapas: [SAUD, APRES, ID,
        etapa('motivo', 'Descoberta do motivo', ['qual o motivo', 'o que aconteceu', 'por que', 'me conte', 'o que levou', 'o que motivou'], 'Pergunte com empatia: "O que levou o senhor a pensar em cancelar?"'),
        etapa('alt', 'Oferta de alternativa', ['alternativa', 'posso oferecer', 'proposta', 'desconto', 'trocar de plano', 'ajustar o plano', 'visita tecnica'], 'Ofereça uma alternativa ligada ao motivo contado.'),
        etapa('proc', 'Procedimento se mantiver o pedido', ['procedimento', 'protocolo', 'cancelamento', 'prazo'], 'Se o cliente mantiver, informe protocolo e prazo do cancelamento.'),
        ENCER],
      perguntas: 'Qual o motivo? Há quanto tempo tem o problema?',
      argumentos: 'Alternativas: ajuste de plano, desconto temporário, visita técnica gratuita.',
      objecoes: [{ objecao: 'Já decidi cancelar', resposta: 'Respeitar, mas ouvir o motivo e apresentar uma alternativa.' }],
      faq: 'Cancelamento: protocolo gerado na hora; efeito em até 3 dias úteis. (modelo editável)',
      condicoes: 'Desconto de retenção: até 20% por 6 meses, sujeito à análise. (valores fictícios, modelo editável)',
      proibidas: ['nao tem como cancelar', 'voce nao pode cancelar'], promessasPermitidas: [], exigeIdentificacao: true,
      encerramento: 'Confirmar a decisão e o protocolo.', orientacoes: 'O cliente tem direito ao cancelamento; nunca dificultar.',
      versao: 1, arquivado: false, historico: []
    },
    {
      id: 'sc_cob', modelo: true, nome: 'Cobrança — Renegociação', empresa: 'Empresa Modelo', modalidade: 'outbound', tipo: 'flexivel',
      produto: 'Renegociação de fatura em atraso', objetivo: 'Combinar uma forma de pagamento viável.', publico: 'Cliente com fatura em atraso.',
      etapas: [SAUD, APRES, ID,
        etapa('situ', 'Entender a situação', ['o que aconteceu', 'como esta', 'entendo', 'me conte', 'qual a dificuldade', 'o que impediu'], 'Pergunte sem julgar: "Pode me contar o que aconteceu com esse pagamento?"'),
        etapa('opc', 'Apresentar opções de pagamento', ['parcel', 'a vista', 'entrada', 'opcao', 'vencimento', 'segunda via'], 'Apresente duas opções de pagamento.'),
        etapa('comb', 'Combinar data e valor', ['dia', 'data', 'combinado', 'ficou combinado', 'entao combinamos', 'confirmar'], 'Resuma: "Então combinamos pagar R$ X no dia Y."'),
        ENCER],
      perguntas: 'Qual a dificuldade? Qual data seria possível?',
      argumentos: 'Evitar restrição de crédito e encargos maiores.', objecoes: [{ objecao: 'Não tenho como pagar agora' , resposta: 'Oferecer parcelamento e data mais adequada.'}],
      faq: 'Segunda via do boleto por e-mail. (modelo editável)',
      condicoes: 'Parcelamento em até 3 vezes, sem juros adicionais. (valores fictícios, modelo editável)',
      proibidas: ['vou colocar seu nome no spc agora', 'voce vai ser preso', 'vai perder tudo'], promessasPermitidas: [], exigeIdentificacao: true,
      encerramento: 'Resumir o acordo e a data.', orientacoes: 'Nunca ameaçar ou constranger o cliente.',
      versao: 1, arquivado: false, historico: []
    },
    {
      id: 'sc_sup', modelo: true, nome: 'Suporte técnico — Internet lenta', empresa: 'Empresa Modelo', modalidade: 'inbound', tipo: 'rigido',
      produto: 'Plano Internet Modelo', objetivo: 'Diagnosticar e resolver a lentidão.', publico: 'Cliente que não conhece termos técnicos.',
      etapas: [SAUD, APRES, ID,
        etapa('diag', 'Perguntas de diagnóstico', ['desde quando', 'em quais aparelhos', 'wi-fi', 'wifi', 'cabo', 'reiniciou', 'roteador', 'modem'], 'Pergunte desde quando ocorre, em quais aparelhos e se já reiniciou o roteador.'),
        etapa('guia', 'Orientação passo a passo', ['primeiro', 'depois', 'agora', 'vou pedir', 'desligue', 'religue', 'aguarde'], 'Guie em passos curtos: "Primeiro, desligue o roteador da tomada…"'),
        etapa('teste', 'Confirmar se resolveu', ['funcionou', 'melhorou', 'resolveu', 'testar', 'teste'], 'Pergunte: "Pode testar agora e me dizer se melhorou?"'),
        ENCER],
      perguntas: 'Desde quando? Quais aparelhos? Já reiniciou o roteador?',
      argumentos: 'Explicar termos de forma simples.', objecoes: [], faq: 'Visita técnica: agendamento em até 2 dias úteis. (modelo editável)',
      condicoes: 'Visita técnica sem custo quando o problema for da rede. (modelo editável)',
      proibidas: ['isso e simples', 'e so ler o manual'], promessasPermitidas: [], exigeIdentificacao: true,
      encerramento: 'Confirmar a solução e informar o protocolo.', orientacoes: 'Evite jargão; um passo por vez.',
      versao: 1, arquivado: false, historico: []
    }
  ];

  function obj(id, t, k) { return { id: id, texto: t, palavrasChave: k || [] }; }

  D.cenarios = [
    { id: 'cn1', modelo: true, nome: 'Dúvida na fatura — cliente colaborativo', scriptId: 'sc_sac', modalidade: 'inbound', perfil: 'colaborativo', nivel: 1, assunto: 'a minha fatura deste mês', detalhe: 'veio um valor maior que o de costume e eu não entendi o motivo.', objecoes: [obj('o1', 'não sei se isso é normal, nunca vi esse item antes', ['item', 'lancamento', 'proporcional'])], perguntaValor: false, moduloId: 'm1' },
    { id: 'cn2', modelo: true, nome: 'Dúvida na fatura — cliente apressado', scriptId: 'sc_sac', modalidade: 'inbound', perfil: 'apressado', nivel: 2, assunto: 'a cobrança estranha na fatura', detalhe: 'tem um item que eu não reconheço e preciso resolver agora.', objecoes: [obj('o1', 'tem um valor que eu não reconheço e preciso de uma resposta objetiva', ['valor', 'item', 'fatura']), obj('o2', 'e se for cobrança errada, quando isso volta pra mim?', ['dias', 'prazo', 'estorno', 'contestacao'])], perguntaValor: false, moduloId: 'm2' },
    { id: 'cn3', modelo: true, nome: 'Oferta de plano — cliente desconfiado', scriptId: 'sc_vendas', modalidade: 'outbound', perfil: 'desconfiado', nivel: 2, assunto: 'uma oferta de internet', detalhe: 'já tive problema com promessa de outra empresa.', objecoes: [obj('o1', 'como eu sei que não vai ter cobrança escondida depois?', ['claro', 'transparente', 'valor', 'contrato', 'por escrito']), obj('o2', 'e se eu quiser sair, como funciona?', ['cancelamento', 'fidelidade', 'prazo'])], perguntaValor: true, moduloId: 'm5' },
    { id: 'cn4', modelo: true, nome: 'Oferta de plano — cliente indeciso', scriptId: 'sc_vendas', modalidade: 'outbound', perfil: 'indeciso', nivel: 3, assunto: 'um plano de internet mais rápido', detalhe: 'a internet às vezes trava na hora das chamadas de vídeo.', objecoes: [obj('o1', 'não sei se preciso de tanta velocidade', ['velocidade', 'aparelhos', 'chamadas', 'beneficio']), obj('o2', 'acho que está caro para o que uso', ['valor', 'custo', 'beneficio', 'economia']), obj('o3', 'preciso falar com a minha família antes', ['claro', 'sem pressa', 'retorno', 'prazo'])], perguntaValor: true, moduloId: 'm2' },
    { id: 'cn5', modelo: true, nome: 'Oferta de plano — compara com a concorrência', scriptId: 'sc_vendas', modalidade: 'consultivo', perfil: 'concorrente', nivel: 3, assunto: 'trocar de provedor', detalhe: 'um plano com preço menor e instalação grátis.', objecoes: [obj('o1', 'o preço deles é menor', ['valor', 'beneficio', 'diferenca', 'suporte']), obj('o2', 'eles instalam mais rápido', ['instalacao', 'prazo', 'agendar']), obj('o3', 'ouvi dizer que vocês caem muito', ['estabilidade', 'suporte', 'garantia', 'atendimento'])], perguntaValor: true, moduloId: 'm5' },
    { id: 'cn6', modelo: true, nome: 'Pedido de cancelamento', scriptId: 'sc_ret', modalidade: 'retencao', perfil: 'cancelar', nivel: 3, assunto: 'o meu plano', detalhe: 'a internet cai toda semana e já liguei três vezes.', objecoes: [obj('o1', 'já liguei várias vezes e ninguém resolveu', ['entendo', 'desculp', 'lamento', 'visita', 'resolver']), obj('o2', 'por que eu continuaria pagando por um serviço ruim?', ['desconto', 'alternativa', 'visita tecnica', 'ajuste'])], perguntaValor: false, moduloId: 'm7' },
    { id: 'cn7', modelo: true, nome: 'Cobrança — cliente irritado', scriptId: 'sc_cob', modalidade: 'outbound', perfil: 'irritado', nivel: 4, assunto: 'essa ligação de cobrança', detalhe: 'eu já paguei e vocês continuam me ligando.', objecoes: [obj('o1', 'eu já paguei, isso é perseguição', ['entendo', 'desculp', 'verificar', 'comprovante']), obj('o2', 'vou reclamar no órgão de defesa do consumidor', ['entendo', 'direito', 'protocolo', 'verificar']), obj('o3', 'não vou passar dado nenhum por telefone', ['seguranca', 'confirmar', 'sua protecao', 'ultimos']), obj('o4', 'quero falar com o seu supervisor', ['posso', 'registrar', 'resolver', 'supervisor'])], perguntaValor: false, moduloId: 'm10' },
    { id: 'cn8', modelo: true, nome: 'Internet lenta — cliente que não conhece termos técnicos', scriptId: 'sc_sup', modalidade: 'inbound', perfil: 'desconhece', nivel: 1, assunto: 'a internet que está lenta', detalhe: 'as páginas demoram muito para abrir, mas não sei explicar o porquê.', objecoes: [obj('o1', 'o que é esse roteador que você falou?', ['aparelho', 'caixinha', 'wi-fi', 'wifi', 'sinal'])], perguntaValor: false, moduloId: 'm4' }
  ];

  /* ============ Trilha base ============ */
  function q(p, ops, c, ex) { return { p: p, opcoes: ops, correta: c, explica: ex }; }

  D.modulos = [
    {
      id: 'm1', titulo: 'Abertura e identificação', minutos: 3,
      pontos: ['Cumprimente com bom dia/boa tarde/boa noite e diga o nome da empresa.', 'Diga seu nome logo no início.', 'Confirme com quem fala antes de tratar dados da conta.', 'Fale devagar nos primeiros segundos: é a primeira impressão.'],
      bom: '"Boa tarde! Você ligou para a Empresa Modelo, meu nome é Ana. Com quem eu falo?"', ruim: '"Alô, pode falar." (sem empresa, sem nome, sem saudação)',
      quiz: [q('Qual é a melhor abertura?', ['"Alô, fala."', '"Boa tarde! Empresa Modelo, meu nome é Ana. Com quem falo?"', '"Oi, tudo bem? Qual o seu problema?"'], 1, 'Saudação + empresa + nome + pergunta ao cliente.'), q('Quando confirmar a identidade do cliente?', ['Só no final', 'Antes de falar de dados da conta', 'Nunca, atrapalha a ligação'], 1, 'A confirmação protege o cliente e vem antes de tratar dados.')],
      cenarioIds: ['cn1']
    },
    {
      id: 'm2', titulo: 'Escuta ativa e perguntas', minutos: 4,
      pontos: ['Deixe o cliente terminar de falar antes de responder.', 'Pergunta aberta (como, o que, qual) abre a conversa; pergunta fechada confirma.', 'Repita com suas palavras o que entendeu.', 'Anote os pontos que o cliente destacou e volte a eles na proposta.'],
      bom: '"Entendi: a internet trava nas chamadas de vídeo. Como isso tem atrapalhado o seu trabalho?"', ruim: '"Já sei o que é. Vou te oferecer o plano melhor." (sem ouvir)',
      quiz: [q('Qual é uma pergunta aberta?', ['"Está funcionando?"', '"O que mais incomoda na sua internet hoje?"', '"Você é o titular?"'], 1, 'Perguntas abertas pedem explicação e revelam a necessidade.'), q('O que fazer após ouvir o cliente?', ['Oferecer logo o produto', 'Resumir o que entendeu e confirmar', 'Mudar de assunto'], 1, 'Resumir mostra que você ouviu e evita erros.')],
      cenarioIds: ['cn2', 'cn4']
    },
    {
      id: 'm3', titulo: 'Empatia e linguagem positiva', minutos: 3,
      pontos: ['Reconheça o sentimento antes de explicar ("entendo", "compreendo").', 'Troque "não posso" por "o que eu posso fazer é…".', 'Evite "mas": prefira "e".', 'Peça desculpas pela situação, sem culpar o cliente.'],
      bom: '"Entendo, isso realmente incomoda. O que eu posso fazer agora é abrir uma visita técnica."', ruim: '"Isso não é comigo. Não tem o que fazer."',
      quiz: [q('Qual frase usa linguagem positiva?', ['"Não tem como fazer isso."', '"O que eu posso fazer agora é agendar a visita."', '"Já falei que não dá."'], 1, 'Foque no que é possível.'), q('Antes de explicar uma regra a um cliente chateado, o melhor é:', ['Citar a regra', 'Reconhecer o que ele sente', 'Transferir a ligação'], 1, 'Acolher primeiro reduz a tensão.')],
      cenarioIds: ['cn6']
    },
    {
      id: 'm4', titulo: 'Clareza ao telefone', minutos: 3,
      pontos: ['Frases curtas: uma ideia por vez.', 'Troque termos técnicos por palavras simples.', 'Faça pausas curtas depois de informações importantes.', 'Evite vícios como "né", "tipo", "aham".'],
      bom: '"Primeiro, desligue o aparelho da tomada. Depois, espere dez segundos. Por fim, ligue de novo."', ruim: '"Aí, tipo, você faz um reset no roteador, né, e verifica o DNS."',
      quiz: [q('Para o cliente que não conhece termos técnicos, o melhor é:', ['Usar a sigla correta', 'Explicar com palavras simples e exemplos', 'Falar mais rápido'], 1, 'Linguagem simples evita retrabalho.'), q('Pausas curtas ajudam porque:', ['Atrasam a ligação', 'Dão tempo de o cliente absorver', 'Escondem erros'], 1, 'Pausas melhoram a compreensão.')],
      cenarioIds: ['cn8']
    },
    {
      id: 'm5', titulo: 'Tratamento de objeções', minutos: 4,
      pontos: ['Método: acolher → esclarecer → responder → confirmar.', 'Objeção é pedido de informação, não ataque.', 'Responda com benefício ligado ao que o cliente contou.', 'Confirme: "Isso responde a sua dúvida?"'],
      bom: '"Entendo a preocupação com o preço. Vamos olhar o que você ganha: mais velocidade para as chamadas. Isso responde sua dúvida?"', ruim: '"Mas é o preço que temos. Quer ou não quer?"',
      quiz: [q('Qual a primeira etapa ao receber uma objeção?', ['Contra-argumentar', 'Acolher', 'Oferecer desconto'], 1, 'Acolher mostra respeito e baixa a resistência.'), q('Depois de responder, você deve:', ['Mudar de assunto', 'Confirmar se a dúvida foi resolvida', 'Falar mais rápido'], 1, 'Confirmar evita objeções repetidas.')],
      cenarioIds: ['cn3', 'cn5']
    },
    {
      id: 'm6', titulo: 'Condução e tempo da ligação', minutos: 3,
      pontos: ['Tenha começo, meio e fim: abertura, exploração, solução, encerramento.', 'Retome o objetivo quando a conversa se dispersar.', 'Avise quando precisar consultar algo e quanto vai demorar.', 'Use resumos para fechar blocos da conversa.'],
      bom: '"Então, resumindo: vou registrar o ajuste e você recebe a confirmação em até dois dias."', ruim: '(silêncio longo sem avisar o cliente)',
      quiz: [q('Se precisar consultar um sistema:', ['Ficar em silêncio', 'Avisar o cliente e informar o tempo', 'Desligar'], 1, 'Avisar evita a sensação de abandono.'), q('Um bom resumo no meio da ligação serve para:', ['Ganhar tempo sem falar', 'Alinhar entendimento e conduzir ao próximo passo', 'Encerrar rápido'], 1, 'Resumos alinham e conduzem.')],
      cenarioIds: ['cn2']
    },
    {
      id: 'm7', titulo: 'Situações difíceis', minutos: 4,
      pontos: ['Cliente irritado: deixe falar, acolha, só então proponha solução.', 'Silêncio: espere 3 segundos antes de perguntar de novo.', 'Interrupções: peça licença e retome com calma.', 'Pedido de cancelamento: ouça o motivo, ofereça alternativa uma vez, respeite a decisão.'],
      bom: '"Entendo a sua frustração, já ligou três vezes. Vou resolver isso agora com a visita técnica."', ruim: '"Calma, senhor." (gera mais irritação)',
      quiz: [q('Diante de um cliente irritado, o primeiro passo é:', ['Explicar a política', 'Deixar falar e acolher', 'Transferir'], 1, 'Acolher antes de explicar.'), q('Cliente decidiu cancelar mesmo após a alternativa:', ['Insistir várias vezes', 'Respeitar e seguir o procedimento', 'Dizer que não dá para cancelar'], 1, 'O cliente tem direito de cancelar; nunca dificulte.')],
      cenarioIds: ['cn6']
    },
    {
      id: 'm8', titulo: 'Conformidade e proteção de dados', minutos: 4,
      pontos: ['Não prometa o que o script não garante (evite "garanto", "100%").', 'Confirme a identidade antes de tratar dados da conta.', 'Não leia dados completos do cliente em voz alta; confirme só os últimos dígitos.', 'Siga as regras do SAC aplicáveis à sua empresa (confira com o jurídico) e registre o atendimento.'],
      bom: '"Para sua segurança, pode me confirmar os três últimos dígitos do CPF?"', ruim: '"Seu CPF é 123.456.789-00, certo? Garanto que resolve."',
      quiz: [q('Qual frase é uma promessa indevida?', ['"O prazo previsto é de 5 dias úteis."', '"Garanto que isso nunca mais vai acontecer."', '"Vou registrar o seu pedido."'], 1, 'Evite garantias que você não controla.'), q('Para confirmar o CPF, o melhor é:', ['Ler o CPF completo ao cliente', 'Pedir ao cliente que confirme os últimos dígitos', 'Não confirmar'], 1, 'Evita expor o dado.')],
      cenarioIds: ['cn1', 'cn7']
    },
    {
      id: 'm9', titulo: 'Encerramento', minutos: 2,
      pontos: ['Resuma o que foi resolvido.', 'Informe o próximo passo e o prazo.', 'Pergunte se há mais alguma dúvida.', 'Despeça-se com cordialidade.'],
      bom: '"Então ficou combinado o ajuste. Posso ajudar em mais alguma coisa? Obrigada por ligar, tenha um ótimo dia!"', ruim: '"Tá, é isso. Tchau."',
      quiz: [q('O que não pode faltar no encerramento?', ['Resumo, próximo passo e pergunta final', 'Só "tchau"', 'Nova oferta'], 0, 'Resumo, próximo passo e pergunta final dão segurança ao cliente.')],
      cenarioIds: ['cn1', 'cn8']
    },
    {
      id: 'm10', titulo: 'Controle sob pressão', minutos: 4,
      pontos: ['Quando estamos tensos, a fala tende a acelerar e o tom a subir: perceba os sinais do seu corpo.', 'Respire fundo pelo nariz e solte devagar antes de responder.', 'Faça uma pausa deliberada de 1 a 2 segundos antes de objeções difíceis.', 'Se perder o fio, recomece a frase com calma: "Deixa eu organizar: …".', 'Treine as situações difíceis em dificuldade crescente.'],
      bom: '(pausa) "Entendo. Deixe-me organizar o que posso fazer agora por você."', ruim: '(fala acelerada, sem pausas, voz mais alta)',
      quiz: [q('Uma técnica simples para recuperar o controle durante a ligação é:', ['Falar mais rápido para acabar logo', 'Pausa curta com respiração antes de responder', 'Interromper o cliente'], 1, 'Pausa e respiração ajudam o ritmo e o raciocínio.'), q('Se perder o fio da conversa:', ['Fingir que entendeu', 'Recomeçar a frase com calma', 'Desligar'], 1, 'Recomeçar com calma é normal e profissional.')],
      cenarioIds: ['cn7', 'cn6']
    }
  ];

  D.diagnostico = [
    q('Qual abertura é mais adequada?', ['"Alô?"', '"Boa tarde, Empresa Modelo, meu nome é Ana. Como posso ajudar?"', '"Oi, quem é?"'], 1, 'Saudação, empresa, nome e oferta de ajuda.'),
    q('Um cliente irritado diz que já ligou três vezes. O melhor é:', ['Explicar a política da empresa', 'Reconhecer o incômodo e dizer o que vai fazer', 'Pedir para ligar de novo'], 1, 'Acolher e propor ação concreta.'),
    q('O cliente diz "está caro". O que fazer primeiro?', ['Dar desconto', 'Acolher e entender o que ele compara', 'Dizer que é o preço'], 1, 'Entenda a objeção antes de responder.'),
    q('Qual frase é promessa indevida?', ['"Vou registrar o pedido."', '"Garanto 100% que isso resolve."', '"O prazo previsto é de 3 dias."'], 1, 'Evite garantias que você não controla.'),
    q('Qual é uma pergunta aberta?', ['"Você está me ouvindo?"', '"O que mais importa para você nessa escolha?"', '"Posso continuar?"'], 1, 'Perguntas abertas pedem explicação.'),
    q('Ao final da ligação, o ideal é:', ['Desligar assim que resolver', 'Resumir, informar o próximo passo e perguntar se há mais dúvidas', 'Oferecer outro produto'], 1, 'Resumo + próximo passo + pergunta final.')
  ];

  D.TEXTO_BASE = 'Boa tarde. Eu gostaria de ler este texto com calma e naturalidade para que o aplicativo conheça o meu ritmo normal de fala. Vou falar sem pressa, respirar entre as frases e manter o meu volume de voz confortável. Assim, nas próximas simulações, poderei comparar o meu jeito de falar com o meu próprio padrão e perceber quando eu acelerar, subir o tom ou falar baixo demais.';

  root.FCT_DATA = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
