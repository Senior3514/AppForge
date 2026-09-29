import { expect, test } from "@playwright/test";

test("prompt → phone preview → 'add a loyalty tab' → undo", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Salon booking" }).click();
  await expect(page).toHaveURL(/\/en\/studio\?prompt=/);

  const phone = page.getByTestId("phone");
  await expect(phone.getByRole("tab", { name: "Book" })).toBeVisible();
  await expect(phone.getByRole("tab", { name: "Rewards" })).toHaveCount(0);

  await page.getByLabel("Describe the app you want to build…").fill("add a loyalty tab");
  await page.getByRole("button", { name: "→" }).click();
  await expect(phone.getByRole("tab", { name: "Rewards" })).toBeVisible();
  await expect(page.getByText("Added screens", { exact: false }).first()).toBeVisible();

  await phone.getByRole("tab", { name: "Rewards" }).click();
  await phone.getByRole("button", { name: "+1" }).click();
  await expect(phone.getByText("1/10", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(phone.getByRole("tab", { name: "Rewards" })).toHaveCount(0);
});

test("Hebrew prompt renders an RTL app in an RTL page", async ({ page }) => {
  await page.goto("/he/studio?prompt=" + encodeURIComponent("אפליקציה למסעדה שלי"));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const inner = page.getByTestId("phone").locator("[dir]");
  await expect(inner).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("phone").getByRole("tab", { name: "תפריט" })).toBeVisible();
});

test("preview language switch and RTL toggle", async ({ page }) => {
  await page.goto("/en/studio?prompt=cafe");
  const inner = page.getByTestId("phone").locator("[dir]");
  await expect(inner).toHaveAttribute("dir", "ltr");
  await page.getByLabel("RTL").check();
  await expect(inner).toHaveAttribute("dir", "rtl");
});

test("landing page has all 8 languages and example chips", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("navigation", { name: "Language" }).getByRole("link")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "مطعم" })).toBeVisible();
});
