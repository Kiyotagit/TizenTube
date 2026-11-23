// TizenTube TV (fork): entra sozinho na conta padrão quando a tela
// "Quem está assistindo?" aparece ao abrir o app.
//
// Como funciona
// - A conta padrão é aprendida na TV: na primeira vez que a tela de contas aparece
//   ao abrir, a pessoa escolhe a conta com o controle e o nome dela fica guardado na
//   configuração do TizenTube (localStorage da TV). Nenhum nome fica no código.
// - Com a conta aprendida, a tela de contas é forçada a aparecer em toda abertura e
//   este módulo anda até a conta certa e confirma. Assim o app sempre abre nela,
//   mesmo que outra pessoa tenha usado outra conta na última vez.
// - Só age logo depois de abrir ou de voltar ao app, e nunca depois que alguém apertou
//   uma tecla: quem abrir a troca de contas pela foto do canto escolhe à vontade.
// - Se a escolha automática falhar FALHAS_MAX vezes seguidas, para de forçar a tela
//   (volta ao jeito normal do TizenTube, que tenta escondê-la).
//
// A tela de contas do YouTube TV é <ytlr-account-selector>, com um <ytlr-carousel-account>
// por conta numa fileira horizontal (lido no código do YouTube TV em 23/11/2026).

import { configRead, configWrite, configChangeEmitter } from '../config.js';
import { showToast } from '../ui/ytUI.js';

const CHAVE_ACOES = 'yt.leanback.default::recurring_actions';
const ACAO_SELETOR = 'startup-screen-account-selector-with-guest';
const ACOES_ESCONDER = ['whos_watching_fullscreen_zero_accounts', 'startup-screen-signed-out-welcome-back'];
const FALHAS_MAX = 2;
const JANELA_ABERTURA_MS = 90 * 1000;
const JANELA_VOLTA_MS = 60 * 1000;

const LOG = '[TizenTube TV]';
let armadoAte = Date.now() + JANELA_ABERTURA_MS;
let ocupado = false;
let seletorDaAbertura = false;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const armado = () => Date.now() < armadoAte;
const normalizar = (t) => (t || '').replace(/\s+/g, ' ').trim();
const comparavel = (t) => normalizar(t).toLowerCase();

function forcarSeletor() {
    return configRead('contaPadraoAtiva') && configRead('contaPadraoFalhas') < FALHAS_MAX;
}

// Ajusta as "ações recorrentes" do YouTube: as telas de boas-vindas ficam escondidas
// (como o TizenTube já faz) e a de contas fica sempre "vencida" quando a conta padrão
// está ligada, para aparecer em toda abertura.
function ajustarAcoes(dados) {
    const d = dados && dados.data && dados.data.data;
    if (!d) return dados;
    const futuro = Date.now() + 7 * 24 * 60 * 60 * 1000;
    for (const k of ACOES_ESCONDER) if (d[k]) d[k].lastFired = futuro;
    if (forcarSeletor()) {
        if (d[ACAO_SELETOR]) d[ACAO_SELETOR].lastFired = 1;
    } else if (!configRead('enableWhoIsWatchingMenu') && d[ACAO_SELETOR]) {
        d[ACAO_SELETOR].lastFired = futuro;
    }
    return dados;
}

function regravarAcoes() {
    try {
        const bruto = window.localStorage[CHAVE_ACOES];
        if (!bruto) return;
        window.localStorage[CHAVE_ACOES] = JSON.stringify(ajustarAcoes(JSON.parse(bruto)));
    } catch (e) {
        console.warn(LOG, 'ações recorrentes: não deu para ajustar', e);
    }
}

// O TizenTube original grava a data uma vez ao abrir, e o YouTube regravava por cima
// com a data antiga (por isso a tela voltava). Aqui toda gravação do YouTube passa
// pelo ajuste.
function protegerGravacao() {
    const original = Storage.prototype.setItem;
    if (original.__tttv) return;
    const novo = function (chave, valor) {
        if (chave === CHAVE_ACOES && this === window.localStorage) {
            try {
                valor = JSON.stringify(ajustarAcoes(JSON.parse(valor)));
            } catch (e) { /* grava como veio */ }
        }
        return original.call(this, chave, valor);
    };
    novo.__tttv = true;
    Storage.prototype.setItem = novo;
}

function seletorNaTela() {
    const el = document.querySelector('ytlr-account-selector');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const itens = Array.prototype.slice.call(el.querySelectorAll('ytlr-carousel-account'));
    return itens.length ? { el, itens } : null;
}

function indiceSelecionado(itens) {
    const ativo = document.activeElement;
    let i = itens.findIndex((el) => ativo && ativo !== document.body && el.contains(ativo));
    if (i >= 0) return i;
    // Classes do YouTube TV para "selecionado" / "focado e selecionado" (podem mudar).
    i = itens.findIndex((el) => el.classList.contains('Jcc39') || el.classList.contains('JCuLmf'));
    if (i >= 0) return i;
    return itens.findIndex((el) => el.classList.contains('zylon-focus') || el.querySelector('.zylon-focus'));
}

