"""Compila e publica o script do TizenTube TV (este fork) para a TV baixar.

Caminho que a TV faz (APK remendado pela PonteAndroidTV, `atualizar_tizentube.py`):
  1. o app carrega https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@tv-2/carregador.js
     (endereço do mesmo tamanho do original, trocado dentro do libchrobalt.so; tag fixa);
  2. o carregador carrega https://cdn.jsdelivr.net/gh/Kiyotagit/TizenTube@<commit>/tv/tizentube.js
     com o último commit que ele conhece e pergunta ao GitHub o mais novo para a PRÓXIMA
     abertura (por commit o jsDelivr entrega na hora; "@main" ficaria até 12 h em cache).
     Então uma mudança publicada entra na segunda abertura do app.

Uso (na pasta do repositório):
    python publicar.py "o que mudou"

Faz: `npm run build` em mods/ -> copia dist/userScript.js para tv/tizentube.js (e para a raiz,
userScript.js, cópia de reserva) -> commit -> push -> confere que o jsDelivr já entrega o
arquivo novo pelo endereço do commit. Depois é só fechar e abrir o YouTube na TV.
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
REPO = "Kiyotagit/TizenTube"
ASSINATURA = "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"


def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "TizenTubeTV-publicar"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def git(*args: str, capturar: bool = False) -> str:
    r = subprocess.run(["git", *args], cwd=RAIZ, check=True, text=True,
                       capture_output=capturar)
    return (r.stdout or "").strip()


def main() -> None:
    msg = sys.argv[1] if len(sys.argv) > 1 else "atualiza o script"
    subprocess.run("npm run build", cwd=RAIZ / "mods", shell=True, check=True)
    (RAIZ / "tv").mkdir(exist_ok=True)
    shutil.copyfile(RAIZ / "dist" / "userScript.js", RAIZ / "tv" / "tizentube.js")
    shutil.copyfile(RAIZ / "dist" / "userScript.js", RAIZ / "userScript.js")
    git("add", "-A")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=RAIZ).returncode != 0:
        git("commit", "-q", "-m", msg + ASSINATURA)
    git("push", "-q", "origin", "main")
    sha = git("rev-parse", "HEAD", capturar=True)

    local = hashlib.sha256((RAIZ / "tv" / "tizentube.js").read_bytes()).hexdigest()
    url = f"https://cdn.jsdelivr.net/gh/{REPO}@{sha}/tv/tizentube.js"
    for tentativa in range(10):
        try:
            if hashlib.sha256(baixar(url)).hexdigest() == local:
                print(f"Publicado: commit {sha[:10]}; o jsDelivr já entrega. Feche e abra o YouTube na TV.")
                return
        except Exception as e:  # noqa: BLE001
            print(f"jsDelivr ainda não tem ({e}); tentativa {tentativa + 1}")
        time.sleep(6)
    sys.exit(f"O jsDelivr não entregou {url} em 1 minuto; tente abrir o endereço de novo daqui a pouco.")


if __name__ == "__main__":
    main()
