export type Criterion = { label: string; keywords: string[] };
export type Choice = {
  id: string;
  label: string;
  outcome: string;
  feedback: string;
  next: string;
};
export type Mission = {
  title: string;
  subtitle: string;
  brief: string;
  resources: string[];
  placeholder: string;
  criteria: Criterion[];
  choices?: Choice[];
};
export type Feedback = { observation: string; next: string; source: "local" };
// API adapters can keep the same asynchronous interface and run server-side.
export interface FeedbackProvider {
  evaluate(
    mission: Mission,
    response: string,
    choiceId?: string | null,
  ): Promise<Feedback>;
}
export const localFeedback: FeedbackProvider = {
  async evaluate(mission, response, choiceId) {
    const choice = mission.choices?.find((option) => option.id === choiceId);
    const found = mission.criteria.filter((c) =>
      c.keywords.some((k) => response.includes(k)),
    );
    const missing = mission.criteria.filter((c) => !found.includes(c));
    const writingGuide =
      response.trim().length < 20
        ? "적어주신 근거가 짧아 판단 과정을 충분히 확인하기 어려워요. 자료의 수치나 사실을 하나 골라 선택 이유를 구체적으로 설명해 보세요."
        : missing.length
          ? `작성 근거에서 더 살펴볼 점: ‘${missing[0].label}’을 구체적으로 설명해 보세요.`
          : "작성한 근거가 자료와 연결되는지, 반대 가설이나 추가 확인할 점은 없는지 살펴보세요.";
    return {
      observation: choice
        ? `선택 ${choice.id} · ${choice.label}. ${choice.feedback}`
        : found.length
          ? `답변에서 ‘${found.map((c) => c.label).join("’, ‘")}’ 관련 표현을 찾았어요. 해당 내용이 자료와 연결되는지 직접 확인해 보세요.`
          : "생각을 기록했어요. 자료의 어떤 내용이 판단의 근거인지 한 문장 더 적어 보세요.",
      next: `${choice?.next ?? "한 걸음 더: 내 판단과 다른 설명도 가능할까요?"} ${writingGuide}`,
      source: "local",
    };
  },
};