function nomeDoItem(item) {
    return normalizar(item.textContent);
}

function tecla(codigo) {
    for (const tipo of ['keydown', 'keyup']) {
        const ev = document.createEvent('Event');
        ev.initEvent(tipo, true, true);
        ev.keyCode = codigo;
        ev.which = codigo;
        document.dispatchEvent(ev);
    }
}

function falhou(motivo, nomes) {
    const falhas = (configRead('contaPadraoFalhas') || 0) + 1;
    configWrite('contaPadraoFalhas', falhas);
    console.warn(LOG, 'conta padrão: não deu para escolher sozinho:', motivo, '| contas na tela:', nomes);
    if (falhas >= FALHAS_MAX) {
        showToast('TizenTube TV', 'Não consegui escolher a conta sozinho. A tela de contas volta ao normal.');
    }
}

async function escolherSozinho(s) {
    const alvo = comparavel(configRead('contaPadraoNome'));
    const nomes = s.itens.map(nomeDoItem);
    let idx = nomes.findIndex((n) => comparavel(n) === alvo);
    if (idx < 0) idx = nomes.findIndex((n) => comparavel(n).indexOf(alvo) >= 0);
    if (idx < 0) return falhou('conta não está na tela', nomes);

    let atual = indiceSelecionado(s.itens);
    if (atual < 0) {
        // Não deu para saber qual está selecionada: vai até a primeira e conta dali.
        for (let i = 0; i < s.itens.length; i++) { tecla(37); await esperar(150); }
        atual = 0;
    }
    const passos = idx - atual;
    for (let i = 0; i < Math.abs(passos); i++) {
        if (!armado()) return;
        tecla(passos > 0 ? 39 : 37);
        await esperar(200);
    }
    await esperar(300);
    const s2 = seletorNaTela();
    if (!s2 || !armado()) return;
    const agora = indiceSelecionado(s2.itens);
    if (agora >= 0 && agora !== idx) return falhou(`a seleção parou na ${agora}, a conta é a ${idx}`, nomes);

    tecla(13);
    await esperar(2500);
    if (seletorNaTela()) return falhou('a tela de contas continuou aberta', nomes);
    if (configRead('contaPadraoFalhas')) configWrite('contaPadraoFalhas', 0);
    console.info(LOG, 'conta padrão: entrou sozinho em', nomes[idx]);
}

function vigiar() {
    const s = seletorNaTela();
    if (!s) {
        seletorDaAbertura = false;
        return;
    }
    if (!armado() || ocupado) return;
    seletorDaAbertura = true;
    if (!configRead('contaPadraoAtiva')) return;
    if (!configRead('contaPadraoNome')) {
        console.info(LOG, 'conta padrão: esperando a pessoa escolher para aprender | contas:', s.itens.map(nomeDoItem));
        return;
    }
    ocupado = true;
    escolherSozinho(s)
        .catch((e) => falhou(String(e), []))
        .then(() => {
            ocupado = false;
            armadoAte = 0; // uma tentativa por abertura
        });
}

// Aprende a conta: OK apertado de verdade na tela de contas que apareceu ao abrir.
function aprender(e) {
    if (!e.isTrusted) return;
    armadoAte = 0; // alguém mexeu no controle: não interferir mais nesta abertura
    if (e.keyCode !== 13 || !seletorDaAbertura) return;
    if (!configRead('contaPadraoAtiva') || configRead('contaPadraoNome')) return;
    const s = seletorNaTela();
    if (!s) return;
    const i = indiceSelecionado(s.itens);
    if (i < 0) {
        console.warn(LOG, 'conta padrão: não deu para saber qual conta foi escolhida');
        return;
    }
    const nome = nomeDoItem(s.itens[i]);
    if (!nome) return;
    configWrite('contaPadraoNome', nome);
    configWrite('contaPadraoFalhas', 0);
    regravarAcoes();
    showToast('TizenTube TV', `Daqui pra frente o app entra sozinho em "${nome}".`);
    console.info(LOG, 'conta padrão aprendida:', nome);
}

configChangeEmitter.addEventListener('configChange', (ev) => {
    const { key, value } = ev.detail;
    if (key === 'contaPadraoAtiva') {
        if (!value) configWrite('contaPadraoNome', '');
        configWrite('contaPadraoFalhas', 0);
        regravarAcoes();
    } else if (key === 'enableWhoIsWatchingMenu') {
        regravarAcoes();
    }
});

try {
    protegerGravacao();
    regravarAcoes();
    document.addEventListener('keydown', aprender, true);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') armadoAte = Date.now() + JANELA_VOLTA_MS;
    });
    setInterval(vigiar, 700);
    console.info(LOG, 'conta padrão pronta | ligada:', configRead('contaPadraoAtiva'),
        '| aprendida:', !!configRead('contaPadraoNome'), '| falhas:', configRead('contaPadraoFalhas'));
} catch (e) {
    console.warn(LOG, 'conta padrão: erro ao iniciar', e);
}
