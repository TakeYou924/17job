import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyze,
  friction,
  recommend,
  type Answers,
} from "../src/lib/analysis.ts";
import { localFeedback, type Feedback } from "../src/lib/feedback.ts";
import {
  initialProgress,
  parseProgress,
  newExperience,
  experienceFor,
  selectJob,
  updateExperience,
  editResponse,
  chooseOption,
  isComplete,
  JOB_IDS,
  type Progress,
} from "../src/lib/storage.ts";
const questions = JSON.parse(
  readFileSync(new URL("../src/data/questions.json", import.meta.url), "utf8"),
);
const jobs = JSON.parse(
  readFileSync(new URL("../src/data/jobs.json", import.meta.url), "utf8"),
);
const answers: Answers = Object.fromEntries(
  Array.from({ length: 17 }, (_, i) => [i + 1, "both"]),
);
const feedback: Feedback = {
  observation: "자료 확인",
  next: "다음 확인",
  source: "local",
};
const completed = {
  ...newExperience(),
  mission: 3,
  responses: ["첫 답변", "두 번째", "세 번째", "네 번째"],
  feedback: Array(4).fill(feedback),
  interest: 4,
  reflection: "문제 찾기가 흥미로웠어요.",
  rated: true,
};

test("17 questions have complete option texts and sequential ids", () => {
  assert.equal(questions.length, 17);
  assert.deepEqual(
    questions.map((q: { id: number }) => q.id),
    Array.from({ length: 17 }, (_, i) => i + 1),
  );
  assert.ok(questions.every((q: { a: string; b: string }) => q.a && q.b));
});
test("only selected difficult environments appear; both never implies preference", () => {
  assert.deepEqual(
    analyze(questions, { 1: "A", 2: "B", 3: "both" }).map((x) => x.environment),
    [questions[0].a, questions[1].b],
  );
  assert.deepEqual(analyze(questions, answers), []);
});
test("recommendations expose overlap and exclude only current job", () => {
  assert.deepEqual(friction(jobs[0].environments, { 4: "B", 6: "both" }), [4]);
  const result = recommend(jobs, { 4: "B" }, "planner");
  assert.equal(result.length, 4);
  assert.equal(
    result.some((j: { id: string }) => j.id === "planner"),
    false,
  );
  assert.equal(result.at(-1)?.id, "designer");
});
test("only planner and analyst are available; each has four resource-based missions", async () => {
  assert.deepEqual(
    jobs.map((j: { id: string }) => j.id),
    [...JOB_IDS],
  );
  const titles = new Set<string>();
  assert.deepEqual(
    jobs
      .filter((job: { available: boolean }) => job.available)
      .map((job: { id: string }) => job.id),
    ["planner", "analyst"],
  );
  assert.ok(
    jobs
      .filter((job: { available: boolean }) => !job.available)
      .every((job: { missions: unknown[] }) => job.missions.length === 0),
  );
  for (const job of jobs.filter(
    (job: { available: boolean }) => job.available,
  )) {
    assert.equal(job.available, true);
    assert.ok(job.project && job.scenario);
    assert.equal(job.missions.length, 4);
    for (const mission of job.missions) {
      assert.ok(!titles.has(mission.title));
      titles.add(mission.title);
      assert.ok(mission.resources.length >= 2 && mission.criteria.length >= 2);
      const f = await localFeedback.evaluate(
        mission,
        "사용자 사실 가설 확인 품절 이유 이번 지표 위험",
      );
      assert.equal(f.source, "local");
      assert.ok(f.observation.length > 10 && f.next.length > 10);
      if (mission.table)
        assert.ok(
          mission.table.rows.every(
            (row: string[]) => row.length === mission.table.columns.length,
          ),
        );
    }
  }
  assert.equal(titles.size, 8);
});
test("v2 roundtrips; broken base data and unsupported schemas reset safely", () => {
  assert.deepEqual(
    parseProgress(JSON.stringify(initialProgress)),
    initialProgress,
  );
  for (const raw of [
    "broken",
    "null",
    JSON.stringify({ ...initialProgress, version: 3 }),
    JSON.stringify({ ...initialProgress, answers: { 1: "invalid" } }),
    JSON.stringify({ ...initialProgress, activeJob: "unknown" }),
  ]) {
    assert.deepEqual(parseProgress(raw), initialProgress);
  }
});
test("legacy first experience migrates without losing answers, feedback or reflection", () => {
  const legacy = {
    version: 1,
    stage: "complete",
    answers,
    question: 16,
    ...completed,
  };
  const migrated = parseProgress(JSON.stringify(legacy));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.activeJob, "planner");
  assert.equal(migrated.stage, "complete");
  assert.deepEqual(migrated.answers, answers);
  assert.deepEqual(migrated.experiences.planner, completed);
});
test("legacy unfinished mission and draft are preserved; malformed legacy feedback resets", () => {
  const legacy = {
    version: 1,
    stage: "mission",
    answers,
    question: 16,
    ...newExperience(),
    responses: ["작성 중", "", "", ""],
  };
  assert.equal(
    experienceFor(parseProgress(JSON.stringify(legacy))).responses[0],
    "작성 중",
  );
  assert.deepEqual(
    parseProgress(
      JSON.stringify({
        ...legacy,
        feedback: [{ bad: true }, null, null, null],
      }),
    ),
    initialProgress,
  );
});
test("switching jobs preserves independent drafts and resumes earliest unfinished mission", () => {
  let state: Progress = { ...structuredClone(initialProgress), answers };
  state = selectJob(state, "planner");
  state = updateExperience(state, {
    responses: ["기획 초안", "문제 정의 초안", "", ""],
    feedback: [feedback, null, null, null],
    mission: 1,
  });
  state = selectJob(state, "analyst");
  state = editResponse(state, "분석가 초안");
  assert.equal(state.activeJob, "analyst");
  assert.equal(experienceFor(state).responses[0], "분석가 초안");
  state = selectJob(state, "planner");
  assert.equal(experienceFor(state).mission, 1);
  assert.equal(experienceFor(state).responses[0], "기획 초안");
  assert.equal(experienceFor(state, "analyst").responses[0], "분석가 초안");
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
});
test("editing invalidates only that job from that step and retains other reflections", () => {
  const state: Progress = {
    ...structuredClone(initialProgress),
    answers,
    activeJob: "planner",
    experiences: {
      planner: { ...completed, mission: 1 },
      analyst: structuredClone(completed),
    },
  };
  const edited = editResponse(state, "수정된 문제 정의");
  assert.deepEqual(experienceFor(edited).feedback, [
    feedback,
    null,
    null,
    null,
  ]);
  assert.equal(experienceFor(edited).rated, false);
  assert.equal(isComplete(experienceFor(edited)), false);
  assert.deepEqual(experienceFor(edited, "analyst"), completed);
  assert.deepEqual(experienceFor(state).feedback, completed.feedback);
});
test("completed card opens its reflection; missing survey gates experience", () => {
  let state: Progress = {
    ...structuredClone(initialProgress),
    answers,
    experiences: { analyst: completed },
  };
  assert.equal(selectJob(state, "analyst").stage, "complete");
  state = { ...state, answers: {} };
  assert.equal(selectJob(state, "analyst").stage, "survey");
  assert.equal(
    parseProgress(JSON.stringify({ ...state, stage: "jobs" })).stage,
    "survey",
  );
});
test("damaged job data is isolated; impossible completion and noncontiguous feedback are repaired", () => {
  const state = {
    ...initialProgress,
    answers,
    activeJob: "analyst",
    stage: "complete",
    experiences: {
      planner: completed,
      analyst: { ...completed, feedback: [null, feedback, feedback, feedback] },
      operator: { bad: true },
    },
  };
  const result = parseProgress(JSON.stringify(state));
  assert.deepEqual(result.experiences.planner, completed);
  assert.equal(result.experiences.operator, undefined);
  assert.equal(result.stage, "mission");
  assert.deepEqual(experienceFor(result).feedback, [null, null, null, null]);
  assert.equal(experienceFor(result).mission, 0);
  assert.equal(experienceFor(result).rated, false);
});

