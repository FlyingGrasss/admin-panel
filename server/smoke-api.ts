import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AdminStats,
  ApiErrorBody,
  CollectionResponse,
  EntryListResponse,
  EntryResponse,
  PublicEntryListResponse,
  PublicEntryResponse,
} from "../shared/types.js";
import { createApp } from "./app.js";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "./constants.js";
import type { AppContext } from "./context.js";
import { createContext } from "./context.js";

const TEST_ORIGIN = "http://localhost:3000";
const TEST_PASSWORD = "smoke-admin-parola";
const DAY_MS = 24 * 60 * 60 * 1000;

interface ApiResult {
  status: number;
  data: unknown;
  setCookie: string | null;
  cookie: string | null;
  headers: Headers;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  cookie?: string | null;
  headers?: Record<string, string>;
  omitClient?: boolean;
  origin?: string | null;
  contentType?: string;
}

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function errorPayload(data: unknown): ApiErrorBody["error"] | null {
  if (typeof data !== "object" || data === null) return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  const field = (error as { field?: unknown }).field;
  if (typeof code !== "string" || typeof message !== "string") return null;
  return {
    code: code as ApiErrorBody["error"]["code"],
    message,
    ...(typeof field === "string" ? { field } : {}),
  };
}

function errorCode(data: unknown): string {
  return errorPayload(data)?.code ?? "";
}

function errorField(data: unknown): string {
  return errorPayload(data)?.field ?? "";
}

