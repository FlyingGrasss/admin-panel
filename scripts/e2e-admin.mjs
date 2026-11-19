import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3102";
const password = process.env.ADMIN_PASSWORD || "e2e-admin-pass";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const out = { steps: [], errors };
const step = async (name, fn) => {
  try { await fn(); out.steps.push({ name, ok: true }); }
  catch (e) { out.steps.push({ name, ok: false, error: String(e).slice(0, 300) }); throw e; }
};

const slug = `e2e-koleksiyon-${Date.now().toString(36)}`;
const collectionName = `E2E Koleksiyon ${Date.now()}`;

try {
  await step("login page", async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="password"]').first().waitFor({ timeout: 15000 });
  });

  await step("login", async () => {
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: /Giriş yap/ }).click();
    await page.waitForURL(`${base}/`, { timeout: 20000 });
  });

  await step("dashboard shows empty state", async () => {
    await page.getByText(/Henüz koleksiyon yok|Koleksiyonlar/).first().waitFor({ timeout: 15000 });
  });

  await step("create collection", async () => {
    await page.getByRole("button", { name: /Yeni koleksiyon/ }).first().click();
    const dialog = page.locator("dialog[open]").last();
    await dialog.getByLabel("Koleksiyon adı").first().fill(collectionName);
    await dialog.getByLabel("Anahtar").first().fill("baslik");
    await dialog.getByLabel("Etiket").first().fill("Başlık");
    await dialog.getByRole("button", { name: "Koleksiyon oluştur" }).first().click();
    await page.waitForTimeout(2000);
    const listed = await page.request.get(`${base}/api/admin/collections`);
    out.apiAfterCreate = listed.status();
    out.apiBody = (await listed.json()).collections?.slice(-3).map((c) => ({ name: c.name, slug: c.slug })) ?? null;
    out.slug = out.apiBody?.find((c) => c.name === collectionName)?.slug ?? null;
    const banner = await page.locator('[role="alert"]').allTextContents();
    out.banners = banner;
    await page.getByText(collectionName).first().waitFor({ timeout: 20000 });
  });

  await step("open collection", async () => {
    await page.getByText(collectionName).first().click();
    await page.waitForURL(/\/koleksiyonlar\//, { timeout: 15000 });
  });

  await step("create entry", async () => {
    await page.getByRole("button", { name: /Yeni giriş/ }).first().click();
    const dialog = page.locator("dialog[open]").last();
    await dialog.getByLabel("Başlık").first().fill("E2E giriş başlığı");
    await dialog.getByRole("button", { name: /^Yayınla$/ }).click();
    await page.getByText("E2E giriş başlığı").first().waitFor({ timeout: 20000 });
  });

  await step("public api returns published entry", async () => {
    const res = await page.request.get(`${base}/api/content/${out.slug}`, { headers: { "X-Kavram-Client": "panel" } });
    out.publicStatus = res.status();
    const body = await res.json();
    out.count = body?.entries?.length ?? null;
    if (!res.ok() || !body?.entries?.length) throw new Error(`public api ${res.status()} ${JSON.stringify(body).slice(0,200)}`);
  });
} catch {}

out.title = await page.title().catch(() => null);
console.log(JSON.stringify(out, null, 2));
await browser.close();
