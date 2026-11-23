"""Servidor de depuração só no 127.0.0.1 do PC, alcançado pela TV via `adb reverse tcp:8099 tcp:8099`.

GET  /cmd  -> devolve (e apaga) o conteúdo de cmd.js, se existir (o script da TV executa)
POST /res  -> anexa o corpo em log.txt (resultado de um comando)
POST /diag -> anexa o corpo em log.txt (diagnóstico automático)
"""
import datetime
import http.server
from pathlib import Path

PASTA = Path(__file__).resolve().parent
CMD = PASTA / "cmd.js"
LOG = PASTA / "log.txt"


class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_GET(self):
        corpo = b""
        if self.path.startswith("/cmd") and CMD.exists():
            corpo = CMD.read_bytes()
            CMD.unlink()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(corpo)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        dados = self.rfile.read(n).decode("utf-8", "replace")
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"--- {datetime.datetime.now():%H:%M:%S} {self.path}\n{dados}\n")
        self.send_response(204)
        self._cors()
        self.end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", 8099), H).serve_forever()
