"""Compila e publica o script do TizenTube TV (este fork) para a TV baixar.

A TV do quarto (APK remendado pela PonteAndroidTV, `atualizar_tizentube.py`) baixa o script de
    https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@main/userScript.js
ou seja, o arquivo `userScript.js` da RAIZ do branch `main` deste repositório, servido pelo
jsDelivr. Esse endereço tem exatamente o mesmo tamanho do original
(`.../npm/@foxreis/tizentube/dist/userScript.js`), por isso cabe no lugar dele dentro do
`libchrobalt.so` sem mexer em mais nada.

Uso (na pasta do repositório):
    python publicar.py "o que mudou"

Faz: `npm run build` em mods/ -> copia dist/userScript.js para a raiz -> commit -> push ->
pede ao jsDelivr para esquecer a cópia antiga -> espera o jsDelivr entregar o arquivo novo.
Depois disso basta fechar e abrir o YouTube na TV.
"""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
URL = "https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@main/userScript.js"
PURGE = "https://purge.jsdelivr.net/gh/Kiyotagit/TizenTube@main/userScript.js"
ASSINATURA = "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"


def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "TizenTubeTV-publicar", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> None:
    msg = sys.argv[1] if len(sys.argv) > 1 else "atualiza o script"
    subprocess.run("npm run build", cwd=RAIZ / "mods", shell=True, check=True)
    shutil.copyfile(RAIZ / "dist" / "userScript.js", RAIZ / "userScript.js")
    subprocess.run(["git", "add", "-A"], cwd=RAIZ, check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=RAIZ).returncode != 0:
        subprocess.run(["git", "commit", "-q", "-m", msg + ASSINATURA], cwd=RAIZ, check=True)
    subprocess.run(["git", "push", "-q", "origin", "main"], cwd=RAIZ, check=True)

    local = hashlib.sha256((RAIZ / "userScript.js").read_bytes()).hexdigest()
    for tentativa in range(12):
        try:
            print("jsDelivr purge:", baixar(PURGE)[:120].decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            print("purge falhou (tenta de novo):", e)
        time.sleep(10)
        remoto = hashlib.sha256(baixar(URL)).hexdigest()
        if remoto == local:
            print(f"Publicado: o jsDelivr já entrega a versão nova ({local[:12]}).")
            return
        print(f"jsDelivr ainda com a versão antiga ({remoto[:12]} != {local[:12]}), tentativa {tentativa + 1}")
    sys.exit("O jsDelivr não atualizou em 2 minutos; rode de novo daqui a pouco.")


if __name__ == "__main__":
    main()
