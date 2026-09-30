import { expect, test, type Page } from "@playwright/test";

const phone = (page: Page) => page.getByTestId("phone");

// Each test is a distinct client to the API's per-IP rate limits (the proxy forwards the last X-Forwarded-For entry).
let ipCounter = 0;
test.beforeEach(async ({ page }) => {
  const n = ++ipCounter;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${Math.floor(n / 250)}.${(n % 250) + 1}` });
});
let n = 0;
const email = () => `e2e${Date.now()}${++n}@example.com`;

async function generate(page: Page, chip: string, locale = "en") {
  await page.goto(`/${locale}`);
  await page.waitForLoadState("networkidle"); // the chip is server-rendered; wait until React has attached its handler
  await page.getByRole("button", { name: chip }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}/);
}

test("anonymous: prompt → persisted app → chat edit → undo; survives reload", async ({ page }) => {
  await generate(page, "Salon booking");
  await expect(phone(page).getByRole("tab", { name: "Book" })).toBeVisible();
  await expect(phone(page).getByRole("tab", { name: "Rewards" })).toHaveCount(0);

  await page.getByRole("textbox", { name: "Chat" }).fill("add a loyalty tab");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(phone(page).getByRole("tab", { name: "Rewards" })).toBeVisible();

  await page.reload(); // proves it is stored server-side
  await expect(phone(page).getByRole("tab", { name: "Rewards" })).toBeVisible();
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(phone(page).getByRole("tab", { name: "Rewards" })).toHaveCount(0);
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect(phone(page).getByRole("tab", { name: "Rewards" })).toBeVisible();
});

test("inspector: rename, tab reorder, add module, edit data row, translation; history lists each change", async ({ page }) => {
  await generate(page, "Restaurant");
  const inspector = page.getByRole("region", { name: "Edit" });

  await inspector.getByLabel("Name", { exact: true }).fill("Bean Bar");
  await inspector.getByLabel("Name", { exact: true }).press("Enter");
  await expect(page.getByRole("heading", { name: "Bean Bar" })).toBeVisible();
  await expect(phone(page).getByText("Bean Bar").first()).toBeVisible();

  const tabs = phone(page).getByRole("tab");
  const first = await tabs.first().innerText();
  await inspector.getByRole("button", { name: "Move down" }).first().click();
  await expect(tabs.last()).not.toHaveText(first);
  await expect(tabs.nth(1)).toHaveText(first);

  await inspector.getByLabel("Add a module").selectOption("contact");
  await inspector.getByRole("button", { name: /Add a module/ }).click();

  await inspector.getByText("Content", { exact: true }).click(); // sections are collapsible
  await inspector.getByLabel("menu 1 name").fill("Flat white");
  await inspector.getByLabel("menu 1 name").press("Tab");
  await phone(page).getByRole("tab", { name: "Menu" }).click();
  await expect(phone(page).getByText("Flat white")).toBeVisible();

  await inspector.getByText("Translations", { exact: true }).click();
  await inspector.getByLabel("Translate into").selectOption("fr");
  await inspector.getByText("Bean Bar").first().locator("input").fill("Le Bar à Fèves");
  await inspector.getByText("Bean Bar").first().locator("input").press("Tab");
  await page.getByLabel("Preview language").selectOption("fr");
  await expect(phone(page).getByText("Le Bar à Fèves").first()).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  const hist = page.getByRole("list", { name: "History" });
  await expect(hist.getByText("Manual").first()).toBeVisible();
  expect(await hist.getByRole("listitem").count()).toBeGreaterThanOrEqual(5);
});

test("signup keeps the anonymous draft; dashboard lists it; logout/login round-trips", async ({ page }) => {
  await generate(page, "Fitness coach");
  const studioUrl = page.url();
  await page.getByRole("link", { name: "Get started" }).first().click();
  const e = email();
  await page.getByLabel("Email").fill(e);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: "Open studio" })).toBeVisible();
  await page.getByRole("link", { name: "Open studio" }).click();
  await expect(page).toHaveURL(studioUrl);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(e);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("publish → public spec; QR share link opens a public preview; revoke closes it", async ({ page, browser }) => {
  await generate(page, "Salon booking");
  await page.getByRole("link", { name: "Get started" }).first().click();
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: "Open studio" }).click();

  await page.getByRole("button", { name: /Preview on your phone/ }).click();
  await page.getByRole("button", { name: "Preview on your phone", exact: true }).last().click();
  const link = await page.getByLabel("link").inputValue();
  expect(link).toMatch(/\/en\/preview\/[\w-]{10,}/);
  await expect(page.getByAltText("QR")).toBeVisible();

  const anon = await browser.newContext();
  const p2 = await anon.newPage();
  await p2.goto(link.replace("http://localhost:3111", ""));
  await expect(phone(p2)).toBeVisible();
  await expect(phone(p2).getByRole("tab", { name: "Book" })).toBeVisible();

  await page.getByRole("button", { name: "Stop sharing" }).click();
  await p2.reload();
  await expect(p2.getByText("This preview link is not active.")).toBeVisible();
  await anon.close();

  await page.getByRole("link", { name: "Publish and manage" }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/^Published /)).toBeVisible();
  await expect(page.getByText("Enroll in the Apple Developer Program")).toBeVisible();
  await expect(page.getByText("Create a Google Play Console account")).toBeVisible();
});

test("admin: store listing, brand kit, builds need a plan then run in demo mode; bookings inbox", async ({ page, request }) => {
  await generate(page, "Salon booking");
  await page.getByRole("link", { name: "Get started" }).first().click();
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: "Manage" }).click();

  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("button", { name: "Start build" }).click();
  await expect(page.getByText("Store builds need a paid plan.")).toBeVisible();

  await page.goto("/en/pricing");
  await page.getByRole("button", { name: "Start free trial" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Start build" }).click();
  await expect(page.getByText(/SIMULATED build/)).toBeVisible();
  await expect(page.getByText("Demo mode: no real build is produced.")).toBeVisible();

  await page.getByRole("button", { name: "Generate listing" }).click();
  await expect(page.getByText("Data safety answers")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(/\w+/);

  // An end user books through the public API of the published app; the owner sees it in the inbox.
  const appId = page.url().match(/apps\/([0-9a-f-]{36})/)![1]!;
  const booked = await request.post(`/api/v1/public/apps/${appId}/data/bookings`, { data: { data: { name: "Dana", phone: "+972501234567" } } });
  expect(booked.status()).toBe(201);
  await page.getByRole("tab", { name: "Submissions" }).click();
  await expect(page.getByRole("cell", { name: "Dana" })).toBeVisible();

  await page.getByRole("tab", { name: "Brand kit" }).click();
  await expect(page.getByAltText("icon-1024")).toBeVisible();
  await expect.poll(async () => page.getByAltText("icon-1024").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("push campaign is recorded; demo-mode is stated honestly", async ({ page }) => {
  await generate(page, "Restaurant");
  await page.getByRole("link", { name: "Get started" }).first().click();
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await page.getByRole("tab", { name: "Notifications" }).click();
  await expect(page.getByText("Demo mode: messages are recorded")).toBeVisible();
  await page.getByLabel("Title").fill("Hello");
  await page.getByLabel("Message").fill("Fresh bread at 8");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Fresh bread at 8")).toBeVisible();
});

test("Hebrew: prompt chip → RTL app; landing is RTL with all 8 languages", async ({ page }) => {
  await generate(page, "מסעדה", "he");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(phone(page).locator("[dir]")).toHaveAttribute("dir", "rtl");
  await expect(phone(page).getByRole("tab", { name: "תפריט" })).toBeVisible();
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "مطعم" })).toBeVisible();
});

test("landing: sections, gallery, pricing and FAQ render; language switch keeps the page", async ({ page }) => {
  await page.goto("/en");
  for (const h of ["How it works", "Made with AppForge", "Everything your app needs", "Simple pricing", "Questions"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  expect(await page.getByTestId("phone").count()).toBe(3);
  await page.goto("/en/pricing");
  await page.getByLabel("Language").selectOption("de");
  await expect(page).toHaveURL(/\/de\/pricing/);
  await expect(page.getByRole("heading", { name: "Einfache Preise" })).toBeVisible();
});

test("SEO basics: sitemap, robots, hreflang alternates", async ({ request, page }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/he/pricing");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /api/");
  await page.goto("/he");
  await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
});
