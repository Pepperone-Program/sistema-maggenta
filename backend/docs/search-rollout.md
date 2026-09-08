# Busca lexical full text (v6)

A busca pública usa exclusivamente os índices `normalized_name` e `search_text` para recuperar candidatos. Preserva a resolução de código `${codigo}C`, depois `${codigo}`. Os aliases `q`, `busca` e `search` usam o mesmo serviço. A busca administrativa permanece independente.

## Contrato

- Acentos, caixa e espaços são normalizados. Não há correção ortográfica, expansão de sinônimos ou filtro por tipo inferido. O dicionário continua disponível para administração, autocomplete e resolução dos filtros explícitos.
- `caneca cafe` gera `+caneca* +cafe*`: palavras por prefixo e todos os termos pesquisáveis obrigatórios. `case` não corresponde a `cafe`. Um título diferente pode corresponder por evidência no documento indexado, que inclui descrição e metadados cadastrados.
- Palavras de ligação são ignoradas. Consultas sem termos pesquisáveis retornam `422 NO_SEARCHABLE_TERMS`. Termos de dois caracteres podem encontrar palavras indexadas maiores por prefixo; isso não torna palavras curtas excluídas do índice pesquisáveis. Não há fallback `LIKE`.
- Ranking por quantidade de termos atendidos; título exato; palavras inteiras no título; prefixos no título; sequência no título; score FT do título; score FT do documento; popularidade; ID. Tipos e atributos inferidos não alteram a elegibilidade ou prioridade.
- A API descarta qualquer candidato sem cobertura lexical completa antes da paginação. Assim, `kit churrasco` não continua com kits executivos, de café ou de viagem que correspondam somente a `kit`.
- `items` e `groups.primary` contêm somente resultados completos. `groups.related` e `relatedItems` são vazios; `relatedTotal` é `0`. `total` e `totalPages` consideram apenas os resultados elegíveis.
- `newest` e `popular` ordenam o mesmo conjunto completo. O cursor usa o mesmo comparador e pertence à consulta, filtros, idioma, empresa, ordenação e versões de catálogo/ranking.
- Erros de índice, catálogo incompleto, timeout e saturação retornam `503 SEARCH_UNAVAILABLE`. Não são resultados vazios nem provocam busca legada.

## Ativação e diagnóstico

`SEARCH_RANKING_PERCENTAGE` e `SEARCH_SHADOW_PERCENTAGE` são configurações históricas e não selecionam mais outro motor. `SEARCH_WRITE_SYNC_ENABLED=true` continua necessário para sincronizar alterações. A versão efetiva tem prefixo obrigatório `v6-complete:`, inclusive com um valor antigo no ambiente; chaves de cache e cursores anteriores ficam incompatíveis.

Antes de publicar, executar `npm run search:preflight`. Ele verifica índices, cobertura por empresa, token mínimo, stopwords e capacidade. Não aplicar migração ou reconstruir índices apenas para esta alteração: os dois índices existentes são reutilizados. Reconstrução/configuração do servidor é uma operação separada quando necessária.

O diagnóstico autenticado `/api/v1/search/debug` mostra `intent.positiveTerms`, `lexical`, `coverage` e `ordering`. `titleExactTerms`/`titlePrefixTerms` apontam evidência no título; `documentOnlyTerms`, no `search_text`. `score.total` é diagnóstico de cobertura, não uma soma ponderada que substitui o comparador.

Rollback requer reverter o código publicado; zerar o percentual antigo não restaura a busca legada. Não remover tabelas para reverter a versão da aplicação.

## Validação

- `npm run test:search`, `npm run type-check`, `npm run build`.
- `npm run search:golden -- 1`: referência v2, com métricas históricas de recall; não grava analytics nem Redis. As antigas exclusões por semântica da v1 não são o contrato atual.
- `npx tsx src/scripts/verifyLexicalSearchReadOnly.ts 1`: consultas SELECT no catálogo, equivalência de acentos, evidência lexical de todos os resultados, filtros, isolamento e medição de recuperação/ranking, cache local frio/quente e três consultas concorrentes. Não cria fixtures ou grava dados.
- `npm run search:smoke-legacy -- 1`: nome histórico mantido; agora valida o contrato público lexical e código com sufixo C, sem analytics/Redis.
- O benchmark k6 existente aceita `SEARCH_SMOKE=true` para 20 segundos com até três usuários. Medir HTTP com `SEARCH_CACHE_MODE=warm` e `cold` no ambiente de validação; o perfil completo continua disponível sem essa opção.

### Evidência local em 08/09/2026

MariaDB 10.3.39: os dois índices existem e a empresa 1 possui cobertura de 2.741/2.741 produtos públicos. A empresa 2 não tem documentos preparados e deve receber indisponibilidade, sem fallback. `innodb_ft_min_token_size=3`, stopwords habilitadas; `A5` retornou zero e `UV` encontrou `UV400`.

Na verificação de leitura após o corte: `cafe`/`café` retornaram os mesmos 48 produtos; `caneca cafe` caiu de 133 candidatos parciais para 18 resultados completos. `kit churrasco` retornou 68 produtos, todos com os dois termos comprovados, em 158 ms; os kits que continham apenas `kit` deixaram de entrar na API. `personalizado` recuperou e ranqueou 1.408 candidatos sem corte. Três consultas concorrentes ficaram entre 155 e 1.171 ms. São amostras a partir desta máquina, não percentis de produção nem benchmark HTTP completo.

O comportamento atual segue evidência lexical completa e prefixos, sem interpretação semântica. O golden deve ser reexecutado sempre que a versão do ranking mudar; não interpretar o gate agregado como prova de relevância editorial de todo o catálogo.

Não houve deploy, migração ou alteração de dados nesta validação. A ordem renderizada no site após publicação e a carga HTTP completa permanecem validações separadas.
