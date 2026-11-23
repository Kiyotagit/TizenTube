// TizenTube TV: carregador (versão da tag tv-2).
//
// O APK da TV aponta (dentro do libchrobalt.so, no lugar do endereço original do TizenTube) para
//   https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@tv-2/carregador.js
// A tag nunca muda, então este arquivo também não. Ele carrega tv/tizentube.js de um commit
// exato (endereço por commit o jsDelivr entrega na hora; "@main" fica até 12 h em cache):
// - na hora, o último commit que ele já conhece (guardado na TV), para o script entrar o mais
//   cedo possível (o bloqueio de anúncios precisa estar armado antes da tela inicial chegar);
// - em segundo plano pergunta ao GitHub o commit mais novo do main e guarda para a próxima
//   abertura. Então uma mudança publicada chega na SEGUNDA abertura do app.
// Na primeira vez (nada guardado) espera o GitHub; se ele não responder, usa "@main".
// tv-1 (23/11/2026) esperava o GitHub sempre e atrasava o script.
// Para mudar este arquivo: nova tag (tv-3) e trocar o endereço no atualizar_tizentube.py.
(function () {
    var REPO = 'Kiyotagit/TizenTube';
    var CAMINHO = '/tv/tizentube.js';
    var CHAVE = 'tizentube-tv-commit';
    var SHA = /^[0-9a-f]{40}$/;
    var carregado = false;
    var politica = null;
    try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            politica = window.trustedTypes.createPolicy('tizentube-tv-carregador', {
                createScriptURL: function (u) { return u; }
            });
        }
    } catch (e) { /* sem tipos confiáveis: usa o texto direto */ }

    function carregar(ref) {
        if (carregado) return;
        carregado = true;
        var url = 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + ref + CAMINHO;
        var s = document.createElement('script');
        s.src = politica ? politica.createScriptURL(url) : url;
        s.onerror = function () {
            if (ref !== 'main') { carregado = false; carregar('main'); }
        };
        (document.head || document.documentElement).appendChild(s);
    }

    var guardado = null;
    try { guardado = window.localStorage.getItem(CHAVE); } catch (e) { /* sem armazenamento */ }
    if (guardado && SHA.test(guardado)) carregar(guardado);

    var reserva = setTimeout(function () { carregar('main'); }, 5000);
    try {
        fetch('https://api.github.com/repos/' + REPO + '/commits/main', {
            headers: { Accept: 'application/vnd.github.sha' },
            cache: 'no-store'
        }).then(function (r) {
            return r.ok ? r.text() : Promise.reject(r.status);
        }).then(function (sha) {
            clearTimeout(reserva);
            sha = (sha || '').trim();
            if (SHA.test(sha)) {
                try { window.localStorage.setItem(CHAVE, sha); } catch (e) { /* tudo bem */ }
                carregar(sha);
            } else {
                carregar('main');
            }
        }).catch(function () {
            clearTimeout(reserva);
            carregar('main');
        });
    } catch (e) {
        clearTimeout(reserva);
        carregar('main');
    }
})();
