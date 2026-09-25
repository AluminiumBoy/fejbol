#!/bin/sh
# Új verziószám minden fájlhivatkozásba, hogy frissítés után ne keveredjenek régi és új fájlok.
# Használat: tools/kiadas.sh   (a verzió a sw.js CACHE nevéből nő eggyel)
cd "$(dirname "$0")/.." || exit 1
N=$(( $(sed -n "s/.*fejbol-v\([0-9]*\).*/\1/p" sw.js | head -1) + 1 ))
sed -i "s/fejbol-v[0-9]*/fejbol-v$N/" sw.js
sed -i -E "s#(from '\./[a-z]+\.js)(\?v=[0-9]+)?'#\1?v=$N'#g" js/*.js
sed -i -E "s#(js/app\.js|css/style\.css)(\?v=[0-9]+)?\"#\1?v=$N\"#g" index.html
echo "verzió: $N"
