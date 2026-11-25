// Screenshot of the running Shift dev window through CDP (port 9333, which dev-windows.cmd opens).
// Usage: node scripts/rea/shot.mjs <out.png> [css-selector]   (no selector: the whole window)
// Playwright resolves from apps/desktop, where the e2e suite installs it.
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { chromium } = require("playwright");

const [out = "shot.png", selector] = process.argv.slice(2);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const pages = browser.contexts().flatMap((context) => context.pages());
const page = pages.find((p) => p.url().includes("5173") && !p.url().includes("resume")) ?? pages[0];

await page.waitForTimeout(400);
const target = selector ? page.locator(selector).first() : page;
await target.screenshot({ path: out });
console.log(`ok ${out} <- ${page.url()}${selector ? ` ${selector}` : ""}`);
await browser.close();
