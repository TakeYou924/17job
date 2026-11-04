const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const base = process.env.REPORT_BASE_URL || "http://127.0.0.1:3300";
const questions = require("../src/data/questions.json");
const fixtures = [
  { id: "all-both", changes: {}, expected: [] },
  {
    id: "work-balance",
    changes: { 5: "A", 10: "A", 7: "A", 9: "A" },
    expected: ["P01", "P03"],
  },
  {
    id: "reward-meaning",
    changes: { 12: "A", 13: "A", 15: "B", 16: "B" },
    expected: ["P04", "P05"],
  },
];
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      localStorage.setItem("17job:v1", "original-user-state"),
    );
    await page.goto(`${base}/report-preview`);
    await page
      .getByRole("heading", { name: "해설지 개발 미리보기", exact: true })
      .waitFor();
    for (const [index, fixture] of fixtures.entries()) {
      await page
        .getByLabel("샘플 응답", { exact: true })
        .selectOption(fixture.id);
      const web = page.locator(".report-web");
      assert.deepEqual(
        await web
          .locator(".report-highlights [data-finding-id]")
          .evaluateAll((nodes) => nodes.map((node) => node.dataset.findingId)),
        fixture.expected,
      );
      assert.equal(await web.locator(".report-domain").count(), 5);
      assert.equal(await web.locator(".report-checklist li").count(), 3);
      if (index === 0) {
        assert.equal(await web.locator(".report-finding").count(), 0);
        assert.ok(
          (await web.innerText()).includes(
            "특정 업무 방식이 더 적합하다고 판단하기는 어렵습니다",
          ),
        );
      }
      await web.screenshot({
        path: `/tmp/17job-report-sample-${index + 1}-desktop.png`,
      });
      if (index > 0) {
        const first = web
          .locator(".report-highlights .report-evidence")
          .first();
        await first.locator("summary").click();
        assert.equal(await first.locator("li").count(), 2);
        await first.locator("summary").click();
      }
      await web.locator(".report-original>details>summary").click();
      const rows = web.locator(".report-original tbody tr");
      assert.equal(await rows.count(), 17);
      for (let i = 0; i < 17; i++) {
        const answer = fixture.changes[i + 1] || "both";
        const cell = await rows.nth(i).locator("td").innerText();
        assert.ok(
          cell.includes(
            answer === "both"
              ? "둘 다 문제 없음"
              : answer === "A"
                ? questions[i].a
                : questions[i].b,
          ),
        );
      }
      await web.locator(".report-original>details>summary").click();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${fixture.id} overflow at ${width}`,
        );
        if (width === 390)
          await web.screenshot({
            path: `/tmp/17job-report-sample-${index + 1}-mobile.png`,
          });
      }
      const font = await web
        .locator(".report-domain>p")
        .first()
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      assert.ok(font >= 14);
      await page.evaluate(() => (document.body.style.zoom = "2"));
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${fixture.id} 200% overflow`,
      );
      await page.evaluate(() => (document.body.style.zoom = "1"));
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator(".report-print").isVisible(), true);
      assert.equal(await web.isVisible(), false);
      const pdf = await page.pdf({
        path: `/tmp/17job-report-sample-${index + 1}.pdf`,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      assert.ok(pdf.byteLength > 10000);
      assert.equal(
        readFileSync(`/tmp/17job-report-sample-${index + 1}.pdf`)
          .subarray(0, 4)
          .toString(),
        "%PDF",
      );
      await page.emulateMedia({ media: "screen" });
    }
    await page.evaluate(() => {
      window.__reportPrintCount = 0;
      window.print = () => {
        window.__reportPrintCount++;
      };
    });
    await page
      .getByRole("button", { name: "인쇄 / PDF 저장", exact: true })
      .click();
    assert.equal(await page.evaluate(() => window.__reportPrintCount), 1);
    await page.getByText("직접 응답 JSON 입력", { exact: true }).click();
    await page
      .getByLabel("1~17번 응답 · A / B / C 또는 both", { exact: true })
      .fill('{"1":"A"}');
    await page
      .getByRole("button", { name: "가상 응답 적용", exact: true })
      .click();
    assert.ok(
      (
        await page.locator(".report-preview-controls [role=alert]").innerText()
      ).includes("1~17"),
    );
    assert.deepEqual(
      await page
        .locator(".report-web .report-highlights [data-finding-id]")
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.findingId)),
      fixtures[2].expected,
    );
    const custom = Object.fromEntries(
      Array.from({ length: 17 }, (_, index) => [
        index + 1,
        index === 5 ? "B" : "C",
      ]),
    );
    await page
      .getByLabel("1~17번 응답 · A / B / C 또는 both", { exact: true })
      .fill(JSON.stringify(custom));
    await page
      .getByRole("button", { name: "가상 응답 적용", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".report-web .report-highlights [data-finding-id]")
        .count(),
      1,
    );
    const evidence = page.locator(".report-web .report-evidence").first();
    await evidence.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await evidence.evaluate((element) => element.open), true);
    await page.keyboard.press("Enter");
    assert.equal(await evidence.evaluate((element) => element.open), false);
    for (const answer of ["A", "B"]) {
      const full = Object.fromEntries(
        Array.from({ length: 17 }, (_, index) => [index + 1, answer]),
      );
      await page
        .getByLabel("1~17번 응답 · A / B / C 또는 both", { exact: true })
        .fill(JSON.stringify(full));
      await page
        .getByRole("button", { name: "가상 응답 적용", exact: true })
        .click();
      await page.emulateMedia({ media: "print" });
      await page.pdf({
        path: `/tmp/17job-report-all-${answer}.pdf`,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      await page.emulateMedia({ media: "screen" });
    }
    assert.equal(
      await page.evaluate(() => localStorage.getItem("17job:v1")),
      "original-user-state",
    );
    const app = await browser.newPage();
    app.on("pageerror", (error) => errors.push(error.message));
    await app.addInitScript(() => {
      if (!localStorage.getItem("17job:v1"))
        localStorage.setItem(
          "17job:v1",
          JSON.stringify({
            version: 2,
            stage: "results",
            answers: Object.fromEntries(
              Array.from({ length: 17 }, (_, index) => [index + 1, "both"]),
            ),
            question: 16,
            activeJob: "analyst",
            experiences: {},
          }),
        );
    });
    await app.goto(base);
    await app
      .getByRole("heading", { name: "나의 업무 환경 요약", exact: true })
      .waitFor();
    assert.equal(
      await app
        .locator(".report-web .report-highlights [data-finding-id]")
        .count(),
      0,
    );
    await app.getByRole("button", { name: "응답 수정", exact: true }).click();
    await app.getByRole("radio").nth(0).check();
    await app
      .getByRole("button", { name: "나의 업무 환경", exact: true })
      .click();
    assert.equal(
      await app
        .locator('.report-web .report-highlights [data-finding-id="Q1A"]')
        .count(),
      1,
    );
    assert.ok(
      !(await app.locator(".report-web .report-metadata").innerText()).includes(
        "완료일 미기록",
      ),
    );
    await app.reload();
    await app
      .getByRole("heading", { name: "나의 업무 환경 요약", exact: true })
      .waitFor();
    assert.equal(
      await app
        .locator('.report-web .report-highlights [data-finding-id="Q1A"]')
        .count(),
      1,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 3 required report samples; evidence and 17 original responses; 5 domains; neutral C; responsive 320/390/768/1440; 200% zoom; print/PDF; JSON validation; no user-storage mutation or browser errors",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
