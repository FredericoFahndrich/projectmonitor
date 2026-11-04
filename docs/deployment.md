# Configuração e implantação — pendente de autorização remota

## Firebase

1. Criar/selecionar projeto Firebase, registrar aplicativo Web e copiar configuração pública.
2. Habilitar Authentication: E-mail/senha e Google. Configurar nome público e e-mail de suporte do provedor.
3. Em Authentication → Settings → Authorized domains, adicionar domínio do GitHub Pages (hostname, sem caminho), domínio personalizado quando houver e os hosts de desenvolvimento necessários. Projetos novos podem não incluir localhost automaticamente.
4. Preencher `frontend/.env.local`: API URL, API key, auth domain, project ID, app ID. Em produção a URL da API precisa ser HTTPS.
5. Preencher `backend/.dev.vars`: project ID e Web API key iguais ao frontend. Ativar Identity Toolkit API e verificar restrições da chave para consulta pelo Worker.
6. Entrar/criar sua conta, localizar o UID em Authentication → Users e **confirmá-lo explicitamente** antes de configurar `ADMIN_FIREBASE_UID`. Não há administrador inicial presumido.
7. Testar e-mail de verificação, recuperação, Google popup e persistência. Usuários comuns só entram na gestão após e-mail verificado, aprovação e concessão de projeto.

SDK usa `signInWithPopup`, não redirecionamento. Configuração pública Firebase não é credencial de serviço. Nunca inserir conta de serviço, chave privada, senha ou token de deploy no frontend/repositório.

## D1 e Worker

Os comandos abaixo são **instruções**, não foram executados remotamente. Executar somente depois da autorização do proprietário e seleção da conta correta.

```powershell
cd backend
npx wrangler login
npx wrangler d1 create project-monitor
```

Copiar o `database_id` real retornado para `backend/wrangler.jsonc`. Não usar UUID inventado. Definir `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `BUSINESS_TIMEZONE` e `ALLOWED_ORIGINS` com origens exatas separadas por vírgula. A origem Pages é `https://USUARIO.github.io` (sem o subdiretório). Excluir origens locais da configuração de produção quando não necessárias.

```powershell
npx wrangler d1 migrations apply project-monitor --local
# Após autorização para criar/migrar o banco remoto:
npx wrangler d1 migrations apply project-monitor --remote
# Informar o UID confirmado no prompt protegido, não na linha de comando:
npx wrangler secret put ADMIN_FIREBASE_UID
npx wrangler deploy
```

O secret de produção não fica no wrangler.jsonc. Em desenvolvimento, `.dev.vars` é ignorado pelo Git. Para trocar o administrador: confirmar o novo UID, registrar a decisão fora da aplicação e substituir o secret por Wrangler. Não há promoção por API. O antigo administrador perde acesso global na próxima requisição e precisa de estado ativo/vínculos explícitos como conta comum. Desfazer a troca exige restaurar o UID previamente confirmado, sem adivinhação.

Antes de futuras migrations remotas: obter backup real, confirmar banco/conta e aplicar somente migrations revisadas. Nunca restaurar automaticamente backup sobre dados mais novos.

## GitHub Pages

1. Criar/selecionar repositório e enviar código somente após autorização.
2. Settings → Pages → Source: GitHub Actions.
3. Configurar Repository Variables: `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_BASE_PATH`.
4. Para Pages de repositório, `VITE_BASE_PATH=/NOME-DO-REPOSITORIO/`. Para domínio personalizado ou site de usuário: `/`.
5. Executar manualmente workflow **Publicar GitHub Pages** somente após autorização. Não existe deploy automático em push.

O build gera `frontend/dist/index.html` na raiz do artefato. Rotas `#/projects`, `#/projects/:id`, `#/admin/users`, `#/messages/:id` funcionam sem rewrite de servidor. O workflow bloqueia publicação sem configuração pública obrigatória e executa typecheck/testes/build antes de publicar.

## Homologação remota obrigatória

- URL publicada abre na raiz e com hash direto após reload; assets corretos no subdiretório.
- Login e-mail/senha, cadastro pendente, verificação enviada/confirmada, recuperação, Google, logout e sessão restaurada.
- UID administrativo confirmado acessa projetos futuros; outro usuário não pode se promover.
- Aprovar sem vínculo não libera projeto. Gestor, colaborador e leitor respeitam chamadas diretas à API.
- Bloquear/revogar com token ainda válido nega a próxima operação, inclusive polling e contagens.
- Firebase: desativar conta de teste, revogar sessões e excluir conta de teste; confirmar negação do mesmo ID token antigo. Confirmar comportamento e presença de `validSince` em `accounts:lookup`.
- CRUD persiste após reload e nova sessão. Custos, datas, progresso e exportações reais conferem.
- Diretas entre duas contas não aparecem para admin não participante. Perda de vínculo impede ambos os participantes até restabelecer elegibilidade.
- Arquivar/restaurar preserva dados; exclusão remove coletiva e gestão, preservando diretas/auditoria.
- Tokens e mensagens não aparecem em logs. D1 e secrets correspondem à conta pretendida.

Sem essas verificações, não declarar produção validada.
