#!/bin/sh
cd "$(dirname "$0")"
V=$(date +%s)
(cat src/head.html; printf 'const BUILD="%s";\n' "$V"; cat src/art.js src/town.js src/fx.js src/extra.js src/gear.js src/ranch.js src/decor.js src/beast.js src/tone.js src/bag.js src/items.js src/push.js src/report.js src/mj_engine.js src/mahjong.js src/b2_engine.js src/big2.js src/bc_engine.js src/baccarat.js src/th_engine.js src/holdem.js src/run.js src/logic.js; printf '\n</script>\n</body>\n</html>\n') > index.html
sed -i "s#\(src=\"assets/[a-z0-9_]*\.webp\)\"#\1?v=$V\"#g" index.html
