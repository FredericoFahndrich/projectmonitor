# Plano e decisões

1. Estrutura local vazia: preservar Git; Vite/Vanilla JS + Worker TypeScript + D1.
2. Identidade e autorização antes de qualquer CRUD privado. Administrador somente por secret ADMIN_FIREBASE_UID. Usuário comum nasce pendente.
3. Administração, membros e auditoria atômica; controle otimista por versão.
4. Gestão, indicadores reais e exportações delimitadas a dados de gestão.
5. Chat persistente com idempotência, cursores, leitura e elegibilidade reavaliada.
6. Testes locais, build, documentação e configuração externa pendente.

Não há imagens anexadas nem código preexistente. Interface segue o texto da especificação. Nenhuma publicação está autorizada. O fluxo local da skill Sites é usado sem criar recursos no serviço Sites, pois a arquitetura e hospedagem foram especificadas pelo solicitante.

Campos de gestão usam esquemas compartilhados e tabelas por entidade. Datas iniciais do TAP são referências independentes; indicadores usam o cadastro principal. Arquivamento preserva todo o conteúdo, restringe alterações de gestão e oculta o projeto da listagem padrão; administrador pode restaurar. Membros ainda podem consultar projetos arquivados pelo filtro.
