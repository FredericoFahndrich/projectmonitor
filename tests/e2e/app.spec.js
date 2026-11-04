import { test, expect } from "@playwright/test";
async function login(page, name) {
  await page.goto("./");
  await page.getByLabel("E-mail", { exact: true }).fill(`${name}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("local-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
test("fluxo de interface → API → D1, persistência, arquivamento e chat seguro", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Meus Projetos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Novo Projeto" }).click();
  await page.getByLabel("Nome *", { exact: true }).fill("Projeto navegador");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Persistência local validada");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Projeto navegador" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Projeto navegador" }).click();
  await expect(page.getByText("Não calculado", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "TAP e Escopo", exact: true }).click();
  await page
    .getByLabel("Objetivo", { exact: true })
    .fill("Objetivo salvo no D1");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Registro salvo com sucesso.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Objetivo", { exact: true })).toHaveValue(
    "Objetivo salvo no D1",
  );
  await page
    .getByLabel("Objetivo", { exact: true })
    .fill("Alteração descartada");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByLabel("Objetivo", { exact: true })).toHaveValue(
    "Objetivo salvo no D1",
  );
  await page.getByRole("link", { name: "Cronograma", exact: true }).click();
  await page.getByRole("button", { name: "Gerenciar fases" }).click();
  await page.getByRole("button", { name: "+ Adicionar" }).click();
  await page.getByLabel("Nome da fase *").fill("Execução");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Execução", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar às atividades" }).click();
  await page.getByRole("button", { name: "+ Adicionar" }).click();
  await page.getByLabel("Título *").fill("Primeira atividade");
  await page
    .getByLabel("Fase", { exact: true })
    .selectOption({ label: "Execução" });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Primeira atividade" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Visão Geral", exact: true }).click();
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/project-overview.png",
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  expect((await download).suggestedFilename()).toBe("projeto.json");
  const projectHash = new URL(page.url()).hash;
  await page.getByRole("link", { name: /^Chat/ }).click();
  await page
    .getByRole("textbox", { name: "Sua mensagem" })
    .fill("<script>window.pwned=true</script>");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator(".message p")).toHaveText(
    "<script>window.pwned=true</script>",
  );
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  await page.reload();
  await expect(page.locator(".message p")).toHaveText(
    "<script>window.pwned=true</script>",
  );
  await page.getByRole("link", { name: "Meus Projetos", exact: true }).click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Projeto navegador" }),
  ).toHaveCount(0);
  await page.getByLabel("Arquivados").check();
  await expect(
    page.getByRole("link", { name: "Projeto navegador" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByLabel("Arquivados").uncheck();
  await expect(
    page.getByRole("link", { name: "Projeto navegador" }),
  ).toBeVisible();
  const context = await browser.newContext({
      baseURL: "http://127.0.0.1:5178/project-monitor/",
    }),
    user = await context.newPage();
  await login(user, "alice");
  await expect(
    user.getByRole("heading", { name: "Aguardando aprovação" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Administração de usuários" }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText("alice", { exact: true }) });
  await row.getByRole("button", { name: "Aprovar / reativar" }).click();
  await expect(
    row.getByRole("cell", { name: "ativa", exact: true }),
  ).toBeVisible();
  await user.getByRole("button", { name: "Verificar novamente" }).click();
  await expect(
    user.getByText("Você ainda não recebeu acesso a projetos nesta listagem."),
  ).toBeVisible();
  await row.getByRole("button", { name: "Acessos", exact: true }).click();
  await page.getByRole("button", { name: "Conceder / alterar" }).click();
  await expect(
    page.getByRole("dialog").getByText("ativo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await user.reload();
  await user.getByRole("link", { name: "Projeto navegador" }).click();
  await expect(user.getByRole("button", { name: "Exportar JSON" })).toHaveCount(
    0,
  );
  await user.getByRole("link", { name: /^Chat/ }).click();
  await expect(user.locator(".message p")).toHaveText(
    "<script>window.pwned=true</script>",
  );
  await user.getByRole("link", { name: "Mensagens", exact: true }).click();
  await user.getByLabel("Destinatário").selectOption({ index: 1 });
  await user.getByRole("button", { name: "Iniciar conversa" }).click();
  await user
    .getByRole("textbox", { name: "Sua mensagem" })
    .fill("Conversa direta persistida");
  await user.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(user.locator(".message p")).toHaveText(
    "Conversa direta persistida",
  );
  await page.getByRole("link", { name: "Mensagens", exact: true }).click();
  await expect(page.locator(".conversation-list")).toContainText("1 não lidas");
  await page.locator(".conversation-list a").click();
  await expect(page.locator(".conversation-list")).toContainText("0 não lidas");
  await expect(page.locator(".message p")).toHaveText(
    "Conversa direta persistida",
  );
  await page.getByRole("link", { name: "Administração de usuários" }).click();
  await row.getByRole("button", { name: "Bloquear", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    user.getByText("Sua conta está bloqueada", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(user.locator(".message")).toHaveCount(0);
  await context.close();
  await page.goto(`./${projectHash}`);
  await expect(
    page.getByRole("heading", { name: "Projeto navegador" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("login, validação, navegação por hash e estado de rede", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Project Monitor" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/login.png", fullPage: true });
  await page.getByRole("button", { name: "Mostrar", exact: true }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await login(page, "admin");
  await page.route("**/api/projects?*", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Falha de rede");
  await page.unroute("**/api/projects?*");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Meus Projetos" }),
  ).toBeVisible();
});
