# API REST

Prefixo `/api`. Exceto `GET /health`, todas as rotas exigem `Authorization: Bearer <Firebase ID Token>`. JSON de sucesso: `{ "data": ... }`; erro: `{ "error": { "message": "..." } }`. Corpos limitados a 64 KiB. CORS só para origens exatas configuradas.

| Rota                                                                    | Métodos                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------ |
| /health                                                                 | GET                                                    |
| /me                                                                     | GET — cadastro local idempotente e permissões efetivas |
| /projects                                                               | GET (`archived=true` opcional), POST admin             |
| /projects/:id                                                           | GET, PATCH, DELETE                                     |
| /projects/:id/archive                                                   | PUT `{archived,version}` admin                         |
| /projects/:id/summary                                                   | GET                                                    |
| /projects/:id/export                                                    | GET dados de gestão para exportação autorizada         |
| /projects/:id/charter                                                   | GET, PUT                                               |
| /projects/:id/{phases,tasks,risks,costs,quality,stakeholders,documents} | GET, POST                                              |
| /projects/:id/:resource/:recordId                                       | GET, PATCH, DELETE                                     |
| /admin/users                                                            | GET `q`, `status`, `page`, páginas de 20               |
| /admin/users/:uid/status                                                | PATCH `{status,version}`                               |
| /admin/projects/:id/members                                             | GET                                                    |
| /admin/projects/:id/members/:uid                                        | PUT `{role,version}`, DELETE `{version}`               |
| /admin/audit-logs                                                       | GET `page`, páginas de 20                              |
| /projects/:id/chat                                                      | GET resolução da coletiva                              |
| /chat/eligible-users                                                    | GET nomes/identificadores públicos, sem e-mail global  |
| /conversations                                                          | GET apenas conversas acessíveis e não lidas            |
| /conversations/direct                                                   | POST `{recipient_public_id}`                           |
| /conversations/:id/messages                                             | GET (`before` ou `after`), POST `{text,client_id}`     |
| /conversations/:id/read                                                 | PUT `{message_id}`                                     |

PATCH da gestão recebe o conjunto de campos editáveis do formulário e `version` lida anteriormente. Campos desconhecidos são rejeitados. Não enviar `id`, `project_id`, `owner_uid`, timestamps ou papéis de admin. Criação do TAP e primeira concessão de vínculo usam `version:0`; edições usam versão positiva. Exclusões de gestão recebem `{version}` no corpo.

Histórico: resposta `{items,has_more,next_after,next_before}`. Sem cursor recebe até 50 últimas mensagens. Para recuperar antigas, `before=next_before`; para atualização incremental, `after=next_after`, repetindo enquanto `has_more`. Ordenação por seq, limites exclusivos. ID do cliente UUID deve ser reutilizado no retry; texto diferente com o mesmo identificador retorna 409. Rate limit retorna 429 e Retry-After.

Esquemas de campos e enumerações estão em `shared/models.js`; matriz de acesso em `docs/architecture.md`.
