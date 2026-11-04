# Comece aqui — pacote completo para o GitHub

Este pacote contém a aplicação completa: frontend, backend, banco D1 (migrations), código compartilhado, testes, documentação e workflows. Inclui também Project-Monitor-independente.html, uma opção local separada que não usa Firebase nem Cloudflare e não sincroniza seus dados com a aplicação completa.

## Enviar para o repositório projectmonitor

1. Extraia o ZIP no computador.
2. Envie o CONTEÚDO extraído para a raiz do repositório projectmonitor. Não envie apenas o ZIP e não coloque tudo em uma pasta extra.
3. Preserve os nomes e a estrutura das pastas, inclusive .github, .gitignore, frontend/.env.example e backend/.dev.vars.example. Verifique os arquivos ocultos na ferramenta usada para enviar.
4. Confirme que package.json, package-lock.json, README.md e as pastas frontend, backend, shared, scripts, docs, tests e .github aparecem na raiz.
5. O README deste pacote substitui o aviso anterior de código incompleto. Não envie node_modules, dist, bancos locais, .env.local, .dev.vars, tokens ou chaves privadas.

## Configurar depois do envio

A arquitetura preparada é: GitHub Pages para o site, Cloudflare Workers para a API, Cloudflare D1 para os dados e Firebase Authentication para login.

Siga docs/deployment.md. Ordem sugerida:

1. Firebase: criar/selecionar projeto, registrar aplicativo Web e habilitar os provedores E-mail/senha e Google.
2. Cloudflare: criar D1, preencher o database_id verdadeiro em backend/wrangler.jsonc e configurar os dados públicos do Firebase. Aplicar as migrations no banco correto.
3. Criar sua conta Firebase, confirmar seu UID e configurar ADMIN_FIREBASE_UID como secret do Worker. Nunca colocar esse secret no repositório.
4. Configurar ALLOWED_ORIGINS com https://fredericofahndrich.github.io, se usar GitHub Pages sem domínio próprio, e publicar o Worker.
5. Configurar as variáveis do workflow Pages descritas em docs/deployment.md. Para este repositório, VITE_BASE_PATH deve ser /projectmonitor/. VITE_API_URL deve conter a URL HTTPS real do Worker.
6. Autorizar o domínio do site no Firebase e executar manualmente o workflow de publicação do Pages.
7. Testar login, permissões, persistência e chat no ambiente publicado.

Não é necessário criar index.html na raiz do código-fonte: o workflow publica frontend/dist, gerado pelo build. O ZIP contém os fontes, não uma publicação já pronta com serviços configurados.

As configurações reais de Firebase, Cloudflare e administrador ainda estão pendentes. Este pacote não publica serviços automaticamente. Para conferir localmente: npm ci, seguido de npm run check. As instruções completas estão no README.md.