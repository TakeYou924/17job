import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  generateReport,
  parseReportPreview,
  reportDate,
  type EnvironmentReport,
  type ReportSource,
  type ReportData,
} from "../src/lib/report.ts";
import { reportSamples } from "../src/data/report-samples.ts";
import type { Answers, Question } from "../src/lib/analysis.ts";
const questions: Question[] = JSON.parse(
  readFileSync(new URL("../src/data/questions.json", import.meta.url), "utf8"),
);
const data: ReportData = JSON.parse(
  readFileSync(new URL("../src/data/report.json", import.meta.url), "utf8"),
);
const neutral = reportSamples[0].answers;
const report = (answers: Answers) => generateReport(questions, answers, data);
function supportedSources(result: EnvironmentReport, answers: Answers) {
  const items = [
    ...result.highlights,
    ...result.additional,
    ...result.scenes,
    ...result.workStyles,
    ...result.checklist,
  ];
  for (const item of items)
    for (const source of item.sources) {
      assert.equal(answers[source.questionId], source.answer);
      assert.notEqual(source.answer, "both");
      const question = questions.find((q) => q.id === source.questionId)!;
      assert.equal(
        source.text,
        source.answer === "A" ? question.a : question.b,
      );
    }
}
test("report data covers all 34 separate interpretations and exactly five domains", () => {
  assert.equal(data.interpretations.length, 17);
  assert.deepEqual(
    data.domains.map((domain) => domain.questions),
    [
      [1, 2, 3],
      [4, 5, 10, 17],
      [6, 7, 8, 9],
      [11, 12, 13],
      [14, 15, 16],
    ],
  );
  assert.deepEqual(
    data.domains.flatMap((domain) => domain.questions).sort((a, b) => a - b),
    Array.from({ length: 17 }, (_, index) => index + 1),
  );
  for (const item of data.interpretations)
    for (const answer of ["A", "B"] as const) {
      const value = item[answer];
      assert.ok(
        value.condition &&
          value.scene &&
          value.question &&
          value.explore &&
          value.example &&
          value.workStyle,
      );
      assert.notEqual(value.example, value.scene);
      assert.notEqual(value.workStyle, value.explore);
      assert.ok(
        !/적합합니다|선호합니다|잘합니다|능력이 낮|리더십이 부족/.test(
          JSON.stringify(value),
        ),
      );
    }
});
test("all C produces no burden, strength, combination or invented highlight", () => {
  const result = report(neutral);
  assert.equal(result.allBoth, true);
  assert.equal(result.burdenCount, 0);
  assert.equal(result.bothCount, 17);
  assert.deepEqual(result.highlights, []);
  assert.deepEqual(result.additional, []);
  assert.deepEqual(result.scenes, []);
  assert.ok(
    result.checklist.every(
      (question) => question.general && question.sources.length === 0,
    ),
  );
  for (const domain of result.domains) {
    assert.equal(domain.selected.length, 0);
    assert.equal(domain.bothCount, domain.questions.length);
    assert.equal(domain.missingCount, 0);
    assert.ok(domain.summary.join("").includes("판단하지 않습니다"));
  }
});
test("P01 to P05 activate only when both exact required answers match", () => {
  for (const rule of data.combinationRules) {
    const answers = {
      ...neutral,
      ...Object.fromEntries(
        rule.requirements.map((req) => [req.questionId, req.answer]),
      ),
    } as Answers;
    assert.ok(
      report(answers).matchedCombinations.some((item) => item.id === rule.id),
    );
    for (const requirement of rule.requirements) {
      const broken = { ...answers, [requirement.questionId]: "both" as const };
      assert.ok(
        !report(broken).matchedCombinations.some((item) => item.id === rule.id),
      );
    }
  }
});
test("required sample 2 uses two meaningful combinations and does not pad with a third", () => {
  const answers = reportSamples[1].answers,
    result = report(answers);
  assert.deepEqual(
    result.highlights.map((item) => item.id),
    ["P01", "P03"],
  );
  assert.equal(result.additional.length, 0);
  assert.equal(result.burdenCount, 4);
  supportedSources(result, answers);
  const domain = result.domains.find((domain) => domain.id === "structure")!;
  assert.equal(domain.details.length, 0);
  assert.equal(domain.covered.length, 2);
  assert.ok(!domain.summary.includes(result.highlights[1].confirmed));
});
test("required sample 3 describes trade-offs without inferring income or job preference", () => {
  const answers = reportSamples[2].answers,
    result = report(answers);
  assert.deepEqual(
    result.highlights.map((item) => item.id),
    ["P04", "P05"],
  );
  assert.equal(result.burdenCount, 4);
  assert.equal(
    result.domains.find((domain) => domain.id === "environment")!.selected
      .length,
    0,
  );
  supportedSources(result, answers);
  assert.ok(
    !/고소득을 선호|성취욕|직업에 적합/.test(JSON.stringify(result.highlights)),
  );
});
test("all A and all B interpret every burden from that side only", () => {
  for (const answer of ["A", "B"] as const) {
    const answers = Object.fromEntries(
      questions.map((question) => [question.id, answer]),
    ) as Answers;
    const result = report(answers);
    assert.equal(result.individuals.length, 17);
    assert.equal(result.bothCount, 0);
    supportedSources(result, answers);
    for (const source of result.individuals.flatMap((item) => item.sources))
      assert.equal(source.answer, answer);
  }
});
test("one or two burdens produce only their own cards and no unsupported domain traits", () => {
  for (const answers of [
    { ...neutral, 6: "B" as const },
    { ...neutral, 1: "A" as const, 14: "B" as const },
  ]) {
    const result = report(answers);
    assert.equal(result.highlights.length, result.burdenCount);
    assert.equal(result.matchedCombinations.length, 0);
    supportedSources(result, answers);
  }
  const environmentOnly=report({...neutral,1:'A'}).domains.find(domain=>domain.id==='environment')!;
  assert.ok(!/응대|근무 장소|근무장소/.test(environmentOnly.summary.join('')));
  const result = report({ ...neutral, 6: "B" });
  assert.equal(
    result.domains.filter((domain) => domain.selected.length).length,
    1,
  );
  assert.equal(result.highlights[0].sources[0].questionId, 6);
});
test("overlapping combinations do not repeat evidence and extras are bounded", () => {
  const answers = {
    ...neutral,
    5: "A",
    10: "A",
    6: "B",
    7: "A",
    9: "A",
    12: "A",
    13: "A",
    15: "B",
    16: "B",
  } as Answers;
  const result = report(answers);
  assert.equal(result.matchedCombinations.length, 5);
  assert.equal(result.highlights.length, 3);
  assert.ok(result.additional.length <= 2);
  const keys = result.highlights
    .concat(result.additional)
    .flatMap((item) =>
      item.sources.map((source) => `${source.questionId}${source.answer}`),
    );
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(
    new Set(result.highlights.flatMap((item) => item.domainIds)).size >= 3,
  );
  supportedSources(result, answers);
});
test("concrete work scenes and exploratory modes are not copies of core card text", () => {
  for (const sample of reportSamples.slice(1)) {
    const result = report(sample.answers);
    for (const scene of result.scenes)
      assert.ok(!result.highlights.some((item) => item.scene === scene.text));
    for (const mode of result.workStyles)
      assert.ok(!result.highlights.some((item) => item.explore === mode.text));
    assert.ok(
      result.scenes.length <= 3 &&
        result.workStyles.length <= 3 &&
        result.checklist.length <= 3,
    );
  }
});
test("missing answers never become C or count as completed", () => {
  const result = report({ 1: "A" });
  assert.equal(result.responseCount, 1);
  assert.equal(result.allBoth, false);
  assert.equal(result.bothCount, 0);
  assert.equal(result.sources.length, 1);
  assert.ok(result.domains.some((domain) => domain.missingCount > 0));
});
test("developer injection requires exactly 17 valid answers and normalizes C", () => {
  const value = Object.fromEntries(
    questions.map((question) => [question.id, "C"]),
  );
  assert.deepEqual(parseReportPreview(value, questions), neutral);
  for (const invalid of [
    null,
    [],
    {},
    { ...value, 1: "wrong" },
    { ...value, 18: "A" },
  ])
    assert.throws(() => parseReportPreview(invalid, questions));
});
test("report dates use Seoul calendar date and never invent legacy completion dates", () => {
  assert.equal(reportDate("2026-11-03T16:00:00Z"), "2026년 11월 4일");
  assert.equal(reportDate(null), "완료일 미기록");
  assert.equal(reportDate("bad"), "완료일 미기록");
});
