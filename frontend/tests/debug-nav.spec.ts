import { test, expect } from "@playwright/test";

test("debug: simple page navigation", async ({ page }) => {
  // Test 1: Can we navigate to / at all?
  console.log("Test 1: navigate to /");
  await page.goto("/", { waitUntil: "commit", timeout: 10_000 });
  console.log("URL:", page.url());
  console.log("Status: OK");

  // Test 2: Navigate to /login
  console.log("Test 2: navigate to /login");
  await page.goto("/login", { waitUntil: "commit", timeout: 10_000 });
  console.log("URL:", page.url());

  // Test 3: Navigate to /dashboard (unauthenticated - should redirect to /login)
  console.log("Test 3: navigate to /dashboard (unauthenticated)");
  await page.goto("/dashboard", { waitUntil: "commit", timeout: 10_000 });
  console.log("URL:", page.url());

  // Test 4: Navigate to /invoices (unauthenticated)
  console.log("Test 4: navigate to /invoices");
  await page.goto("/invoices", { waitUntil: "commit", timeout: 10_000 });
  console.log("URL:", page.url());

  console.log("All navigations succeeded");
});