test("analyst missions have four explained choices while the planner stays in its original written format", async () => {
  assert.ok(
    jobs[0].missions.every(
      (mission: { choices: unknown[] }) => mission.choices.length === 0,
    ),
  );
  for (const mission of jobs[1].missions) {
    assert.deepEqual(
      mission.choices.map((c: { id: string }) => c.id),
      ["A", "B", "C", "D"],
    );
    assert.equal(
      mission.choices.filter(
        (c: { outcome: string }) => c.outcome === "supported",
      ).length,
      1,
    );
    for (const choice of mission.choices) {
      const result = await localFeedback.evaluate(
        mission,
        "선택의 이유와 추가로 확인할 자료를 정리한 답변입니다.",
        choice.id,
      );
      assert.ok(result.observation.includes(choice.feedback));
      assert.ok(result.observation.includes(`선택 ${choice.id}`));
      assert.ok(result.next.includes(choice.next));
    }
  }
});
test("analyst feedback corrects premature causation and all aggregate data reconcile", async () => {
  const missions = jobs[1].missions;
  const result = await localFeedback.evaluate(
    missions[2],
    "오류가 늘었으므로 원인이라고 확정합니다.",
    "A",
  );
  assert.ok(result.observation.includes("인과관계가 확정되지는"));
  const better = await localFeedback.evaluate(
    missions[2],
    "오류 세션과 실패를 연결하고 중복을 확인합니다.",
    "B",
  );
  assert.ok(better.observation.includes("중복"));
  const amount = (value: string) => Number(value.replaceAll(",", ""));
  const device = missions[1].table.rows;
  assert.equal(
    amount(device[0][1]) + amount(device[1][1]),
    amount(device[2][1]),
  );
  assert.equal(
    amount(device[0][2]) + amount(device[1][2]),
    amount(device[2][2]),
  );
  assert.equal(amount(device[2][1]), amount(missions[0].table.rows[3][2]));
  assert.equal(amount(device[2][2]), amount(missions[0].table.rows[4][2]));
  const comparison = missions[2].table.rows;
  assert.equal(amount(comparison[0][2]) * 2, amount(device[1][1]));
  assert.equal(amount(comparison[1][2]) * 2, amount(device[1][2]));
  for (const column of [1, 2])
    assert.equal(
      [3, 4, 5].reduce((sum, row) => sum + amount(comparison[row][column]), 0),
      amount(comparison[6][column]),
    );
});
test("changing a choice invalidates only its job and saves chosen option", () => {
  const state: Progress = {
    ...structuredClone(initialProgress),
    answers,
    experiences: {
      planner: structuredClone(completed),
      analyst: structuredClone(completed),
    },
  };
  const changed = chooseOption(state, "B");
  assert.equal(experienceFor(changed).choices[3], "B");
  assert.deepEqual(experienceFor(changed).feedback, [
    feedback,
    feedback,
    feedback,
    null,
  ]);
  assert.equal(experienceFor(changed).rated, false);
  assert.deepEqual(experienceFor(changed, "analyst"), completed);
});
test("already-saved records without choice fields retain their original work", () => {
  const { choices: _choices, ...withoutChoices } = completed;
  const v1 = {
    version: 1,
    stage: "complete",
    answers,
    question: 16,
    ...withoutChoices,
  };
  const migrated = parseProgress(JSON.stringify(v1));
  assert.deepEqual(experienceFor(migrated).choices, [null, null, null, null]);
  assert.equal(experienceFor(migrated).reflection, completed.reflection);
  assert.equal(migrated.stage, "complete");
});

test('short reasoning is accepted with an explicit request for evidence',async()=>{
  const result=await localFeedback.evaluate(jobs[1].missions[2],'ㅇㅇ','A');
  assert.ok(result.observation.includes('인과관계가 확정되지는'));
  assert.ok(result.next.includes('근거가 짧아'));
});
