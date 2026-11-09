#!/bin/sh
cd "$(dirname "$0")"
V=$(date +%s)
(cat src/head.html; printf 'const BUILD="%s";\n' "$V"; cat src/art.js src/town.js src/fx.js src/extra.js src/gear.js src/logic.js; printf '\n</script>\n</body>\n</html>\n') > index.html
sed -i "s#\(src=\"assets/[a-z0-9_]*\.webp\)\"#\1?v=$V\"#g" index.html
