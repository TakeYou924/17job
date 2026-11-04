import type { Answers, Question } from "./analysis.ts";
export type ExplorationFocus = {
  sourceQuestionId: number | null;
  condition: string;
  question: string;
  scope: string;
};
export type Feeling = "interesting" | "burdensome" | "unclear";
export type ConditionData = {
  id: number;
  A: { check: string; question: string; trialQuestion: string | null };
  B: { check: string; question: string; trialQuestion: string | null };
};
export function conditionPrompts(
  questions: Question[],
  answers: Answers,
  data: ConditionData[],
) {
  return questions.flatMap((question) => {
    const answer = answers[question.id];
    if (answer !== "A" && answer !== "B") return [];
    const guidance = data.find((row) => row.id === question.id)?.[answer];
    return guidance
      ? [
          {
            id: question.id,
            title: question.title,
            environment: answer === "A" ? question.a : question.b,
            ...guidance,
          },
        ]
      : [];
  });
}
export function focusFor(
  prompts: ReturnType<typeof conditionPrompts>,
  selectedId: number | null,
  fallback: { defaultQuestion: string; scope: string },
): ExplorationFocus {
  const selected = prompts.find((prompt) => prompt.id === selectedId);
  return {
    sourceQuestionId: selected?.id ?? null,
    condition: selected?.environment ?? "특정 부담은 아직 정하지 않았어요.",
    question: selected?.trialQuestion ?? fallback.defaultQuestion,
    scope:
      selected && !selected.trialQuestion
        ? `선택한 ‘${selected.title}’ 조건은 이번 체험에서 직접 확인하기 어렵습니다. 우선 숫자 비교와 불확실한 판단 과정을 관찰해 보세요. ${fallback.scope}`
        : fallback.scope,
  };
}
export function toggleFeeling(current: Feeling[], feeling: Feeling): Feeling[] {
  if (current.includes(feeling))
    return current.filter((value) => value !== feeling);
  if (feeling === "unclear") return ["unclear"];
  return [...current.filter((value) => value !== "unclear"), feeling];
}
