# Busca publica de produtos

O caminho avancado e opt-in e nasce com `SEARCH_RANKING_PERCENTAGE=0`. A busca legada continua atendendo o endpoint existente; codigo exato preserva a ordem `${codigo}C` e depois `${codigo}`. O consumidor Maggenta preserva a ordem de `data.items`; outros consumidores devem fazer o mesmo antes de depender do ranking.

## Preparacao segura

1. Faça backup e execute primeiro em staging com MariaDB 10.3. Verifique espaco, transacoes longas, metadata locks e `lock_wait_timeout`.
2. Configure `SEARCH_EXPECTED_REPLICAS`, `DB_CONNECTION_LIMIT`, `SEARCH_CURSOR_SECRET` e `SEARCH_PUBLIC_DEFAULT_EMPRESA_ID`.
3. Compile e rode `npm run search:preflight`. O produto `pool x replicas` precisa ficar abaixo de 70% de `max_connections`. Com shadow, escrita sincronizada ou ranking ativos, o preflight tambem exige migrations registradas, dicionario, atributos, versao de catalogo e 100% dos produtos publicos com documento.
4. Rode `npm run db:migrate`. No Railway isso esta configurado como pre-deploy e bloqueia o start quando falha.
5. Para cada tenant, rode `npm run search:seed-dictionary -- <empresaId>` e `npm run search:rebuild -- <empresaId> 200`.
6. Catalogue manualmente atributos e tipos contidos por `PUT /api/v1/search/products/:id/metadata`. O rebuild nunca infere metadata a partir da descricao.
7. Rode `npm run search:golden -- <empresaId>` e revise MRR, NDCG@10, Precision@10, Recall@20 e violacoes.
8. Execute `npm run search:benchmark` em staging para cache `warm`, `cold` e desabilitado. Informe `SEARCH_BASE_URL`, `SEARCH_EMPRESA_ID`, `SEARCH_SITE_TOKEN`, `SEARCH_HARDWARE`, `SEARCH_REPLICAS` e `SEARCH_DATASET`. O relatorio JSON e evidencia da execucao; as metas p50/p95/p99 nao sao garantias.

O build deve existir antes dos scripts operacionais (`npm run build`). Para migrations locais sem build, existem `db:migrate:dev` e `db:rollback:dev`.

## Rollout

- Ative `SEARCH_WRITE_SYNC_ENABLED=true` somente depois do schema e do rebuild. A partir dai criacao, edicao, exclusao e substituicao de metadata atualizam documento e catalog version na mesma transacao.
- Use `SEARCH_SHADOW_PERCENTAGE` para comparacao amostrada sem alterar a resposta.
- Depois da correcao do consumidor e dos gates de qualidade/carga, avance `SEARCH_RANKING_PERCENTAGE` por 5, 25, 50 e 100. O bucket e estavel por tenant e consulta normalizada.
- Somente depois de registrar esses gates, defina `SEARCH_PREFLIGHT_ALLOW_RANKING=true`; sem essa confirmacao o preflight rejeita percentuais maiores que zero.
- Nao altere `SEARCH_CANDIDATE_POOL=250` sem novo benchmark.

## Contratos e operacao

- Busca: `GET /api/v1/produtos/site/busca`; os aliases legados `GET /api/v1/produtos/site?busca=` e `?search=` delegam ao mesmo motor. Autocomplete: `GET /api/v1/search/autocomplete`; clique: `POST /api/v1/search/click`.
- O ranking atual e `v2`. O timeout total padrao e 3 s, medido para o banco remoto atual; cada statement de busca continua limitado a 500 ms no MariaDB. Reavalie o timeout somente com benchmark reproduzivel no ambiente de deploy.
- O consumidor deve aplicar debounce de 150 a 300 ms no autocomplete; ele usa apenas prefixos e dicionario, sem executar o ranking completo.
- O token do site define o tenant. `empresaId` so e aceito quando coincide; sem token, somente o tenant publico configurado.
- Preco, marca e estoque retornam `422 UNSUPPORTED_SEARCH_FILTER`.
- CRUD interno usa `search.manage`; debug com breakdown usa `search.debug`. Grupos `admin` e `administrador` sao superusuarios.
- `/metrics` exige `METRICS_TOKEN` e nao usa a consulta como label. Acompanhe requests/erros, zero-result, cache, circuit breaker, candidatos, tempos, fila e saturacao do pool. Configure alertas de p95/p99, erro, timeout, fila, conexoes e pico de zero-result; CPU do banco depende da telemetria do provedor/slow log.
- Rode periodicamente `npm run search:purge-analytics -- 180`.

## Rollback

O rollback imediato e `SEARCH_RANKING_PERCENTAGE=0`; as chaves antigas ficam inacessiveis porque incluem ranking e catalog version. Se necessario, volte o SHA mantendo as tabelas aditivas. Exporte dicionario e metadata antes de `npm run db:rollback`; o rollback estrutural nao e necessario para restaurar a busca legada.
