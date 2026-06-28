import { expect, test } from "@playwright/test";

const BASE_URL = process.env.NC_BASE_URL || "https://lucasvenancio0110.github.io/neodent-cnc";
const API_URL = process.env.NC_API_URL || "https://neodent-cnc-api.lucassantanals0110.workers.dev";
const LOGIN = process.env.NC_LOGIN;
const PASSWORD = process.env.NC_PASSWORD;

test.describe("Neodent CNC - fluxo principal", () => {
  test.skip(!LOGIN || !PASSWORD, "Configure os secrets NC_LOGIN e NC_PASSWORD no GitHub Actions.");

  test.beforeEach(async ({ page }) => {
    const status = await page.request.get(`${API_URL}/status`);
    expect(status.ok(), "API precisa responder /status").toBeTruthy();
  });

  test("login, abrir card, assumir apoio e concluir", async ({ page }, testInfo) => {
    const stamp = Date.now();
    const tnl = String(900 + Math.floor(Math.random() * 90));
    const motivo = `Teste robo Playwright ${stamp}`;
    const detalhe = `Card criado automaticamente pelo GitHub Actions em ${new Date().toISOString()}`;

    await page.goto(`${BASE_URL}/login.html`, { waitUntil: "networkidle" });
    await page.locator("input[name='login']").fill(LOGIN);
    await page.locator("input[name='senha']").fill(PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).toHaveURL(/index\.html/);
    await page.screenshot({ path: testInfo.outputPath("01-login-ok.png"), fullPage: true });

    await page.goto(`${BASE_URL}/preparadores.html`, { waitUntil: "networkidle" });
    await page.locator("input[name='tnl']").fill(tnl);
    await page.locator("input[name='celula']").fill("Teste Robo");
    await page.locator("select[name='status']").selectOption("AJUSTE");
    await page.locator("select[name='precisa_apoio']").selectOption("1");
    await page.locator("input[name='motivo']").fill(motivo);
    await page.locator("select[name='prioridade']").selectOption("ALTA");
    await page.locator("textarea[name='detalhe']").fill(detalhe);
    await page.getByRole("button", { name: /abrir card/i }).click();
    await expect(page.getByText(/card aberto com sucesso/i)).toBeVisible();
    await expect(page.getByText(motivo)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("02-preparadores-card-aberto.png"), fullPage: true });

    await page.goto(`${BASE_URL}/painel.html`, { waitUntil: "networkidle" });
    const card = page.locator("article.machine-card").filter({ hasText: motivo }).first();
    await expect(card).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("03-painel-card-visivel.png"), fullPage: true });

    const assumir = card.getByRole("button", { name: /vou atender/i });
    if (await assumir.isVisible().catch(() => false)) {
      await assumir.click();
      await expect(page.locator("article.machine-card").filter({ hasText: motivo }).first()).toContainText(/em_atendimento|em atendimento|apoio/i);
    }
    await page.screenshot({ path: testInfo.outputPath("04-painel-apoio-assumido.png"), fullPage: true });

    const cardAtualizado = page.locator("article.machine-card").filter({ hasText: motivo }).first();
    await cardAtualizado.getByRole("button", { name: /concluir/i }).click();
    await expect(page.locator("article.machine-card").filter({ hasText: motivo })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("05-painel-card-concluido.png"), fullPage: true });
  });
});
