// TizenTube TV: carregador.
//
// O APK da TV aponta (dentro do libchrobalt.so, no lugar do endereço original do TizenTube) para
//   https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@tv-1/carregador.js
// A tag tv-1 nunca muda, então este arquivo também não. Ele pergunta ao GitHub qual é o commit
// mais novo do main e carrega tv/tizentube.js daquele commit: endereço por commit o jsDelivr
// entrega na hora, enquanto "@main" fica até 12 h em cache. Se o GitHub não responder,
// carrega "@main" mesmo (pode estar um pouco atrasado, mas funciona).
// Se precisar mudar este arquivo: criar a tag tv-2 e trocar o endereço no atualizar_tizentube.py.
(function () {
    var REPO = 'Kiyotagit/TizenTube';
    var CAMINHO = '/tv/tizentube.js';
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
            console.warn('[TizenTube TV] carregador: falhou ' + url);
            if (ref !== 'main') { carregado = false; carregar('main'); }
        };
        (document.head || document.documentElement).appendChild(s);
    }

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
            carregar(/^[0-9a-f]{40}$/.test(sha) ? sha : 'main');
        }).catch(function (e) {
            clearTimeout(reserva);
            console.warn('[TizenTube TV] carregador: GitHub não respondeu (' + e + '), usando @main');
            carregar('main');
        });
    } catch (e) {
        clearTimeout(reserva);
        carregar('main');
    }
})();
