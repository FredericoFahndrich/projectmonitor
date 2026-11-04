# Banco D1

Migrations imutáveis após publicação: `0001_core.sql` (gestão/autorização) e `0002_chat.sql` (conversas). SQL com chaves estrangeiras, CHECKs, unicidade e índices. Testes aplicam os mesmos arquivos em Miniflare D1.

| Tabela                      | Relação e finalidade                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| users                       | UID Firebase único, identificador público, identidade validada e estado local |
| projects                    | UUID, criador, orçamento vigente, versão e arquivamento                       |
| project_members             | Par projeto/UID único, perfil, estado, concessão e revogação                  |
| project_charters            | Um TAP por projeto                                                            |
| project_phases              | Fases e posição explícita                                                     |
| project_tasks               | Atividade/marco, fase do mesmo projeto, datas e situação                      |
| project_risks               | Probabilidade, impacto e tratamento                                           |
| project_costs               | Previsto e realizado em inteiros de centavos                                  |
| project_quality_checks      | Requisito, critério, resultado e evidência externa                            |
| project_stakeholders        | Cadastro de pessoas; não concede acesso                                       |
| project_documents           | Referências HTTP(S); não armazena arquivos                                    |
| conversations               | Projeto único ou par direto canônico único                                    |
| direct_conversation_members | Participantes imutáveis da direta                                             |
| messages                    | Sequência, UUID, texto e client_id idempotente                                |
| conversation_reads          | Última sequência lida por usuário/conversa                                    |
| admin_audit_logs            | Eventos administrativos preservados após exclusão do projeto                  |

Fase com atividades não pode ser excluída antes de mover/desvincular as atividades. A FK composta `(phase_id,project_id)` impede referência a fase de outro projeto. Exclusão de projeto é cascata para gestão e coletiva; auditoria não tem FK de cascata para o projeto e diretas têm `project_id=NULL`.

Custos individuais limitados a 999.999.999.999 centavos. Datas são validadas como dias reais. Entidades editáveis têm versão inteira. Mutações administrativas usam batch transacional D1 para persistir operação e auditoria. D1 local fica em `.wrangler`, nunca deve ser enviado ao Git.
