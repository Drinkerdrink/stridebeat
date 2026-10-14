"""Optional Python 3 launcher. No third-party Python packages required."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent / 'dist'

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.map': 'application/json'}

    def do_GET(self):
        target = Path(self.translate_path(self.path)).resolve()
        try:
            relative = target.relative_to(ROOT)
        except ValueError:
            self.send_error(403)
            return
        if any(part.startswith('.') for part in relative.parts):
            self.send_error(403)
            return
        super().do_GET()

    def list_directory(self, path):
        self.send_error(403)
        return None

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

parser = argparse.ArgumentParser(description='Start Stridebeat locally')
parser.add_argument('--port', type=int, default=4173)
parser.add_argument('--open', action='store_true')
options = parser.parse_args()
try:
    server = ThreadingHTTPServer(('127.0.0.1', options.port), partial(Handler, directory=str(ROOT)))
except OSError as error:
    raise SystemExit(f'Cannot start server: {error}. Try another port, e.g. --port 4174')
url = f'http://127.0.0.1:{server.server_address[1]}'
print(f'Stridebeat: {url}\nKeep this window open. Press Ctrl+C to stop.', flush=True)
if options.open:
    threading.Timer(0.3, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
