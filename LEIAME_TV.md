# TizenTube TV (fork)

Cópia do [TizenTube](https://github.com/reisxd/TizenTube) (GPL-3.0) com três ajustes para uma
Android TV que roda o [TizenTube Cobalt](https://github.com/reisxd/TizenTubeCobalt) com o APK
remendado (sem ícone na tela inicial e assinado com outra chave).

## O que muda em relação ao original

1. **Conta padrão ao abrir** (`mods/features/contaPadrao.js`). Na primeira vez que a tela
   "Quem está assistindo?" aparece ao abrir o app, a pessoa escolhe a conta e o nome fica
   guardado só na TV. Depois disso a tela aparece em toda abertura e o script anda até essa
   conta e confirma sozinho, então o app sempre abre nela. Não age se alguém já apertou uma
   tecla (quem abrir a troca de contas pela foto escolhe à vontade). Se falhar duas vezes
   seguidas, desiste e volta ao comportamento normal. Liga/desliga (e esquece a conta) em
   Configurações do TizenTube → Configurações Diversas → Menu "Quem está assistindo?".
   Também corrige a tela de contas que voltava mesmo desligada: o YouTube regravava as
   "ações recorrentes" por cima do ajuste do TizenTube; agora toda gravação passa pelo ajuste.
2. **Histórico na barra lateral** (`mods/ui/customGuideAction.js`). Entra uma vez, logo depois
   do Início, com o ícone de histórico. Abre os últimos vídeos vistos, que continuam de onde
   pararam. Dá para tirar ou mover no menu de ordenar da barra lateral do TizenTube.
3. **Sem o atualizador de APK** (`mods/features/updater.js`). O APK da TV é assinado com outra
   chave; baixar o oficial por dentro do app sempre dá "conflito de pacotes". A atualização é
   feita pelo PC (`atualizar_tizentube.py` da PonteAndroidTV).

## Como a TV carrega este script

O APK remendado troca, dentro do `libchrobalt.so`, o endereço do script original pelo deste
fork, com o mesmo tamanho:

```
https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js   (original)
https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@main/userScript.js   (este fork)
```

Por isso o `userScript.js` compilado fica na raiz do `main`.

## Publicar uma mudança

```
python publicar.py "o que mudou"
```

Compila, copia para a raiz, faz commit e push, limpa o cache do jsDelivr e espera ele entregar
a versão nova. Depois é só fechar e abrir o YouTube na TV.

## Trazer novidades do original

```
git fetch upstream
git merge upstream/main      # resolver conflitos, se houver, nos arquivos marcados "TizenTube TV (fork)"
python publicar.py "traz o TizenTube <versão>"
```
