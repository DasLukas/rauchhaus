#!/bin/zsh
# Startet die gebaute Vorschau auf dem Mac auch ohne laufende Chat-Sitzung.
cd -- "${0:A:h}" || exit 1
if [[ ! -r dist/index.html ]]; then
  echo 'Die Vorschau fehlt. Erstelle sie im Projekt mit npm run build.'
  exit 1
fi

echo 'Brandhaus: http://127.0.0.1:5182/?modul=brandhaus'
exec /usr/bin/python3 -u -m http.server 5182 --bind 127.0.0.1 --directory "$PWD/dist"
