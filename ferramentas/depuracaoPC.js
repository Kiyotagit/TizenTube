// TizenTube TV: canal de depuração com o PC (temporário, só para testes).
//
// O PC roda um servidor em 127.0.0.1:8099 e abre `adb reverse tcp:8099 tcp:8099`; assim o
// http://localhost:8099 da TV chega no PC (a página do YouTube TV permite localhost no
// connect-src). Sem o servidor do PC, as primeiras tentativas falham e o canal desliga sozinho.
// O Cobalt não manda console.log do script para o logcat, por isso este canal.

const BASE = 'http://localhost:8099';
let politica = null;
try {
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        politica = window.trustedTypes.createPolicy('tizentube-tv-depuracao', { createScript: (s) => s });
    }
} catch (e) { /* sem tipos confiáveis */ }

export function enviar(rota, dados) {
    try {
        const corpo = typeof dados === 'string' ? dados : JSON.stringify(dados);
        fetch(BASE + rota, { method: 'POST', mode: 'no-cors', body: corpo }).catch(() => {});
    } catch (e) { /* sem canal */ }
}

function textoDe(v) {
    try {
        if (v instanceof Element) return v.outerHTML.slice(0, 4000);
        if (typeof v === 'string') return v;
        return JSON.stringify(v, null, 1);
    } catch (e) {
        return String(v);
    }
}

let falhasSeguidas = 0;
let ligado = false;
const fim = Date.now() + 30 * 60 * 1000;

function perguntar() {
    if (Date.now() > fim) return;
    fetch(BASE + '/cmd', { cache: 'no-store' })
        .then((r) => r.text())
        .then((cmd) => {
            falhasSeguidas = 0;
            if (!ligado) { ligado = true; enviar('/diag', 'canal ligado: ' + location.href); }
            if (cmd && cmd.trim()) {
                let res;
                try {
                    // eslint-disable-next-line no-eval
                    res = (0, eval)(politica ? politica.createScript(cmd) : cmd);
                } catch (e) {
                    res = 'ERRO: ' + (e && e.stack || e);
                }
                Promise.resolve(res).then((v) => enviar('/res', textoDe(v)), (e) => enviar('/res', 'ERRO async: ' + e));
            }
            setTimeout(perguntar, 1200);
        })
        .catch(() => {
            falhasSeguidas++;
            if (ligado || falhasSeguidas < 3) setTimeout(perguntar, 3000);
        });
}

perguntar();
