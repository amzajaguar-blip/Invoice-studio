import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

/**
 * Free plan limit — shows the HardLimitModal on the 6th invoice.
 *
 * Flow:
 * 1. Admin API: create a confirmed user (+ auto-created org via DB trigger)
 * 2. Admin API: insert a test client for the org
 * 3. UI login → dashboard
 * 4. Navigate to invoices → create 5 invoices
 * 5. Click "Nuova Fattura" for the 6th → HardLimitModal appears
 * 6. Cleanup: delete the user (cascades org, clients, invoices)
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Free plan limit", () => {
  let supabaseAdmin: ReturnType<typeof createClient>;
  let testEmail: string;
  let testPassword: string;
  let userId: string;

  test.beforeAll(() => {
    supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  test.afterAll(async () => {
    // Cascade cleanup: deleting the user removes org, clients, invoices, etc.
    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
  });

  test("shows HardLimitModal on 6th invoice attempt", async ({ page }) => {
    // ─── Step 0: Establish page context ───────────────────────────────────
    // The page starts at about:blank. Without an initial navigation, the
    // browser may fail page.goto() with ERR_ABORTED after page.request API
    // calls. Navigate to / first to warm up the browser context.
    await page.goto("/", { waitUntil: "commit" });

    // ─── Step 1: Create confirmed test user ───────────────────────────────
    testEmail = `test-${uuidv4()}@example.com`;
    testPassword = "Password123!";

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: "Test User" },
      });

    if (userError || !userData.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }
    userId = userData.user.id;

    // Give the DB trigger (handle_new_user) a moment to create the org
    await new Promise((r) => setTimeout(r, 500));

    // ─── Step 2: Get org_id (auto-created by handle_new_user trigger) ───
    let orgId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: member } = await supabaseAdmin
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (member?.org_id) {
        orgId = member.org_id;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!orgId) {
      throw new Error("Org not auto-created by trigger after retries");
    }

    // ─── Step 3: Insert a test client ─────────────────────────────────────
    const { error: clientError } = await supabaseAdmin.from("clients").insert({
      org_id: orgId,
      name: "Test Client",
      email: "client@example.com",
    });

    if (clientError) {
      throw new Error(`Failed to create client: ${clientError.message}`);
    }

    // ─── Step 4: Login programmatically via Supabase REST API ─────────────
    // Bypasses UI hydration issues — authenticates directly, sets cookies
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authRes = await page.request.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        data: {
          email: testEmail,
          password: testPassword,
          gotrue_meta_security: {},
        },
      }
    );

    if (!authRes.ok()) {
      throw new Error(
        `Supabase auth failed [${authRes.status()}]: ${await authRes.text()}`
      );
    }

    const authData = await authRes.json();
    const { access_token, refresh_token, expires_at } = authData;

    // Set Supabase auth cookies so the SSR middleware + server components
    // pick up the authenticated session
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = JSON.stringify({
      access_token,
      refresh_token,
      expires_at,
    });

    await page.context().addCookies([
      {
        name: cookieName,
        value: encodeURIComponent(cookieValue),
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Give the browser a tick to process the new cookie before navigating.
    // Without this, page.goto may hang (ERR_ABORTED / timeout).
    await new Promise((r) => setTimeout(r, 500));

    // Navigate to dashboard — should be authenticated now.
    // Use "commit" (least strict) because dev mode HMR + Supabase realtime
    // keep open connections that prevent "load"/"networkidle" from resolving.
    // Also avoid "load" which can trigger ERR_ABORTED on redirect loops.
    await page.goto("/dashboard", { waitUntil: "commit" });

    // If auth failed, middleware redirects to /login — fail fast
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // Ensure the dashboard is fully hydrated before interacting
    // The heading is rendered server-side, visible immediately
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 10_000,
    });

    // ─── Step 5: Navigate to invoices ─────────────────────────────────────
    // Use direct goto as fallback: router.push may not fire if React isn't hydrated
    const navBtn = page.getByRole("button", { name: "📄 Fatture" });
    await navBtn.click();
    try {
      await page.waitForURL("**/invoices", { timeout: 5_000 });
    } catch {
      // Client-side router.push didn't fire — navigate directly
      // Use "commit" (least strict) for same reason as above
      await page.goto("/invoices", { waitUntil: "commit" });
    }

    // Wait for the quota API to respond before checking "questo mese".
    // The useQuota hook fires on mount; "questo mese" is only rendered
    // once quota !== null && !quota.unlimited.
    await page.waitForResponse(
      (r) => r.url().includes("/api/rewards/status") && r.status() === 200,
      { timeout: 10_000 }
    );

    // Wait for quota to load — "questo mese" appears once quota state is set
    await expect(page.getByText("questo mese")).toBeVisible({ timeout: 5_000 });

    // ─── Step 6: Create 5 invoices ────────────────────────────────────────
    for (let i = 1; i <= 5; i++) {
      // Click "Nuova Fattura"
      await page.getByRole("button", { name: "✦ Nuova Fattura" }).click();

      // Wait for the form modal to appear (heading inside the modal)
      await expect(
        page.getByRole("heading", { name: "✦ Nuova Fattura" })
      ).toBeVisible();

      // Wait for clients to load — the <select> appears when loadingClients=false
      await expect(page.locator("select").first()).toBeAttached({ timeout: 10_000 });

      // Fill the first line item
      await page.getByPlaceholder("Descrizione").first().fill(`Consulenza ${i}`);
      await page.getByPlaceholder("Qtà").first().fill("1");
      await page.getByPlaceholder("Prezzo").first().fill("100");

      // Submit and wait for quota refresh
      const quotaPromise = page.waitForResponse(
        (r) => r.url().includes("/api/rewards/status") && r.status() === 200,
        { timeout: 10_000 }
      );
      await page.getByRole("button", { name: "✦ Crea fattura" }).click();

      // Wait for the form modal to close (success)
      await expect(
        page.getByRole("heading", { name: "✦ Nuova Fattura" })
      ).not.toBeVisible({ timeout: 10_000 });

      // Wait for the quota refresh to complete
      await quotaPromise;
    }

    // ─── Ensure React state reflects limit reached before 6th attempt ────
    await expect(page.getByText("5/5")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);

    // ─── Step 7: Attempt 6th invoice → HardLimitModal ────────────────────
    await page.getByRole("button", { name: "✦ Nuova Fattura" }).click();

    // The modal should appear (not the invoice form)
    await expect(page.getByText("Limite fatture raggiunto")).toBeVisible({
      timeout: 5_000,
    });

    // Verify the "watch ad" button is present
    await expect(
      page.getByRole("button", { name: "Sblocca 1 fattura extra gratis" })
    ).toBeVisible();

    // Verify the "upgrade" button is present (modal-specific, avoid banner duplicate)
    await expect(
      page.getByRole("button", { name: /Passa a Pro — 19€\/mese/ })
    ).toBeVisible();
  });
});
