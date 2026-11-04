# Project Monitor 1.0

Aplicação local implementada com frontend estático Vite/JavaScript, Firebase Authentication (somente identidade), API TypeScript em Cloudflare Workers e persistência relacional D1. A seção 18 da especificação é a regra de autorização vigente.

**Nenhum recurso remoto foi criado ou publicado.** Sem configuração Firebase, a tela de login informa a pendência e não simula autenticação. Sem `ADMIN_FIREBASE_UID` confirmado, nenhuma pessoa recebe privilégio administrativo.

## Executar localmente

Requisitos: Node.js 24 LTS e npm. Na raiz:

```powershell
npm ci
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.dev.vars.example backend/.dev.vars
```

Preencha os arquivos com os valores do seu projeto Firebase e seu UID administrativo confirmado. Não use nome ou e-mail no lugar do UID. Depois:

```powershell
npm run migrate:local -w backend
npm run dev:api
```

Em outro terminal:

```powershell
npm run dev
```

Frontend: `http://127.0.0.1:5173`. API: `http://127.0.0.1:8787/api/health`. Dados locais em `backend/.wrangler/`, fora do Git. O frontend local usa Firebase real quando configurado; D1 permanece local. A verificação online de sessões exige rede e configuração Firebase válida.

## Testar sem credenciais reais

```powershell
npm run check
npm run test:browser
```

`npm test` usa Miniflare/workerd e migrations reais em D1 emulado, com identidades de teste injetadas somente pelo teste. Testes criptográficos exercitam RS256 e claims com chaves geradas para a execução. O teste de navegador inicia frontend + API + D1 isolados, com faixa visível **TESTE LOCAL · identidade simulada · D1 emulado**. Não existe variável de bypass de autenticação na aplicação de produção.

No Windows, os testes de navegador usam Edge instalado. Em CI Linux: `npx playwright install --with-deps chromium`. Testes não validam login Firebase remoto, Google popup real, e-mails entregues nem publicação.

## Funcionalidades

- Login, cadastro, recuperação, Google popup, verificação de e-mail, logout e persistência de sessão pelo SDK modular Firebase.
- Contas pendentes, ativas e bloqueadas; aprovação e acessos exclusivamente pelo administrador configurado no backend.
- Projetos, arquivamento/restauração e exclusão explícita; perfis gestor, colaborador e leitor aplicados na API.
- TAP, fases ordenadas, atividades, marcos, riscos, custos em centavos, qualidade, partes interessadas e referências documentais.
- Indicadores calculados sobre os registros; controle de edição concorrente por versão.
- Exportações TAP TXT, tabelas CSV e gestão do projeto JSON, sem chats ou cadastro global.
- Chat coletivo e direto, histórico persistente, paginação, mensagens não lidas, leitura, idempotência, limite de frequência e polling.
- Auditoria administrativa de consultas e alterações. Conversas diretas permanecem restritas aos participantes.

## Estrutura

```text
frontend/src/       auth, API, componentes, páginas, exports, estilos, utils
backend/src/        middleware, rotas, serviços, repositório e utilitários
backend/migrations/ esquema versionado D1
backend/tests/      integração D1 e verificação criptográfica
shared/            campos, validação e matriz de riscos
frontend/tests/     exportações e conversão monetária
tests/e2e/         fluxos de navegador com identidade simulada
docs/              arquitetura, banco, API, implantação, validação e roadmap
.github/workflows/ verificações e publicação manual no Pages
```

Dependências principais: Vite, módulos oficiais `@firebase/app` e `@firebase/auth`, Zod, JOSE, Wrangler; testes com Node test runner, tsx, Miniflare e Playwright. O lockfile fixa as versões resolvidas. Firestore, Realtime Database, frameworks frontend e serviços de upload não são usados.

## Configuração e publicação

Siga [docs/deployment.md](docs/deployment.md), que inclui Firebase, D1, secrets, CORS, GitHub Pages com subdiretório e checklist de validação remota. O workflow de Pages é manual. Não basta o build passar: após uma publicação autorizada, verificar URL e fluxos reais.

Veja [docs/validation.md](docs/validation.md) para resultados e limites, [docs/architecture.md](docs/architecture.md) para segurança e regras, [docs/api.md](docs/api.md) para endpoints e [docs/roadmap.md](docs/roadmap.md) para próximas versões.
