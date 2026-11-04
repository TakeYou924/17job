const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";
const names = {
  planner: "서비스 기획자",
  analyst: "데이터 분석가",
  designer: "UX 디자이너",
  marketer: "콘텐츠 마케터",
  operator: "운영 매니저",
};
const responses = {
  planner:
    "사실: 사용자에게 품절과 대기 문제가 있습니다. 가설을 확인할 지표와 위험을 검토하고 이번 개선 선택의 이유와 제외할 일을 설명합니다.",
  analyst:
    "전체 결제 완료율은 75%에서 50%로 하락했습니다. 모바일 개편 전후를 비교하고 오류 로그와 구매 실패 세션을 연결해 확인할 필요가 있습니다. 오류 증가만으로 인과를 확정하는 데에는 한계가 있습니다.",
  designer:
    "사용자가 메뉴에서 날짜를 선택하고 예약하는 과정을 관찰합니다. 상단에 주요 버튼과 로그인 안내를 배치하고 오류 시 다음 행동과 선택 정보 유지를 안내합니다. 테스트 완료 여부를 확인합니다.",
  marketer:
    "처음 오는 초보 수강생을 타깃으로 90분 수업과 3주 후 수령을 안내합니다. 커뮤니티 규정과 촬영 동의를 먼저 확인하고 예약 지표를 비교합니다. 한 번에 하나만 바꾸고 해석 한계를 적습니다.",
  operator:
    "12시 현재 미반납 사실을 확인하고 다른 지점에 먼저 대체 장비 가능 여부를 질문합니다. 예비 대응과 확인 시한을 안내하고 담당자별 체크 절차와 비용 부담을 기록합니다.",
};
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
}
async function cardOpen(page, id) {
  const card = page.locator(`.job-card[data-job-id="${id}"]`);
  await card.getByRole("button").click();
}
const choiceIndexes = {
  planner: [0, 1, 2, 3],
  analyst: [3, 0, 0, 0],
  designer: [1, 2, 3, 0],
  marketer: [1, 2, 3, 0],
  operator: [1, 2, 3, 0],
};
async function finishJob(page, id, rating) {
  for (let index = 0; index < 4; index++) {
    if (id === "analyst")
      await page.getByRole("radio").nth(choiceIndexes[id][index]).check();
    await page
      .locator("#mission-answer")
      .fill(
        id === "analyst" && index === 2
          ? "ㅇㅇ"
          : `${responses[id]} 단계 ${index + 1}의 구체적인 생각입니다.`,
      );
    await page
      .getByRole("button", { name: "답변 제출하고 피드백 받기" })
      .click();
    await page.getByRole("heading", { name: "생각을 한 걸음 더" }).waitFor();
    if (id === "analyst" && index === 2)
      assert.ok(
        (await page.locator(".feedback").innerText()).includes(
          "인과관계가 확정되지는",
        ),
      );
    if (index === 0) {
      await page.reload();
      await page.getByRole("heading", { name: "생각을 한 걸음 더" }).waitFor();
      assert.ok(
        (await page.locator("#mission-answer").inputValue()).startsWith(
          responses[id],
        ),
      );
    }
    await page
      .getByRole("button", {
        name: index === 3 ? "체험 마무리하기" : "다음 미션",
      })
      .click();
  }
  await page
    .getByRole("heading", {
      name: `${id === "analyst" ? "숫자를 보고 이상한 지점 찾아보기" : names[id]} · 4단계 체험 완료`,
      exact: true,
    })
    .waitFor();
  if (id === "analyst")
    await page
      .getByText("과제 선택과 자료 해설 다시 보기", { exact: true })
      .click();
  await page
    .getByRole("heading", { name: "실제 업무와의 차이", exact: true })
    .waitFor();
  if (id === "analyst")
    assert.ok(
      (await page.locator(".completion-review").innerText()).includes(
        "상관관계와 원인 구분하기",
      ),
    );
  if (id === "analyst") {
    await page
      .getByText("과제 선택과 자료 해설 다시 보기", { exact: true })
      .click();
    const activities = page.locator(".activity-observations fieldset");
    await activities
      .nth(0)
      .getByRole("checkbox", { name: "흥미로웠어요", exact: true })
      .check();
    await activities
      .nth(0)
      .getByRole("checkbox", { name: "버거웠어요", exact: true })
      .check();
    await activities
      .nth(2)
      .getByRole("checkbox", { name: "아직 모르겠어요", exact: true })
      .check();
    await page
      .locator(".next-action-options")
      .getByRole("radio", { name: /표를 직접 다뤄보기/ })
      .check();
    assert.equal(
      await page
        .getByRole("checkbox", { name: /이 행동을 직접 해봤어요/ })
        .isChecked(),
      false,
    );
    const csv = await page.request.get(
      `${baseURL}/practice/checkout-devices.csv`,
    );
    assert.ok(csv.ok());
    assert.ok((await csv.text()).includes("Mobile,1800,750"));
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: /연습용 표 내려받기/ }).click();
    await csvDownload;
    assert.equal(
      await page
        .getByRole("checkbox", { name: /이 행동을 직접 해봤어요/ })
        .isChecked(),
      false,
    );
    await page
      .getByLabel(/이 행동에서 확인하고 싶은 점/)
      .fill("표를 직접 계산해서 숫자 읽기와 차이가 있는지 확인하고 싶어요.");
    await page
      .locator(".next-action-options")
      .getByRole("radio", { name: /다른 원인 하나 더 조사해 보기/ })
      .check();
    await page
      .getByLabel("다른 원인 한 가지와 확인할 자료를 적어 보세요.")
      .fill("휴일 영향일 수 있습니다. 일자별 방문 구성을 확인합니다.");
    await page
      .locator(".next-action-options")
      .getByRole("radio", { name: /표를 직접 다뤄보기/ })
      .check();
    assert.ok(
      (await page.locator("#next-action-note").inputValue()).includes(
        "숫자 읽기",
      ),
    );
    await page
      .locator(".next-action-options")
      .getByRole("radio", { name: /다른 원인 하나 더 조사해 보기/ })
      .check();
    assert.ok(
      (await page.locator("#next-action-note").inputValue()).includes("휴일"),
    );
    await page
      .locator(".next-action-options")
      .getByRole("radio", { name: /표를 직접 다뤄보기/ })
      .check();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /내 탐색 기록 내려받기/ }).click();
    const artifact = await download;
    const text = require("node:fs").readFileSync(await artifact.path(), "utf8");
    assert.ok(text.includes("흥미로웠어요 · 버거웠어요"));
    assert.ok(text.includes("표를 직접 다뤄보기"));
    await page.screenshot({
      path: "/tmp/17job-discovery-desktop.png",
      fullPage: true,
    });
  }
  await page
    .locator(".interest-options input")
    .nth(rating - 1)
    .check();
  await page
    .getByLabel(/어떤 순간이 흥미롭거나/)
    .fill(`${names[id]} 회고: ${rating}번째 흥미 응답과 고유한 경험입니다.`);
  await page
    .getByRole("button", {
      name:
        id === "analyst"
          ? "전체 느낌과 회고 기록하기"
          : "회고 저장하고 다음 탐색 보기",
    })
    .click();
  if (id === "analyst") {
    assert.equal(await page.locator(".next-exploration").count(), 0);
    await page.reload();
    await page
      .getByRole("heading", {
        name: "직업 이름 대신, 나의 발견을 남겨요.",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page
        .locator(".activity-observations fieldset")
        .nth(0)
        .getByRole("checkbox", { name: "흥미로웠어요", exact: true })
        .isChecked(),
      true,
    );
    assert.equal(
      await page
        .locator(".activity-observations fieldset")
        .nth(0)
        .getByRole("checkbox", { name: "버거웠어요", exact: true })
        .isChecked(),
      true,
    );
    assert.ok(
      (await page.locator("#next-action-note").inputValue()).includes(
        "숫자 읽기",
      ),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.screenshot({
      path: "/tmp/17job-discovery-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  } else {
    await page
      .getByRole("heading", { name: "다음엔 이런 경험은 어떨까요?" })
      .waitFor();
    assert.equal(await page.locator(".next-exploration .job-card").count(), 4);
    assert.equal(
      await page
        .locator(`.next-exploration .job-card[data-job-id="${id}"]`)
        .count(),
      0,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "다음엔 이런 경험은 어떨까요?" })
      .waitFor();
  }
  assert.equal(
    await page
      .locator(".interest-options input")
      .nth(rating - 1)
      .isChecked(),
    true,
  );
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL);
    await page.getByRole("button", { name: "나의 탐색 시작하기" }).waitFor();
    await page.screenshot({ path: "/tmp/17job-desktop.png", fullPage: true });
    await page.getByRole("button", { name: "나의 탐색 시작하기" }).click();
    assert.equal(
      await page.getByRole("button", { name: "다음 질문" }).isDisabled(),
      true,
    );
    for (let i = 0; i < 17; i++) {
      await page
        .getByRole("radio")
        .nth(i === 0 ? 0 : i === 1 || i === 3 ? 1 : 2)
        .check();
      await page
        .getByRole("button", { name: i === 16 ? "결과 살펴보기" : "다음 질문" })
        .click();
    }
    await page
      .getByRole("heading", { name: "내가 확인해 볼 일의 조건", exact: true })
      .waitFor();
    assert.equal(await page.locator(".burden-list li").count(), 3);
    await page.reload();
    await page
      .getByRole("heading", { name: "내가 확인해 볼 일의 조건", exact: true })
      .waitFor();
    await page
      .getByRole("button", {
        name: "문제의 성격 질문을 탐색 기록에 담기",
        exact: true,
      })
      .click();
    await page.screenshot({
      path: "/tmp/17job-conditions-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.screenshot({
      path: "/tmp/17job-conditions-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "다른 경험도 둘러보기", exact: true })
      .click();
    assert.equal(await page.locator(".job-card").count(), 5);
    for (const id of ["designer", "marketer", "operator"]) {
      const card = page.locator(".job-card").filter({
        has: page.getByRole("heading", { name: names[id], exact: true }),
      });
      assert.equal(await card.getByRole("button").count(), 0);
      assert.ok((await card.innerText()).includes("준비 중"));
    }
    await page
      .getByRole("button", { name: "나의 업무 환경", exact: true })
      .click();
    await page
      .getByRole("button", { name: "이 상황을 직접 확인해 보기", exact: false })
      .click();
    await page
      .getByRole("heading", { name: "이번에 확인할 나의 질문", exact: true })
      .waitFor();
    assert.ok(
      (await page.locator(".observation-guide").innerText()).includes(
        "확실하지",
      ),
    );
    await page
      .getByRole("heading", { name: "구매가 줄어든 구간 찾기", exact: true })
      .waitFor();
    assert.equal(await page.getByRole("table").count(), 1);
    await page.getByRole("radio").nth(3).check();
    await page.locator("#mission-answer").fill(responses.analyst);
    await page.getByRole("button", { name: "직무 목록" }).click();
    await cardOpen(page, "planner");
    assert.equal(await page.locator("#mission-answer").inputValue(), "");
    await page.locator("#mission-answer").fill(responses.planner);
    await page.getByRole("button", { name: "직무 목록" }).click();
    await cardOpen(page, "analyst");
    assert.equal(
      await page.locator("#mission-answer").inputValue(),
      responses.analyst,
    );
    assert.equal(await page.getByRole("radio").nth(3).isChecked(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.screenshot({
      path: "/tmp/17job-analyst-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await finishJob(page, "analyst", 3);
    await page
      .getByRole("button", { name: "나의 업무 환경", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "작업 방식 질문을 탐색 기록에 담기",
        exact: true,
      })
      .click();
    assert.ok(
      (await page.locator(".saved-focus-note").innerText()).includes(
        "확실하지",
      ),
    );
    await page
      .getByRole("button", { name: "이 상황을 직접 확인해 보기", exact: false })
      .click();
    assert.ok(
      (await page.locator(".discovery-question").innerText()).includes(
        "확실하지",
      ),
    );

    await page
      .locator(".next-action-options")
      .getByRole("radio", { name: /사람의 이야기를 읽는 과정과 비교하기/ })
      .check();
    await page
      .getByRole("button", {
        name: "인터뷰를 읽는 체험 시작하기",
        exact: false,
      })
      .click();
    await page
      .getByRole("heading", { name: "사용자의 목소리 듣기", exact: true })
      .waitFor();

    await page.getByRole("button", { name: "직무 체험", exact: true }).click();
    await cardOpen(page, "planner");
    assert.equal(
      await page.locator("#mission-answer").inputValue(),
      responses.planner,
    );
    await finishJob(page, "planner", 4);
    await page.getByRole("button", { name: "직무 체험", exact: true }).click();
    await page.getByRole("heading", { name: "나의 탐색 기록" }).waitFor();
    assert.equal(await page.locator(".experience-history li").count(), 2);
    assert.ok(
      (await page.locator(".experience-history").innerText()).includes(
        "2 / 2개 체험 완료",
      ),
    );
    for (const [id, rating] of [
      ["planner", 4],
      ["analyst", 3],
    ]) {
      const row = page.locator(".experience-history li").filter({
        has: page.getByRole("heading", { name: names[id], exact: true }),
      });
      assert.ok((await row.innerText()).includes(`${rating}번째 흥미 응답`));
    }
    await page.screenshot({
      path: "/tmp/17job-history-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.screenshot({
      path: "/tmp/17job-history-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "서비스 기획자 기록 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "체험 돌아보기" }).click();
    await page.getByRole("button", { name: "사용자의 목소리 듣기" }).click();
    await page.locator("#mission-answer").fill(responses.planner + " 수정");
    assert.equal(
      await page.getByRole("heading", { name: "생각을 한 걸음 더" }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "팀에 개선안 제안하기" })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "직무 목록" }).click();
    await page
      .getByRole("button", { name: "데이터 분석가 기록 열기", exact: true })
      .click();
    assert.equal(
      await page.locator(".interest-options input").nth(2).isChecked(),
      true,
    );
    assert.ok(
      (await page.locator("#reflection").inputValue()).includes(
        "데이터 분석가 회고",
      ),
    );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("17job:v1")),
    );
    assert.equal(saved.version, 2);
    assert.equal(saved.experiences.planner.rated, false);
    assert.equal(saved.experiences.analyst.rated, true);
    await page.getByRole("button", { name: "내 기록 초기화" }).click();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    assert.equal(await page.locator(".completion-banner").count(), 1);
    await page.getByRole("button", { name: "내 기록 초기화" }).click();
    await page
      .getByRole("button", { name: "전체 초기화", exact: true })
      .click();
    await page.getByRole("button", { name: "나의 탐색 시작하기" }).waitFor();
    await noOverflow(page);
    await page.screenshot({ path: "/tmp/17job-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "나의 탐색 시작하기" }).click();
    await page.getByRole("radio").nth(2).check();
    await noOverflow(page);
    await page.screenshot({
      path: "/tmp/17job-survey-mobile.png",
      fullPage: true,
    });
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page);
    }

    const legacy = {
      version: 1,
      stage: "mission",
      answers: Object.fromEntries(
        Array.from({ length: 17 }, (_, i) => [i + 1, "both"]),
      ),
      question: 16,
      mission: 1,
      responses: [responses.planner, "기존 사용자의 문제 정의 초안", "", ""],
      feedback: [
        { observation: "기존 피드백", next: "다음 안내", source: "local" },
        null,
        null,
        null,
      ],
      interest: null,
      reflection: "",
      rated: false,
    };
    const migrated = await browser.newPage();
    migrated.on("pageerror", (error) => errors.push(error.message));
    await migrated.addInitScript((value) => {
      if (!localStorage.getItem("17job:v1"))
        localStorage.setItem("17job:v1", JSON.stringify(value));
    }, legacy);
    await migrated.goto(baseURL);
    await migrated
      .getByRole("heading", { name: "해결할 문제 정의하기", exact: true })
      .waitFor();
    assert.equal(
      await migrated.locator("#mission-answer").inputValue(),
      legacy.responses[1],
    );
    await migrated.reload();
    await migrated
      .getByRole("heading", { name: "해결할 문제 정의하기", exact: true })
      .waitFor();
    assert.equal(
      await migrated.evaluate(
        () => JSON.parse(localStorage.getItem("17job:v1")).version,
      ),
      2,
    );

    // A neutral report never invents a preference; a long report keeps the start action reachable.
    for (const variant of ["neutral", "all-burdens"]) {
      const edge = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      edge.on("pageerror", (error) => errors.push(error.message));
      const value = {
        version: 2,
        stage: "results",
        answers: Object.fromEntries(
          Array.from({ length: 17 }, (_, index) => [
            index + 1,
            variant === "neutral" ? "both" : "B",
          ]),
        ),
        question: 16,
        activeJob: "analyst",
        experiences: {},
      };
      await edge.addInitScript((value) => {
        if (!localStorage.getItem("17job:v1"))
          localStorage.setItem("17job:v1", JSON.stringify(value));
      }, value);
      await edge.goto(baseURL);
      await edge
        .getByRole("heading", { name: "내가 확인해 볼 일의 조건", exact: true })
        .waitFor();
      await noOverflow(edge);
      if (variant === "neutral") {
        await edge
          .getByRole("heading", {
            name: "특정한 부담은 아직 드러나지 않았어요.",
            exact: true,
          })
          .waitFor();
        assert.equal(await edge.locator(".condition-list li").count(), 0);
      } else {
        assert.equal(
          await edge.locator(".condition-list li:visible").count(),
          3,
        );
        await edge
          .getByText("나머지 확인할 조건 14개 펼치기", { exact: true })
          .click();
        assert.equal(
          await edge.locator(".condition-list li:visible").count(),
          17,
        );
        await edge
          .getByRole("button", {
            name: "소득과 안정성 질문을 탐색 기록에 담기",
            exact: true,
          })
          .click();
      }
      await edge
        .getByRole("button", {
          name: "이 상황을 직접 확인해 보기",
          exact: false,
        })
        .click();
      await edge
        .getByRole("heading", { name: "이번에 확인할 나의 질문", exact: true })
        .waitFor();
      if (variant === "all-burdens") {
        await edge
          .getByText("이 체험으로 확인할 수 있는 범위", { exact: true })
          .click();
        assert.ok(
          (await edge.locator(".observation-guide").innerText()).includes(
            "직접 확인하기 어렵",
          ),
        );
      } else {
        const stored = await edge.evaluate(() =>
          JSON.parse(localStorage.getItem("17job:v1")),
        );
        assert.equal(
          stored.experiences.analyst.explorationFocus.sourceQuestionId,
          null,
        );
      }
      await noOverflow(edge);
    }
    const blocked = await browser.newPage();
    blocked.on("pageerror", (error) => errors.push(error.message));
    await blocked.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
    });
    await blocked.goto(baseURL);
    await blocked.locator(".save-warning").waitFor();
    await blocked.getByRole("button", { name: "나의 탐색 시작하기" }).click();
    await blocked.getByRole("radio").nth(2).check();
    assert.equal(
      await blocked.getByRole("button", { name: "다음 질문" }).isDisabled(),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 17 questions; planner regression and new analyst / 8 missions; job switching and isolated drafts; ratings and reflections; conditions-to-question direct start; self-reported discoveries; CSV/TXT downloads; next-action draft preservation; neutral/unobservable/17-burden cases; history; invalidation isolation; v1 migration; reload persistence; reset; mobile overflow; storage blocked; no browser errors",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
