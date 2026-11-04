import type { Answers } from "./analysis.ts";
import type { ExplorationFocus, Feeling } from "./exploration.ts";
import type { Feedback } from "./feedback.ts";
// Keep the original key so existing users' first experience can be migrated.
export const STORAGE_KEY = "17job:v1";
export const JOB_IDS = [
  "planner",
  "analyst",
  "designer",
  "marketer",
  "operator",
] as const;
export type JobId = (typeof JOB_IDS)[number];
export type Stage =
  "home" | "survey" | "results" | "jobs" | "mission" | "complete";
export type Experience = {
  mission: number;
  responses: string[];
  choices: (string | null)[];
  feedback: (Feedback | null)[];
  interest: number | null;
  reflection: string;
  rated: boolean;
  explorationFocus: ExplorationFocus | null;
  observations: Record<string, Feeling[]>;
  nextActionId: string | null;
  nextActionNote: string;
  nextActionDone: boolean;
};
export type Progress = {
  version: 2;
  stage: Stage;
  answers: Answers;
  question: number;
  activeJob: JobId;
  focusQuestionId: number | null;
  experiences: Partial<Record<JobId, Experience>>;
};
export function newExperience(): Experience {
  return {
    mission: 0,
    responses: ["", "", "", ""],
    choices: [null, null, null, null],
    feedback: [null, null, null, null],
    interest: null,
    reflection: "",
    rated: false,
    explorationFocus: null,
    observations: {},
    nextActionId: null,
    nextActionNote: "",
    nextActionDone: false,
  };
}
export const initialProgress: Progress = {
  version: 2,
  stage: "home",
  answers: {},
  question: 0,
  activeJob: "planner",
  focusQuestionId: null,
  experiences: {},
};
export function experienceFor(
  state: Progress,
  id: JobId = state.activeJob,
): Experience {
  return state.experiences[id] ?? newExperience();
}
export function isComplete(experience: Experience): boolean {
  return experience.feedback.every(Boolean);
}
export function updateExperience(
  state: Progress,
  patch: Partial<Experience>,
  id: JobId = state.activeJob,
): Progress {
  return {
    ...state,
    experiences: {
      ...state.experiences,
      [id]: { ...experienceFor(state, id), ...patch },
    },
  };
}
export function editResponse(state: Progress, response: string): Progress {
  const e = experienceFor(state);
  return updateExperience(state, {
    responses: e.responses.map((text, i) =>
      i === e.mission ? response : text,
    ),
    feedback: e.feedback.map((feedback, i) =>
      i >= e.mission ? null : feedback,
    ),
    rated: false,
  });
}
export function selectJob(state: Progress, id: JobId): Progress {
  const e = experienceFor(state, id);
  const unanswered = e.feedback.findIndex((f) => !f);
  return {
    ...updateExperience(
      state,
      { mission: unanswered < 0 ? e.mission : unanswered },
      id,
    ),
    activeJob: id,
    stage:
      Object.keys(state.answers).length !== 17
        ? "survey"
        : isComplete(e)
          ? "complete"
          : "mission",
  };
}
export function chooseOption(state: Progress, choice: string): Progress {
  if (!["A", "B", "C", "D"].includes(choice)) return state;
  const e = experienceFor(state);
  return updateExperience(state, {
    choices: e.choices.map((previous, i) =>
      i === e.mission ? choice : previous,
    ),
    feedback: e.feedback.map((feedback, i) =>
      i >= e.mission ? null : feedback,
    ),
    rated: false,
  });
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validExperience(
  value: unknown,
): value is Experience & Record<string, unknown> {
  if (!record(value)) return false;
  return (
    Number.isInteger(value.mission) &&
    Number(value.mission) >= 0 &&
    Number(value.mission) <= 3 &&
    Array.isArray(value.responses) &&
    value.responses.length === 4 &&
    value.responses.every((x) => typeof x === "string" && x.length <= 4000) &&
    (value.choices === undefined ||
      (Array.isArray(value.choices) &&
        value.choices.length === 4 &&
        value.choices.every(
          (x) => x === null || ["A", "B", "C", "D"].includes(x),
        ))) &&
    Array.isArray(value.feedback) &&
    value.feedback.length === 4 &&
    value.feedback.every(
      (f) =>
        f === null ||
        (record(f) &&
          typeof f.observation === "string" &&
          typeof f.next === "string" &&
          f.source === "local"),
    ) &&
    (value.interest === null ||
      (Number.isInteger(value.interest) &&
        Number(value.interest) >= 1 &&
        Number(value.interest) <= 5)) &&
    typeof value.reflection === "string" &&
    value.reflection.length <= 4000 &&
    typeof value.rated === "boolean"
  );
}
function normalizeExperience(e: Experience): Experience {
  const { mission, responses, feedback, interest, reflection, rated } = e;
  const choices = e.choices ?? [null, null, null, null];
  const explorationFocus =
    record(e.explorationFocus) &&
    (e.explorationFocus.sourceQuestionId === null ||
      (Number.isInteger(e.explorationFocus.sourceQuestionId) &&
        Number(e.explorationFocus.sourceQuestionId) >= 1 &&
        Number(e.explorationFocus.sourceQuestionId) <= 17)) &&
    ["condition", "question", "scope"].every(
      (key) =>
        typeof e.explorationFocus?.[key as keyof ExplorationFocus] === "string",
    )
      ? e.explorationFocus
      : null;
  const observations: Record<string, Feeling[]> = {};
  if (record(e.observations))
    for (const id of ["numbers", "investigate", "uncertainty", "report"]) {
      const values = e.observations[id];
      if (
        Array.isArray(values) &&
        values.every((value) =>
          ["interesting", "burdensome", "unclear"].includes(value),
        )
      )
        observations[id] = values.includes("unclear")
          ? ["unclear"]
          : ([...new Set(values)] as Feeling[]);
    }
  const nextActionId = ["spreadsheet", "hypothesis", "compare"].includes(
    e.nextActionId ?? "",
  )
    ? e.nextActionId
    : null;
  const nextActionNote =
    typeof e.nextActionNote === "string" && e.nextActionNote.length <= 4000
      ? e.nextActionNote
      : "";
  const nextActionDone = !!nextActionId && e.nextActionDone === true;
  const result: Experience = structuredClone({
    mission,
    responses,
    choices,
    explorationFocus,
    observations,
    nextActionId,
    nextActionNote,
    nextActionDone,
    feedback,
    interest,
    reflection,
    rated,
  });
  const first = result.feedback.findIndex((f) => !f);
  if (first >= 0) {
    // Later feedback cannot remain valid after an earlier stage is invalidated.
    result.feedback.fill(null, first);
    result.mission = Math.min(result.mission, first);
    result.rated = false;
  }
  if (result.interest === null) result.rated = false;
  return result;
}
export function parseProgress(raw: string | null): Progress {
  try {
    if (!raw) return structuredClone(initialProgress);
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return structuredClone(initialProgress);
    const stages = ["home", "survey", "results", "jobs", "mission", "complete"];
    if (
      ![1, 2].includes(Number(value.version)) ||
      !stages.includes(value.stage as string) ||
      !record(value.answers) ||
      Object.entries(value.answers).some(
        ([k, v]) =>
          !/^([1-9]|1[0-7])$/.test(k) ||
          !["A", "B", "both"].includes(v as string),
      ) ||
      !Number.isInteger(value.question) ||
      Number(value.question) < 0 ||
      Number(value.question) > 16
    )
      return structuredClone(initialProgress);
    let state: Progress;
    if (value.version === 1) {
      if (!validExperience(value)) return structuredClone(initialProgress);
      state = {
        version: 2,
        stage: value.stage as Stage,
        answers: value.answers as Answers,
        question: Number(value.question),
        activeJob: "planner",
        focusQuestionId: null,
        experiences: { planner: normalizeExperience(value) },
      };
    } else {
      if (
        value.version !== 2 ||
        !JOB_IDS.includes(value.activeJob as JobId) ||
        !record(value.experiences)
      )
        return structuredClone(initialProgress);
      const experiences: Progress["experiences"] = {};
      for (const id of JOB_IDS) {
        const e = value.experiences[id];
        // Isolate a damaged job record rather than losing all other experiences.
        if (validExperience(e)) experiences[id] = normalizeExperience(e);
      }
      state = {
        version: 2,
        stage: value.stage as Stage,
        answers: value.answers as Answers,
        question: Number(value.question),
        activeJob: value.activeJob as JobId,
        focusQuestionId:
          Number.isInteger(value.focusQuestionId) &&
          Number(value.focusQuestionId) >= 1 &&
          Number(value.focusQuestionId) <= 17
            ? Number(value.focusQuestionId)
            : null,
        experiences,
      };
    }
    if (
      ["results", "jobs", "mission", "complete"].includes(state.stage) &&
      Object.keys(state.answers).length !== 17
    )
      state.stage = "survey";
    if (state.stage === "complete" && !isComplete(experienceFor(state)))
      state.stage = "mission";
    return state;
  } catch {
    return structuredClone(initialProgress);
  }
}
