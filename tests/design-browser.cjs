const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.BASE_URL || "http://127.0.0.1:3300";

// Inspect rendered foreground/background colours rather than assuming tokens win the cascade.
function contrastFailures() {
  const rgb = (s) => s.match(/[\d.]+/g)?.map(Number) || [255, 255, 255];
  const luminance = (c) =>
    c
      .slice(0, 3)
      .map((x) => x / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
  const failures = [];
  for (const el of document.querySelectorAll("body *")) {
    if (
      ![...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      ) ||
      !el.checkVisibility({ checkVisibilityCSS: true }) ||
      el.closest(".hero-art,[aria-hidden=true]") ||
      el.disabled
    )
      continue;
    const style = getComputedStyle(el);
    let background = el;
    while (
      background.parentElement &&
      rgb(getComputedStyle(background).backgroundColor)[3] === 0
    )
      background = background.parentElement;
    const fg = luminance(rgb(style.color));
    const bg = luminance(rgb(getComputedStyle(background).backgroundColor));
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    const large =
      parseFloat(style.fontSize) >= 24 ||
      (parseFloat(style.fontSize) >= 18.66 &&
        parseInt(style.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5))
      failures.push({
        text: el.textContent.trim().slice(0, 60),
        ratio: +ratio.toFixed(2),
      });
  }
  return failures;
}
async function inspectLayouts(page, name) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${name} overflow at ${width}`,
    );
    assert.deepEqual(
      await page.evaluate(contrastFailures),
      [],
      `${name} contrast at ${width}`,
    );
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: `/tmp/17job-design-${name}-${width}.png`,
        fullPage: true,
      });
  }
  await page.evaluate(() => (document.body.style.zoom = "2"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    `${name} 200% overflow`,
  );
  assert.equal(await page.getByRole("heading", { level: 1 }).isVisible(), true);
  await page.evaluate(() => (document.body.style.zoom = "1"));
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page
      .getByRole("button", { name: "나의 업무 환경 알아보기" })
      .waitFor();
    await inspectLayouts(page, "home");
    // Main routes are independently reachable by keyboard, with an explicit active menu.
    await page.getByRole("button", { name: "17job 홈", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "업무 환경 검사");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "직무체험");
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", {
        name: "궁금한 일을 직접 경험해 보세요.",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "직무체험", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    await inspectLayouts(page, "jobs");
    const cards = page.locator(".job-card");
    const bottoms = await cards
      .locator(".card-bottom")
      .evaluateAll((nodes) =>
        nodes.slice(0, 2).map((el) => el.getBoundingClientRect().bottom),
      );
    assert.ok(
      Math.abs(bottoms[0] - bottoms[1]) <= 1,
      "available card CTAs aligned",
    );
    assert.equal(await page.locator(".job-card-ready button").count(), 0);
    const detail = cards.first().locator("summary");
    await detail.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await cards
        .first()
        .locator("details")
        .evaluate((el) => el.open),
      true,
    );
    await page.keyboard.press("Enter");
    await cards.first().getByRole("button").focus();
    await page.keyboard.press("Enter");
    await page.locator("#mission-answer").waitFor();
    assert.deepEqual(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("17job:v1")).answers,
      ),
      {},
    );
    // Survey radio groups support the native keyboard pattern.
    await page
      .getByRole("button", { name: "업무 환경 검사", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page.getByRole("radio").first().focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.getByRole("radio").nth(1).isChecked(), true);
    // Inject a complete, varied fixture into only this isolated browser's storage.
    await page.evaluate(() =>
      localStorage.setItem(
        "17job:v1",
        JSON.stringify({
          version: 2,
          stage: "results",
          answers: Object.fromEntries(
            Array.from({ length: 17 }, (_, i) => [i + 1, i % 2 ? "B" : "A"]),
          ),
          question: 16,
          activeJob: "analyst",
          experiences: {},
        }),
      ),
    );
    await page.reload();
    await page.locator(".report-complete-status").waitFor();
    await inspectLayouts(page, "results");
    assert.ok(
      (await page.locator(".report-web .report-finding:visible").count()) <= 3,
      "initial highlights are bounded",
    );
    const evidence = page.locator(".report-web .report-evidence").first();
    await evidence.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.ok((await evidence.locator("li").count()) > 0);
    const original = page.locator(".report-web .report-original details");
    assert.equal(await original.evaluate((el) => el.open), false);
    await original.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await original.locator("tbody tr").count(), 17);
    await page
      .locator(".report-web details")
      .evaluateAll((nodes) => nodes.forEach((el) => (el.open = true)));
    assert.deepEqual(
      await page.evaluate(contrastFailures),
      [],
      "expanded report contrast",
    );
    await page.getByRole("button", { name: "17job 홈", exact: true }).click();
    await page
      .getByRole("button", { name: "내 검사 결과 보기", exact: false })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: home/jobs/results at 320/390/768/1440; rendered text contrast; 200% zoom; aligned available cards; independent keyboard entry; radio arrows; evidence/original keyboard toggles; completed CTA; no browser errors",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
