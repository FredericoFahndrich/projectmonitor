# Validação local — 02/11/2026

## Resultado

- `npm run typecheck`: aprovado.
- `npm test`: 10 testes aprovados, nenhum ignorado ou falho na rodada final. Cada teste de integração contém várias operações e asserções.
- `npm run test:browser`: 2 cenários completos aprovados em Edge headless (47,1 segundos na rodada validada).
- `npm run build`: frontend compilado. Avisos de comentários PURE do Zod são de otimização, sem impedir o build.
- Build adicional com `--base=/project-monitor/`: aprovado; referências de assets no HTML usam o subdiretório. Os fluxos de navegador também foram executados com essa base e rotas por hash.
- `npm run migrate:local -w backend`: as duas migrations aplicadas pelo Wrangler ao D1 local, 34 comandos SQL.
- `wrangler deploy --dry-run`: bundle do Worker gerado, sem publicação. O sandbox impediu somente a escrita do log de diagnóstico na pasta global do Wrangler.
- Worker real executado localmente por `wrangler dev`: `/api/health` retornou 200; `/api/projects` sem token retornou 401.
- Instalação final: auditoria npm reportou **zero vulnerabilidades**. SDK Firebase restrito aos módulos oficiais App/Auth; overrides atualizam dependências transitivas de ferramentas locais.
- Capturas de login e painel revisadas visualmente em 1440 px. Sem imagens de referência anexadas; design baseado nas diretrizes textuais.

## Cobertura automatizada

Identidade: assinatura RS256 real com chaves de teste, audience, issuer, expiração, emissão futura, auth_time, subject, assinatura errada; consulta de conta a cada chamada; conta ausente/desativada/revogada; falha de rede fechada. Token ausente/inválido rejeitado. Esses testes usam respostas Firebase simuladas explicitamente.

Autorização: cadastro pendente, aprovação sem projeto, UID global exato, configuração ausente, e-mail não verificado, impossibilidade de enviar owner/admin pelo cliente, matriz de criação/edição/exclusão/exportação, acesso cruzado a projeto/registro/fase, conflito de versão, arquivamento/restauração e exclusão.

Gestão: CRUD de projetos, fases e tarefas; TAP recuperado; riscos/custos; qualidade, partes interessadas e documentos; URLs perigosas e datas inválidas rejeitadas. Progresso com marcos/canceladas, janela de sete dias, fuso brasileiro e soma em centavos. CSV BOM/acentos/aspas/fórmulas e JSON com relações sem chats.

Chat: par direto idempotente, administrador não participante negado, terceiros negados, apenas destinatários elegíveis sem e-mail global, texto persistido, limite de tamanho/frequência, retry sem duplicação, páginas sem sobreposição, busca incremental, não lidas/marcadores, mensagem de outra conversa rejeitada, perda de vínculo para ambos, bloqueio com a mesma identidade, reativação sem restauração de vínculos e preservação de diretas após exclusão do projeto. Auditoria sem texto da conversa.

Navegador → HTTP → API → D1 local: login simulado explícito, criação de projeto, TAP salvo/recarregado, fase/atividade, indicadores, download JSON, arquivar/restaurar, coletiva persistente após reload, script exibido como texto sem execução, conta pendente, aprovação sem vínculo, concessão de leitor, acesso ao histórico, direta com contador de não lidas, bloqueio limpando a conversa no polling, hash em subdiretório, erro de rede e recuperação.

Erros encontrados e corrigidos durante as rodadas: parêntese no painel administrativo, tipagem do retorno de autorização, rótulos acessíveis de senha e select, transição assíncrona entre atividades/fases e texto `null` em área opcional. As falhas anteriores não são contadas como aprovação; os resultados acima são das rodadas posteriores às correções.

## Limites e pendências externas

**Nenhuma integração remota foi validada.** Ainda faltam configuração Firebase pública, UID administrativo confirmado, conta/banco D1 real, URL Worker, origens CORS, repositório e base GitHub Pages. Não foram criados recursos, enviadas mensagens reais ou publicadas versões nas contas do proprietário.

Cadastro/login Google e e-mail reais, entrega dos e-mails, revogação/desativação/exclusão reais no Firebase, acesso a D1 remoto e URL publicada exigem a homologação de `deployment.md`. Testes simulados não comprovam esses pontos.

A revisão visual cobriu login e painel; não equivale a uma auditoria completa de acessibilidade de todas as telas, navegadores ou tamanhos. Não houve teste de carga. Listagens de projetos/gestão/conversas são adequadas ao escopo inicial de poucos projetos; a listagem administrativa e o histórico de mensagens têm paginação. Não há backup completo da aplicação pela exportação JSON de gestão.

Artefatos locais de teste (ignorados pelo Git): `test-results/login.png`, `test-results/project-overview.png`. O harness usa banco efêmero independente de `backend/.wrangler` e não está presente no build de produção.
