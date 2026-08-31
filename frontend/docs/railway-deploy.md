# Deploy do frontend no Railway

## Configuracao obrigatoria do servico

- Root Directory: `/frontend`
- Config as Code: `/frontend/railway.json`
- Builder: Railpack
- Runtime: Node.js 20, definido em `package.json`
- Healthcheck: `GET /api/health`, que deve responder `200` com `{ "status": "ok" }`
- Porta: nao definir manualmente; `next start` usa a variavel `PORT` fornecida pelo Railway

Se o Root Directory ficar na raiz do repositorio, o Railway usara o `railway.json` e o `Dockerfile` do backend. O frontend e o backend precisam ser servicos separados apontando para seus respectivos diretorios/configuracoes.

O Railway descontinuara a leitura de `railway.json`/`railway.toml` em 1 de dezembro de 2026. Antes dessa data, migrar o projeto autenticado para `.railway/railway.ts` com o fluxo oficial `railway config migrate`, revisar `railway config plan` e somente entao aplicar. Nao remover este arquivo antes da migracao externa, pois ele ainda e a fonte de configuracao do servico legado.

## Variaveis

- `BACKEND_URL` (obrigatoria): origem privada ou publica do backend, sem o sufixo `/api`. Exemplo: `https://backend.exemplo.com`.

Credenciais de usuario ou tokens privados nunca devem usar o prefixo `NEXT_PUBLIC_`, pois esse prefixo inclui o valor no bundle enviado ao navegador. A autenticacao administrativa usa exclusivamente o cookie de sessao `HttpOnly`; o JWT nao deve ser copiado para Web Storage.

## Validacao antes do deploy

```sh
npm ci
npm run check
npm run build
npm run start
```

Depois do start, validar `GET /api/health` e confirmar que a resposta e `200`. A pagina `/` nao deve ser usada como healthcheck porque usuarios sem sessao recebem redirecionamento para `/login`.
