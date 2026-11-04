# Arquitetura e regras

Frontend Vanilla JS com ES Modules, roteamento por hash e chamadas HTTPS/JSON. Componentes criam elementos DOM e usam texto, nunca `innerHTML` com conteúdo de usuários. URLs externas aceitam apenas HTTP(S) e abrem com `noopener noreferrer`. O Firebase SDK cuida da sessão; nenhum registro de gestão vai ao Firebase.

O Worker separa validação compartilhada (Zod), identidade/autorização, rotas, SQL parametrizado e indicadores. Identificadores de tabelas vêm de um mapa estático, nunca da entrada do usuário. Datas calendário são ISO; timestamps UTC; hoje é calculado em `BUSINESS_TIMEZONE`, padrão America/Sao_Paulo.

## Identidade e revogação

JOSE verifica RS256, chave pública Google, `aud`, `iss`, `sub`, `exp`, `iat`, `auth_time` e limites temporais. Em **toda requisição privada**, o backend consulta `accounts:lookup` com o ID token, exige usuário correspondente e `validSince`, rejeita conta desativada/ausente e compara `auth_time` com `validSince`. Falha de rede ou resposta não verificável não libera dados. Só o cache de chaves públicas do JOSE é permitido; decisões positivas de autorização e estado local não são cacheadas.

Configuração: `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` e acesso HTTPS ao Google. A chave web é pública, mas precisa estar habilitada para a Identity Toolkit API. Restrições de chave devem permitir o uso pelo Worker; restrição exclusiva de HTTP referrer pode impedir a consulta do servidor. Não é necessário inventar nem inserir uma conta de serviço. O contrato de `accounts:lookup` e a propagação de revogação devem ser confirmados no projeto Firebase real durante a homologação. A estratégia falha fechada se `validSince` não vier na resposta.

Fontes oficiais consultadas: [verificação de tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [gerenciamento de sessões](https://firebase.google.com/docs/auth/admin/manage-sessions), [API REST Firebase Auth](https://firebase.google.com/docs/reference/rest/auth). Assinatura válida isoladamente não comprova sessão não revogada.

## Autorização

Administrador apenas quando UID verificado é exatamente igual ao secret `ADMIN_FIREBASE_UID`. Sem configuração, operações administrativas permanecem proibidas. Usuários comuns precisam de conta local ativa, e-mail verificado e vínculo ativo no projeto. O criador é somente rastreabilidade. Não há promoção no painel.

| Operação                                 | Admin | Gestor     | Colaborador | Leitor     |
| ---------------------------------------- | ----- | ---------- | ----------- | ---------- |
| Consultar                                | Todos | Vinculados | Vinculados  | Vinculados |
| Criar/excluir/arquivar/restaurar projeto | Sim   | Não        | Não         | Não        |
| Editar cadastro do projeto               | Sim   | Sim        | Não         | Não        |
| Editar gestão interna                    | Sim   | Sim        | Sim         | Não        |
| Excluir gestão interna                   | Sim   | Sim        | Não         | Não        |
| Exportar                                 | Sim   | Sim        | Não         | Não        |
| Participar do chat                       | Sim   | Sim        | Sim         | Sim        |
| Aprovar e conceder acesso                | Sim   | Não        | Não         | Não        |

Bloqueio ou retorno a pendente revoga todos os vínculos na mesma transação. Reativar não os restaura. A conta Firebase não é excluída. Auditoria grava ator, ação, alvo, projeto, mudança e horário; sem token ou conteúdo de chat. Consultas administrativas também geram registro. Não há API para editar auditoria.

`401`: identidade ausente/inválida. `403`: conta não apta ou operação proibida. `404`: recurso fora do alcance, incluindo registros trocados entre projetos e conversas diretas. `409`: versão desatualizada, conflito ou projeto arquivado. Respostas privadas têm `Cache-Control: no-store`.

## Concorrência e arquivamento

Atualizações e exclusões exigem `version`. UPDATE/DELETE condicionais e incremento atômico detectam edição concorrente; o formulário mantém os dados e pede recarregar/revisar. Um TAP ainda inexistente usa versão 0. Membros e situações de usuários também têm versão.

Arquivar preserva tabelas e mensagens, oculta da lista padrão e bloqueia mudanças na gestão até restauração pelo administrador. Membros autorizados podem consultar arquivados pelo filtro e continuar o chat. Excluir remove projeto, gestão, vínculos e chat coletivo; preserva conversas diretas e auditoria. A autorização das diretas é recalculada pelos vínculos restantes.

## Indicadores

- Progresso: concluídas / não canceladas, excluindo marcos. Denominador zero: não calculado.
- Atraso: término anterior a hoje, sem conclusão ou cancelamento.
- Próximas: hoje até hoje + 7 dias, inclusive, sem conclusão/cancelamento.
- Risco: probabilidade × impacto (1 a 3). Baixa 1–2, média 3–4, alta 6–9. Em tratamento continua pendente.
- Custo: soma dos centavos realizados. Previsto detalhado é separado do orçamento vigente do cadastro. TAP guarda orçamento e datas iniciais de referência, sem competir com os indicadores.

## Chat

Uma conversa coletiva por projeto. Diretas: par ordenado canônico único e dois participantes imutáveis. Admin não participante recebe 404. Dois usuários comuns precisam permanecer ativos e compartilhar algum vínculo ativo. O admin participante pode conversar com qualquer usuário ativo. Acesso, contagem, leitura e envio reavaliam elegibilidade.

Mensagens de 1 a 2.000 caracteres, horário e autor do servidor, limite de 30 por minuto por autor com INSERT condicional no D1. Unicidade de `(conversa, autor, client_id)` impede duplicação em retry. `seq` inteiro crescente é cursor estável, independente de timestamps iguais. Histórico inicial: 50 mais recentes em ordem crescente; antes/depois usam limites estritos. Marcadores de leitura só avançam e precisam apontar para uma mensagem da mesma conversa.

Polling incremental de 5 segundos na conversa aberta e visível; sem sobreposição; recuo até 60 segundos após falha; atualização ao retornar à aba. Logout/perda de acesso cancela requisições e limpa a interface. Não é comunicação instantânea garantida. Sem criptografia de ponta a ponta: administradores de infraestrutura podem acessar o banco. Admin pode ler coletivas; novos membros também acessam histórico.

## Exportações

JSON tem versão de esquema, UUIDs e relações. TXT/CSV contêm dados reais de gestão. CSV inclui BOM UTF-8, delimitador `;`, aspas escapadas e neutralização de fórmulas. Dinheiro usa decimal brasileiro. Chats, usuários globais e auditoria ficam fora: **não é backup integral da aplicação**.
