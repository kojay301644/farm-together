#!/bin/sh
cd "$(dirname "$0")"
(cat src/head.html src/art.js src/town.js src/fx.js src/extra.js src/gear.js src/logic.js; printf '\n</script>\n</body>\n</html>\n') > index.html
