# TizenTube TV (fork)

Cópia do [TizenTube](https://github.com/reisxd/TizenTube) (GPL-3.0) com três ajustes para uma
Android TV que roda o [TizenTube Cobalt](https://github.com/reisxd/TizenTubeCobalt) com o APK
remendado (sem ícone na tela inicial e assinado com outra chave). Tudo testado na TV em 23/11/2026.

## O que muda em relação ao original

1. **Abre direto na conta, sem "Quem está assistindo?"** (`mods/features/contaPadrao.js`).
   - Esconde a tela de vez. O original jogava as datas das telas de abertura para o futuro só
     uma vez ao abrir, e o YouTube regravava por cima; agora toda gravação do YouTube nessa
     chave (`yt.leanback.default::recurring_actions`) passa pelo ajuste. Regra do YouTube TV:
     a tela de contas só aparece se nenhuma de três telas (contas, boas-vindas sem conta,
     "bem-vindo de volta") apareceu dentro de um intervalo mínimo.
   - Se a tela aparecer mesmo assim (o YouTube tem outro modo, por tempo desde que o app foi
     fechado, decidido pelo servidor), confirma sozinho: a conta aprendida, se houver, ou a que
     já vem marcada, desde que seja conta de verdade (tem "@canal"; nunca "Crianças",
     "Adicionar conta" nem "Visitante"). Só age logo depois de abrir/voltar ao app e nunca
     depois de alguém apertar uma tecla (quem abrir a troca de contas pela foto escolhe à vontade).
   - Conta aprendida: quando a pessoa escolhe uma conta nessa tela, o nome fica só na TV
     (configuração do TizenTube). Serve para quando a TV tiver mais de uma conta.
   - Liga/desliga em Configurações do TizenTube → Configurações Diversas → Menu "Quem está
     assistindo?" → "Entrar sozinho...". Desligar esquece a conta aprendida.
   - Para testes, `window.__tizentubeTvConta.armar()` rearma como se o app tivesse acabado de abrir.
2. **Histórico na barra lateral** (`mods/ui/customGuideAction.js`). Entra uma vez, logo depois
   do Início (no YouTube TV o Início é `default`), com o ícone `WATCH_HISTORY`. Abre os últimos
   vídeos vistos, com a barrinha de onde cada um parou. Dá para tirar ou mover no menu de
   ordenar da barra lateral do TizenTube.
3. **Sem o atualizador de APK** (`mods/features/updater.js`). O APK da TV é assinado com outra
   chave; baixar o oficial por dentro do app sempre dá "conflito de pacotes". A atualização é
   feita pelo PC (`atualizar_tizentube.py` da PonteAndroidTV).

Também: `mods/ui/disableWhosWatching.js` não derruba mais o script inteiro se faltar uma chave.

## Como a TV carrega este script

O APK remendado troca, dentro do `libchrobalt.so`, o endereço do script original pelo do
carregador deste fork, com o mesmo tamanho (66 bytes):

```
https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js   (original)
https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@tv-2/carregador.js   (este fork)
```

O `carregador.js` (tag fixa `tv-2`) carrega `tv/tizentube.js` de um commit exato: na hora, o
último commit que ele já conhece (guardado na TV em `tizentube-tv-commit`), e em segundo plano
pergunta ao GitHub o mais novo para a próxima abertura. Por commit o jsDelivr entrega na hora;
"@main" ficava até 12 h em cache. A tag `tv-1` esperava o GitHub antes de carregar e atrasava o
script (às vezes a tela inicial chegava antes do bloqueio de anúncios).

## Publicar uma mudança

```
python publicar.py "o que mudou"
```

Compila, copia para `tv/tizentube.js`, faz commit e push e confere que o jsDelivr já entrega.
Na TV a mudança entra na **segunda** abertura do app (a primeira só descobre o commit novo).

## Trazer novidades do original

```
git fetch upstream
git merge upstream/main      # conflitos, se houver, nos trechos marcados "TizenTube TV (fork)"
python publicar.py "traz o TizenTube <versão>"
```

## Depurar na TV

O Cobalt não manda `console.log` do script para o logcat. Em `ferramentas/` está um canal com o
PC: `servidor_depuracao.py` (só em 127.0.0.1:8099) + `adb reverse tcp:8099 tcp:8099` + importar
`ferramentas/depuracaoPC.js` no `mods/userScript.js` (temporariamente). O script busca comandos
em `cmd.js` e manda o resultado para `log.txt`. **Nunca despejar as chaves
`yt.leanback.default::last-identity-used`, `available-identities` ou `cached-access-tokens`:
guardam códigos de acesso da conta Google.**
