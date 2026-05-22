import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test("debug: programmatic auth + dashboard navigation", async ({ page }) => {
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testEmail = `debug-${uuidv4()}@example.com`;
  const testPassword = "Password123!";

  // Navigate to base URL first to establish a page context before doing API calls
  console.log("🌐 Step 0: navigating to / to establish page context...");
  await page.goto("/", { waitUntil: "commit", timeout: 10_000 });
  console.log("✅ Base page loaded, URL:", page.url());

  // Debug: check what cookies are currently set
  const preCookies = await page.context().cookies();
  console.log("📋 Pre-auth cookies:", preCookies.map(c => c.name));

  // Create user
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Debug User" },
    });
  if (userError || !userData.user) {
    throw new Error(`Failed to create user: ${userError?.message}`);
  }
  console.log("✅ User created:", userData.user.id);

  // Wait for trigger
  await new Promise((r) => setTimeout(r, 1000));

  // Get token via REST API (using page.request — same as original test)
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
  console.log("🔑 Auth response status:", authRes.status());
  const authBody = await authRes.text();
  console.log("🔑 Auth response body (truncated):", authBody.slice(0, 200));

  if (!authRes.ok()) {
    throw new Error(`Auth failed: ${authRes.status()} ${authBody}`);
  }

  const authData = JSON.parse(authBody);
  const { access_token, refresh_token, expires_at } = authData;
  console.log("✅ Got access_token");

  // Set cookie
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify({ access_token, refresh_token, expires_at });

  console.log("🍪 Cookie name:", cookieName);
  console.log("🍪 Cookie value length:", cookieValue.length);

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
  // Debug: check cookies after setting
  const postCookies = await page.context().cookies();
  console.log("📋 Post-auth cookies:", postCookies.map(c => `${c.name}=${c.value.slice(0, 30)}...`));
  console.log("✅ Cookies set");

  // Small delay to ensure browser has processed cookies
  await new Promise((r) => setTimeout(r, 500));

  // Now navigate — try with a try/catch to see what happens
  try {
    console.log("🌐 Navigating to /dashboard via page.goto...");
    // Try full URL to rule out relative path issues
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "commit", timeout: 10_000 });
    console.log("✅ Navigation done, URL:", page.url());

    // Check if we're on login or dashboard
    if (page.url().includes("/login")) {
      console.log("❌ Redirected to login — auth cookie not working");
      // Check what cookies are actually sent
      const cookies = await page.context().cookies();
      console.log("📋 Current cookies:", JSON.stringify(cookies, null, 2));
    } else {
      console.log("✅ On dashboard — auth working!");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
        timeout: 10_000,
      });
      console.log("✅ Dashboard visible");
    }
  } catch (e) {
    console.log("❌ Navigation error:", e);
    // Try to see the current URL anyway
    try {
      console.log("📍 Current URL after error:", page.url());
    } catch {}
  }

  // Cleanup
  await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
  console.log("🧹 Cleanup done");
});
