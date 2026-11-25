#!/usr/bin/env bash
# Roda código JS no shift.execute do Shift em execução (MCP local) e imprime o resultado.
# Uso: scripts/shift-exec.sh arquivo.js        (o arquivo contém: async () => { ... })
#      scripts/shift-exec.sh -e 'async () => shift.sessions.list()'
# Porta: SHIFT_MCP_PORT (padrão 17463 = Shift Dev; 17461 = Shift instalado).
set -euo pipefail
port="${SHIFT_MCP_PORT:-17463}"
if [ "${1:-}" = "-e" ]; then code="$2"; else code="$(cat "$1")"; fi

# Corpo em arquivo UTF-8: com -d, o curl do Windows erra o Content-Length de texto acentuado.
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
node -e 'require("fs").writeFileSync(process.argv[2], JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"shift.execute",arguments:{code:process.argv[1]}}}))' "$code" "$body_file"

curl -s -m 120 -X POST "http://127.0.0.1:${port}/mcp" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-06-18" --data-binary "@$body_file" \
  | sed -n 's/^data: //p' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{if(!s){console.error("resposta vazia do MCP (o Shift está aberto com agentes ligados?)");process.exit(1)}const r=JSON.parse(s);if(r.error){console.error(JSON.stringify(r.error));process.exit(1)}for(const c of r.result.content)console.log(c.type==="text"?c.text:`[${c.type}]`);if(r.result.isError)process.exit(2)})'
