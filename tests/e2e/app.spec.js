import { expect, test } from "@playwright/test";

test("3HK Hub loads and renders the graph canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/3HK Hub/);
  await expect(page.getByRole("heading", { name: "3HK Hub", exact: true })).toBeVisible();
  const canvas = page.locator("#graphCanvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(300);
  expect(box?.height).toBeGreaterThan(300);
  await expect(page.getByRole("button", { name: "查看完整产品说明" })).toBeVisible();
  await page.getByRole("button", { name: "查看完整产品说明" }).click();
  await expect(page.getByRole("heading", { name: "从线索录入到机会推进的完整 Hub 产品" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "团队每天如何把 Hub 跑起来" })).toBeVisible();
  await page.locator("#closeProductGuideButton").click();

  await page.getByRole("button", { name: "访客注册" }).click();
  await page.locator("#visitorEmail").fill("visitor@example.com");
  await page.locator("#visitorName").fill("Visitor");
  await page.getByRole("button", { name: "完成注册" }).click();
  await expect(page.getByRole("button", { name: "访客已登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "访客资料" })).toBeVisible();
});
