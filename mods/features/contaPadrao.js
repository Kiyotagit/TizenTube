// TizenTube TV (fork): o app abre direto na conta, sem parar na tela "Quem está assistindo?".
//
// Duas camadas:
// 1. Esconder a tela de vez. Regra lida no YouTube TV (23/11/2026): a tela de contas só aparece
//    na abertura se nenhuma de três telas (contas, boas-vindas sem conta, "bem-vindo de volta")
//    apareceu dentro de um intervalo mínimo. O TizenTube original joga as três para o futuro uma
//    vez ao abrir, mas o YouTube regravava por cima com a data dele, e a tela voltava. Aqui toda
//    gravação do YouTube nessa chave passa pelo ajuste.
// 2. Se a tela aparecer mesmo assim (o YouTube tem outro modo, por tempo desde que o app foi
//    fechado, decidido pelo servidor), confirmar sozinho: a conta aprendida, se houver, ou a que
//    já vem marcada, desde que seja uma conta de verdade (tem "@canal"; nunca "Crianças",
//    "Adicionar conta" nem "Visitante").
//
// Só age logo depois de abrir ou de voltar ao app e nunca depois que alguém apertou uma tecla:
// quem abrir a troca de contas pela foto do canto escolhe à vontade.
// Conta aprendida: quando a pessoa escolhe uma conta na tela que apareceu ao abrir, o nome fica
// guardado só na TV (configuração do TizenTube). Serve para quando houver mais de uma conta.
//
// A tela é <ytlr-account-selector>, com um <ytlr-carousel-account> por item numa fileira; o item
// marcado tem o foco (testado na TV em 23/11/2026; um OK sintético no documento confirma).

import { configRead, configWrite, configChangeEmitter } from '../config.js';
import { showToast } from '../ui/ytUI.js';

const CHAVE_ACOES = 'yt.leanback.default::recurring_actions';
const ACOES_TELAS = [
    'startup-screen-account-selector-with-guest',
    'whos_watching_fullscreen_zero_accounts',
    'startup-screen-signed-out-welcome-back',
];
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

function ajustarAcoes(dados) {
    const d = dados && dados.data && dados.data.data;
    if (!d || configRead('enableWhoIsWatchingMenu')) return dados;
    const futuro = Date.now() + 7 * 24 * 60 * 60 * 1000;
    for (const k of ACOES_TELAS) if (d[k]) d[k].lastFired = futuro;
    return dados;
}

function regravarAcoes() {
    try {
        const bruto = window.localStorage[CHAVE_ACOES];
        if (bruto) window.localStorage[CHAVE_ACOES] = JSON.stringify(ajustarAcoes(JSON.parse(bruto)));
    } catch (e) {
        console.warn(LOG, 'ações recorrentes: não deu para ajustar', e);
    }
}

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
    i = itens.findIndex((el) => el.classList.contains('zylon-focus') || el.querySelector('.zylon-focus'));
    if (i >= 0) return i;
    // Classes do YouTube TV para "selecionado" / "focado e selecionado" (podem mudar).
    return itens.findIndex((el) => el.classList.contains('Jcc39') || el.classList.contains('JCuLmf'));
}

const nomeDoItem = (item) => normalizar(item.textContent);
const ehContaDeVerdade = (nome) => nome.indexOf('@') > 0;

function tecla(codigo) {
    for (const tipo of ['keydown', 'keyup']) {
        const ev = document.createEvent('Event');
        ev.initEvent(tipo, true, true);
        ev.keyCode = codigo;
        ev.which = codigo;
        document.dispatchEvent(ev);
    }
}

async function escolherSozinho(s) {
    const nomes = s.itens.map(nomeDoItem);
    const atual = indiceSelecionado(s.itens);
    let alvo = -1;
    const aprendida = comparavel(configRead('contaPadraoNome'));
    if (aprendida) alvo = nomes.findIndex((n) => comparavel(n) === aprendida);
    if (alvo < 0 && atual >= 0 && ehContaDeVerdade(nomes[atual])) alvo = atual;
    if (alvo < 0) {
        console.warn(LOG, 'tela de contas: nada seguro para escolher sozinho', nomes);
        return;
    }
    if (atual < 0) {
        console.warn(LOG, 'tela de contas: não deu para saber qual item está marcado', nomes);
        return;
    }
    const passos = alvo - atual;
    for (let i = 0; i < Math.abs(passos); i++) {
        if (!armado()) return;
        tecla(passos > 0 ? 39 : 37);
        await esperar(250);
    }
    if (passos) {
        await esperar(300);
        const s2 = seletorNaTela();
        if (!s2 || indiceSelecionado(s2.itens) !== alvo) {
            console.warn(LOG, 'tela de contas: a seleção não chegou na conta', nomes[alvo]);
            return;
        }
    }
    if (!armado()) return;
    tecla(13);
    console.info(LOG, 'tela de contas: entrou sozinho em', nomes[alvo]);
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
    ocupado = true;
    escolherSozinho(s)
        .catch((e) => console.warn(LOG, 'tela de contas: erro', e))
        .then(() => {
            ocupado = false;
            armadoAte = 0; // uma tentativa por abertura
        });
}

// Aprende a conta: OK apertado de verdade na tela de contas que apareceu ao abrir.
function aprender(e) {
    if (!e.isTrusted) return;
    armadoAte = 0; // alguém mexeu no controle: não interferir mais nesta abertura
    if (e.keyCode !== 13 || !seletorDaAbertura || !configRead('contaPadraoAtiva')) return;
    const s = seletorNaTela();
    if (!s) return;
    const i = indiceSelecionado(s.itens);
    if (i < 0) return;
    const nome = nomeDoItem(s.itens[i]);
    if (!ehContaDeVerdade(nome) || comparavel(nome) === comparavel(configRead('contaPadraoNome'))) return;
    configWrite('contaPadraoNome', nome);
    showToast('TizenTube TV', `O app vai entrar sozinho em "${nome.split('@')[0].trim()}".`);
}

configChangeEmitter.addEventListener('configChange', (ev) => {
    const { key, value } = ev.detail;
    if (key === 'contaPadraoAtiva' && !value) configWrite('contaPadraoNome', '');
    if (key === 'enableWhoIsWatchingMenu') regravarAcoes();
});

try {
    protegerGravacao();
    regravarAcoes();
    document.addEventListener('keydown', aprender, true);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') armadoAte = Date.now() + JANELA_VOLTA_MS;
    });
    setInterval(vigiar, 700);
    // Para testes: rearma como se o app tivesse acabado de abrir.
    window.__tizentubeTvConta = { armar: () => { armadoAte = Date.now() + JANELA_VOLTA_MS; } };
} catch (e) {
    console.warn(LOG, 'conta padrão: erro ao iniciar', e);
}
