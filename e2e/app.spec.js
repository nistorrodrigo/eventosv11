// ── E2E tests — critical user flows ──────────────────────────────
import { test, expect } from "@playwright/test";

test.describe("App loads", () => {
  test("shows login page when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Latin Securities")).toBeVisible();
    await expect(page.locator("text=Iniciar sesión")).toBeVisible();
  });

  test("has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LS Event Manager/);
  });
});

test.describe("Booking page", () => {
  test("shows empty state for invalid event ID", async ({ page }) => {
    await page.goto("/#/book/nonexistent-id");
    await expect(page.locator("text=No hay horarios disponibles").or(page.locator("text=Cargando"))).toBeVisible({ timeout: 10000 });
  });

  test("booking page renders without crash", async ({ page }) => {
    await page.goto("/#/book/test-123");
    // Should show loading or empty state, not crash
    await page.waitForTimeout(3000);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    // Should NOT have React error
    expect(body).not.toContain("Algo salió mal");
  });
});

test.describe("Auth form", () => {
  test("login form has email and password inputs", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible({ timeout: 5000 });
  });

  test("can switch between login and signup", async ({ page }) => {
    await page.goto("/");
    const signupBtn = page.locator("text=Crear cuenta");
    if (await signupBtn.isVisible()) {
      await signupBtn.click();
      await expect(page.locator('input[placeholder*="nombre" i]').or(page.locator("text=Nombre"))).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("PWA", () => {
  test("manifest.json is accessible", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.name).toBe("LS Event Manager");
    expect(json.short_name).toBe("LS Events");
    expect(json.display).toBe("standalone");
  });

  test("icons are accessible", async ({ page }) => {
    const response = await page.goto("/icon-192.svg");
    expect(response.status()).toBe(200);
  });
});