function cookieMaxAge(setCookie: string | null): number {
  const match = /Max-Age=(\d+)/i.exec(setCookie ?? "");
  return match ? Number(match[1]) : 0;
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "kavram-smoke-"));
  let ctx: AppContext | undefined;
  let server: Server | undefined;

  try {
    ctx = createContext({
      dbPath: join(tempDir, "kavram.db"),
      allowedOrigins: [TEST_ORIGIN],
      isProduction: false,
      adminPassword: TEST_PASSWORD,
    });

    const app = createApp(ctx);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    async function api(path: string, options: ApiOptions = {}): Promise<ApiResult> {
      const method = options.method ?? "GET";
      const headers: Record<string, string> = { ...options.headers };

      if (method !== "GET" && method !== "HEAD") {
        headers["x-kavram-client"] = "panel";
        headers.origin = TEST_ORIGIN;
        headers["content-type"] = "application/json";
      }

      if (options.cookie) headers.cookie = options.cookie;
      if (options.omitClient) delete headers["x-kavram-client"];
      if (options.contentType) headers["content-type"] = options.contentType;

      if (options.origin !== undefined) {
        if (options.origin === null) delete headers.origin;
        else headers.origin = options.origin;
      }

      const body =
        options.rawBody ??
        (options.body !== undefined ? JSON.stringify(options.body) : undefined);

      const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
      const setCookie = response.headers.get("set-cookie");
      const text = await response.text();

      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      return {
        status: response.status,
        data,
        setCookie,
        cookie: setCookie ? (setCookie.split(";")[0] ?? null) : null,
        headers: response.headers,
      };
    }

    console.log("Kavram API smoke testi\n");

    console.log("Veritabanı");
    const userVersion = ctx.db.pragma("user_version", { simple: true });
    const journalMode = ctx.db.pragma("journal_mode", { simple: true });
    const foreignKeys = ctx.db.pragma("foreign_keys", { simple: true });
    const busyTimeout = ctx.db.pragma("busy_timeout", { simple: true });
    ensure(Number(userVersion) === 1, "user_version 1");
    ensure(String(journalMode).toLowerCase() === "wal", "journal_mode WAL");
    ensure(Number(foreignKeys) === 1, "foreign_keys açık");
    ensure(Number(busyTimeout) === 5000, "busy_timeout 5000");
    const entriesIndex = ctx.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
      )
      .get("idx_entries_collection_status_updated") as { name: string } | undefined;
    ensure(entriesIndex?.name === "idx_entries_collection_status_updated", "entries bileşik indeksi var");

    console.log("\nSağlık");
    const health = await api("/api/health");
    ensure(health.status === 200, "GET /api/health 200");
    ensure(
      typeof health.data === "object" &&
        health.data !== null &&
        (health.data as { ok?: unknown }).ok === true,
      "health gövdesi {ok:true}",
    );

    console.log("\nKimlik doğrulama");
    const anonMe = await api("/api/auth/me");
    ensure(anonMe.status === 401, "oturumsuz /auth/me 401");

    const anonCollections = await api("/api/admin/collections");
    ensure(anonCollections.status === 401, "oturumsuz koleksiyon listesi 401");

    const anonCreate = await api("/api/admin/collections", {
      method: "POST",
      body: { name: "Gizli", slug: "gizli", fields: [] },
    });
    ensure(anonCreate.status === 401, "oturumsuz koleksiyon oluşturma 401");

    const noClient = await api("/api/auth/login", {
      method: "POST",
      body: { password: TEST_PASSWORD },
      omitClient: true,
    });
    ensure(
      noClient.status === 403 && errorCode(noClient.data) === "CSRF_REJECTED",
      "istemci başlığı olmadan mutasyon 403",
    );

    const badOrigin = await api("/api/auth/login", {
      method: "POST",
      body: { password: TEST_PASSWORD },
      origin: "http://evil.example",
    });
    ensure(
      badOrigin.status === 403 && errorCode(badOrigin.data) === "CSRF_REJECTED",
      "izin verilmeyen Origin 403",
    );

    const wrongLogin = await api("/api/auth/login", {
      method: "POST",
      body: { password: "yanlis-parola" },
    });
    ensure(wrongLogin.status === 401, "yanlış parola 401");
    ensure(
      errorCode(wrongLogin.data) === "INVALID_CREDENTIALS",
      "yanlış parola INVALID_CREDENTIALS",
    );

    const login = await api("/api/auth/login", {
      method: "POST",
      body: { password: TEST_PASSWORD },
    });
    ensure(login.status === 200, "doğru parola 200");
    ensure(
      typeof login.cookie === "string" &&
        login.cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
      "kavram_session çerezi verildi",
    );
    ensure(
      /HttpOnly/i.test(login.setCookie ?? "") &&
        /SameSite=Lax/i.test(login.setCookie ?? "") &&
        /Path=\//.test(login.setCookie ?? ""),
      "çerez HttpOnly, SameSite=Lax, Path=/",
    );
    ensure(
      cookieMaxAge(login.setCookie) > 29 * (DAY_MS / 1000),
      "oturum 30 gün (Max-Age)",
    );

    const cookie = login.cookie as string;
    const rawToken = cookie.slice(`${SESSION_COOKIE_NAME}=`.length);
    const expectedHash = createHash("sha256").update(rawToken).digest("hex");
    const sessionRow = ctx.db
      .prepare("SELECT token_hash FROM admin_sessions ORDER BY created_at DESC LIMIT 1")
      .get() as { token_hash: string } | undefined;
    ensure(sessionRow?.token_hash === expectedHash, "oturum token'ı DB'de SHA-256 olarak saklanıyor");
    ensure(sessionRow?.token_hash !== rawToken, "ham token DB'de yok");
    ensure(rawToken.length === 43, "oturum token'ı 32 bayt (base64url)");
    ensure(SESSION_TTL_MS === 30 * DAY_MS, "oturum TTL sabiti 30 gün");

    const me = await api("/api/auth/me", { cookie });
    ensure(me.status === 200, "çerezle /auth/me 200");
    ensure(
      typeof me.data === "object" &&
        me.data !== null &&
        (me.data as { authenticated?: unknown }).authenticated === true,
      "me gövdesi authenticated=true",
    );

    const initialCollections = await api("/api/admin/collections", { cookie });
    ensure(initialCollections.status === 200, "koleksiyon listesi 200");
    ensure(
      Array.isArray((initialCollections.data as { collections?: unknown }).collections) &&
        (initialCollections.data as { collections: unknown[] }).collections.length === 0,
      "koleksiyon listesi boş",
    );

    console.log("\nKoleksiyonlar");
    const fields = [
      { key: "title", label: "Başlık", type: "text", required: true },
      { key: "summary", label: "Özet", type: "textarea", required: false },
      { key: "price", label: "Fiyat", type: "number", required: false },
      { key: "featured", label: "Öne çıkan", type: "boolean", required: false },
      { key: "publish_date", label: "Yayın tarihi", type: "date", required: false },
      { key: "link", label: "Bağlantı", type: "url", required: false },
      {
        key: "category",
        label: "Kategori",
        type: "select",
        required: true,
        options: ["haber", "blog"],
      },
    ];

    const createdCollection = await api("/api/admin/collections", {
      method: "POST",
      cookie,
      body: { name: "Yazılar", slug: "yazilar", fields },
    });
    ensure(
      createdCollection.status === 201,
      `7 alan tipiyle koleksiyon oluşturma 201 (alınan: ${createdCollection.status})`,
    );
    const collection = (createdCollection.data as CollectionResponse).collection;
    ensure(collection.slug === "yazilar", "koleksiyon slug'ı korunuyor");
    ensure(collection.fields.length === 7, "koleksiyonda 7 alan var");
    ensure(
      collection.fields.find((field) => field.key === "category")?.options?.join(",") ===
        "haber,blog",
      "select seçenekleri kaydedildi",
    );

    const duplicateCollection = await api("/api/admin/collections", {
      method: "POST",
      cookie,
      body: { name: "Kopya", slug: "yazilar", fields },
    });
    ensure(duplicateCollection.status === 409, "aynı slug 409");
    ensure(
      errorCode(duplicateCollection.data) === "SLUG_TAKEN",
      "aynı slug SLUG_TAKEN",
    );

    const badSlug = await api("/api/admin/collections", {
      method: "POST",
      cookie,
      body: { name: "Hatalı", slug: "Yazilar!", fields },
    });
    ensure(badSlug.status === 400 && errorField(badSlug.data) === "slug", "geçersiz slug 400 + field=slug");

    const immutableSlug = await api(`/api/admin/collections/${collection.id}`, {
      method: "PATCH",
      cookie,
      body: { slug: "baska-slug" },
    });
    ensure(
      immutableSlug.status === 400 && errorField(immutableSlug.data) === "slug",
      "slug PATCH ile değiştirilemiyor",
    );

    console.log("\nKayıt doğrulama");
    const baseData: Record<string, unknown> = {
      title: "İlk yazı",
      summary: "Kısa bir özet.",
      price: 12.5,
      featured: true,
      publish_date: "2026-11-19",
      link: "https://example.com/yazi",
      category: "blog",
    };

    async function expectValidation(
      label: string,
      data: Record<string, unknown>,
      expectedField: string,
    ): Promise<void> {
      const result = await api(`/api/admin/entries/${collection.id}`, {
        method: "POST",
        cookie,
        body: { data },
      });
      ensure(result.status === 400, `${label} 400`);
      ensure(errorCode(result.data) === "VALIDATION_ERROR", `${label} VALIDATION_ERROR`);
      ensure(errorField(result.data) === expectedField, `${label} field=${expectedField}`);
      ensure((errorPayload(result.data)?.message.length ?? 0) > 0, `${label} Türkçe mesaj içeriyor`);
    }

    const missingRequired = { ...baseData };
    delete missingRequired.title;
    await expectValidation("zorunlu alan eksik", missingRequired, "data.title");
    await expectValidation("yanlış sayı tipi", { ...baseData, price: "12" }, "data.price");
    await expectValidation(
      "select seçeneği dışı",
      { ...baseData, category: "spor" },
      "data.category",
    );
    await expectValidation(
      "bilinmeyen veri anahtarı",
      { ...baseData, extra: "x" },
      "data.extra",
    );
    await expectValidation(
      "geçersiz tarih",
      { ...baseData, publish_date: "2026-02-30" },
      "data.publish_date",
    );
    await expectValidation(
      "geçersiz url",
      { ...baseData, link: "ftp://example.com" },
      "data.link",
    );
    await expectValidation(
      "metin uzunluğu",
      { ...baseData, title: "a".repeat(5_001) },
      "data.title",
    );
    await expectValidation(
      "textarea uzunluğu",
      { ...baseData, summary: "a".repeat(50_001) },
      "data.summary",
    );

    console.log("\nTaslak ve yayın akışı");
    const draftResult = await api(`/api/admin/entries/${collection.id}`, {
      method: "POST",
      cookie,
      body: { data: baseData, status: "draft" },
    });
    ensure(draftResult.status === 201, "taslak kayıt 201");
    const draft = (draftResult.data as EntryResponse).entry;
    ensure(draft.status === "draft", "kayıt status=draft");

    const emptyPublic = await api("/api/content/yazilar");
    ensure(emptyPublic.status === 200, "public içerik listesi 200");
    ensure(
      (emptyPublic.data as PublicEntryListResponse).entries.length === 0,
      "taslak public listede görünmüyor",
    );

    const hiddenSingle = await api(`/api/content/yazilar/${draft.id}`);
    ensure(hiddenSingle.status === 404, "taslak tek içerik public 404");

    const draftList = await api(
      `/api/admin/entries/${collection.id}?status=draft&limit=50&offset=0`,
      { cookie },
    );
    ensure(draftList.status === 200, "admin kayıt listesi 200");
    const draftPage = draftList.data as EntryListResponse;
    ensure(draftPage.total === 1, "başarısız doğrulamalar kayıt oluşturmadı");

    const publishedData = {
      ...baseData,
      title: "Yayınlanmış yazı",
      category: "haber",
    };
    const publishedResult = await api(`/api/admin/entries/${collection.id}`, {
      method: "POST",
      cookie,
      body: { data: publishedData, status: "published" },
    });
    ensure(publishedResult.status === 201, "yayınlanmış kayıt 201");
    const published = (publishedResult.data as EntryResponse).entry;
    ensure(published.status === "published", "kayıt status=published");

    const publicList = await api("/api/content/yazilar");
    ensure(publicList.status === 200, "public liste 200");
    const publicPage = publicList.data as PublicEntryListResponse;
    ensure(publicPage.entries.length === 1, "yayınlanmış içerik public listede");
    const publicEntry = publicPage.entries[0];
    ensure(publicEntry?.id === published.id, "public içerik kimliği eşleşiyor");
    ensure(
      publicEntry?.data.title === "Yayınlanmış yazı",
      "public içerik verisi açık",
    );
    ensure(
      publicEntry !== undefined &&
        !("status" in publicEntry) &&
        !("collectionId" in publicEntry),
      "public içerik iç alanları sızdırmıyor",
    );

    const publicSingle = await api(`/api/content/yazilar/${published.id}`);
    ensure(publicSingle.status === 200, "public tek içerik 200");
    ensure(
      (publicSingle.data as PublicEntryResponse).entry.id === published.id,
      "public tek içerik kimliği eşleşiyor",
    );

    const publishDraft = await api(`/api/admin/entries/${draft.id}`, {
      method: "PATCH",
      cookie,
      body: { status: "published" },
    });
    ensure(publishDraft.status === 200, "taslağı yayınlama 200");
    ensure(
      (publishDraft.data as EntryResponse).entry.status === "published",
      "taslak published oldu",
    );
    const twoPublished = await api("/api/content/yazilar");
    ensure(
      (twoPublished.data as PublicEntryListResponse).entries.length === 2,
      "iki yayınlanmış içerik görünüyor",
    );

    const updatedDraft = await api(`/api/admin/entries/${draft.id}`, {
      method: "PATCH",
      cookie,
      body: { data: { title: "Güncellenmiş yazı" } },
    });
    ensure(updatedDraft.status === 200, "kayıt verisi güncelleme 200");
    ensure(
      (updatedDraft.data as EntryResponse).entry.data.title === "Güncellenmiş yazı",
      "güncellenen veri döndü",
    );
    ensure(
      (updatedDraft.data as EntryResponse).entry.data.price === 12.5,
      "kısmi PATCH diğer veri alanlarını korudu",
    );

    const unpublish = await api(`/api/admin/entries/${draft.id}`, {
      method: "PATCH",
      cookie,
      body: { status: "draft" },
    });
    ensure(unpublish.status === 200, "yayından kaldırma 200");
    const afterUnpublish = await api("/api/content/yazilar");
    ensure(
      (afterUnpublish.data as PublicEntryListResponse).entries.length === 1,
      "yayından kaldırılan içerik public listede yok",
    );
    const unpublishSingle = await api(`/api/content/yazilar/${draft.id}`);
    ensure(unpublishSingle.status === 404, "yayından kaldırılan tek içerik 404");

    console.log("\nSayfalama");
    const extraIds: string[] = [];
    for (let index = 1; index <= 3; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const extra = await api(`/api/admin/entries/${collection.id}`, {
        method: "POST",
        cookie,
        body: {
          data: {
            ...baseData,
            title: `Sayfa ${index}`,
            category: index % 2 === 0 ? "haber" : "blog",
          },
          status: "published",
        },
      });
      ensure(extra.status === 201, `ek yayınlanmış kayıt ${index} 201`);
      extraIds.push((extra.data as EntryResponse).entry.id);
    }

    const pageOne = await api("/api/content/yazilar?limit=2&offset=0");
    const pageTwo = await api("/api/content/yazilar?limit=2&offset=2");
    const pageOneEntries = (pageOne.data as PublicEntryListResponse).entries;
    const pageTwoEntries = (pageTwo.data as PublicEntryListResponse).entries;
    ensure(pageOne.status === 200 && pageOneEntries.length === 2, "public limit=2 ilk sayfa");
    ensure(pageTwo.status === 200 && pageTwoEntries.length === 2, "public limit=2 ikinci sayfa");
    ensure(
      pageOneEntries.every(
        (entry) => !pageTwoEntries.some((other) => other.id === entry.id),
      ),
      "public sayfaları çakışmıyor",
    );
    ensure(
      pageOneEntries[0]?.id === extraIds[extraIds.length - 1],
      "public liste updated_at azalan sırada",
    );

    const tooLarge = await api("/api/content/yazilar?limit=101");
    ensure(
      tooLarge.status === 400 && errorField(tooLarge.data) === "limit",
      "public limit üst sınırı 400",
    );

    const adminPublished = await api(
      `/api/admin/entries/${collection.id}?status=published&limit=2&offset=0`,
      { cookie },
    );
    const adminPublishedPage = adminPublished.data as EntryListResponse;
    ensure(adminPublished.status === 200, "admin status filtresi 200");
    ensure(adminPublishedPage.total === 4, "admin toplam yayınlanmış 4");
    ensure(adminPublishedPage.entries.length === 2, "admin limit 2 uygulandı");

    const adminDraft = await api(
      `/api/admin/entries/${collection.id}?status=draft&limit=50&offset=0`,
      { cookie },
    );
    ensure((adminDraft.data as EntryListResponse).total === 1, "admin toplam taslak 1");

    const badStatus = await api(
      `/api/admin/entries/${collection.id}?status=arsiv`,
      { cookie },
    );
    ensure(
      badStatus.status === 400 && errorField(badStatus.data) === "status",
      "geçersiz status filtresi 400",
    );

    console.log("\nİstatistikler");
    const stats = await api("/api/admin/stats", { cookie });
    ensure(stats.status === 200, "GET /api/admin/stats 200");
    const statsData = stats.data as AdminStats;
    ensure(statsData.totalCollections === 1, "stats totalCollections=1");
    ensure(statsData.totalEntries === 5, "stats totalEntries=5");
    ensure(statsData.collections[0]?.total === 5, "stats koleksiyon toplamı 5");
    ensure(statsData.collections[0]?.published === 4, "stats yayınlanmış 4");
    ensure(statsData.collections[0]?.draft === 1, "stats taslak 1");
    ensure(statsData.requestsLast24h > 0, "stats son 24 saat istek sayısı > 0");

    console.log("\nKoleksiyon silme");
    const mismatchDelete = await api(`/api/admin/collections/${collection.id}`, {
      method: "DELETE",
      cookie,
      body: { confirmSlug: "yanlis-slug" },
    });
    ensure(mismatchDelete.status === 409, "yanlış confirmSlug 409");
    ensure(
      errorCode(mismatchDelete.data) === "SLUG_MISMATCH",
      "yanlış confirmSlug SLUG_MISMATCH",
    );

    const bodylessDelete = await api(`/api/admin/collections/${collection.id}`, {
      method: "DELETE",
      cookie,
    });
    ensure(
      bodylessDelete.status === 409,
      "gövdesiz DELETE kabul edildi (415 değil)",
    );

    const stillThere = await api("/api/admin/collections", { cookie });
    ensure(
      (stillThere.data as { collections: unknown[] }).collections.length === 1,
      "başarısız silme koleksiyonu korudu",
    );

    const confirmedDelete = await api(`/api/admin/collections/${collection.id}`, {
      method: "DELETE",
      cookie,
      body: { confirmSlug: "yazilar" },
    });
    ensure(confirmedDelete.status === 204, "doğru confirmSlug 204");
    ensure(
      Boolean((confirmedDelete.data as unknown) === null),
      "silme yanıtı gövdesiz",
    );

    const afterDelete = await api("/api/admin/collections", { cookie });
    ensure(
      (afterDelete.data as { collections: unknown[] }).collections.length === 0,
      "koleksiyon silindi",
    );
    const orphanEntries = ctx.db
      .prepare("SELECT COUNT(*) AS count FROM entries WHERE collection_id = ?")
      .get(collection.id) as { count: number };
    ensure(orphanEntries.count === 0, "koleksiyon kayıtları cascade silindi");
    const deletedEntries = await api(`/api/admin/entries/${collection.id}`, { cookie });
    ensure(deletedEntries.status === 404, "silinen koleksiyon kayıtları 404");
    const deletedContent = await api("/api/content/yazilar");
    ensure(deletedContent.status === 404, "silinen koleksiyon public 404");

    console.log("\nOturum kapatma ve 401");
    const anonStats = await api("/api/admin/stats");
    ensure(anonStats.status === 401, "oturumsuz stats 401");
    const anonEntryCreate = await api(`/api/admin/entries/${collection.id}`, {
      method: "POST",
      body: { data: baseData },
    });
    ensure(anonEntryCreate.status === 401, "oturumsuz kayıt oluşturma 401");
    const anonEntryPatch = await api(`/api/admin/entries/${draft.id}`, {
      method: "PATCH",
      body: { status: "draft" },
    });
    ensure(anonEntryPatch.status === 401, "oturumsuz kayıt güncelleme 401");

    const logout = await api("/api/auth/logout", { method: "POST", cookie });
    ensure(logout.status === 204, "logout 204");
    const meAfterLogout = await api("/api/auth/me", { cookie });
    ensure(meAfterLogout.status === 401, "logout sonrası me 401");
    const adminAfterLogout = await api("/api/admin/collections", { cookie });
    ensure(adminAfterLogout.status === 401, "logout sonrası admin 401");
    const sessionsAfterLogout = ctx.db
      .prepare("SELECT COUNT(*) AS count FROM admin_sessions")
      .get() as { count: number };
    ensure(sessionsAfterLogout.count === 0, "logout oturumu sildi");

    console.log("\nHız sınırları");
    let loginLimited = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const limited = await api("/api/auth/login", {
        method: "POST",
        body: { password: "yanlis-parola" },
      });

      if (limited.status === 429) {
        loginLimited = true;
        ensure(errorCode(limited.data) === "RATE_LIMITED", "login 5/dk sonrası RATE_LIMITED");
        const retryAfter = Number(limited.headers.get("retry-after"));
        ensure(Number.isFinite(retryAfter) && retryAfter >= 1, "429 Retry-After başlığı var");
        break;
      }
    }
    ensure(loginLimited, "login hız sınırı 429 üretti");

    let publicLimited = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const limited = await api("/api/content/bilinmeyen");
      if (limited.status === 429) {
        publicLimited = true;
        ensure(
          errorCode(limited.data) === "RATE_LIMITED",
          "public 120/dk sonrası RATE_LIMITED",
        );
        ensure(
          Number(limited.headers.get("retry-after")) >= 1,
          "public 429 Retry-After başlığı var",
        );
        break;
      }
    }
    ensure(publicLimited, "public okuma hız sınırı 429 üretti");

    console.log("\nTüm smoke kontrolleri geçti.");
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolveClose) => {
        server?.close(() => resolveClose());
      });
    }
    ctx?.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error("\nSmoke testi başarısız:", error);
  process.exitCode = 1;
});
