import type { Answers, Answer, Question } from "./analysis.ts";
export type BurdenAnswer = "A" | "B";
export type ReportSource = {
  questionId: number;
  title: string;
  answer: Answer;
  text: string;
};
export type Interpretation = {
  title: string;
  condition: string;
  scene: string;
  question: string;
  explore: string;
  example: string;
  workStyle: string;
};
export type DomainDefinition = {
  id: string;
  title: string;
  questions: number[];
  context: string;
};
export type CombinationRule = {
  id: string;
  title: string;
  requirements: { questionId: number; answer: string }[];
  confirmed: string;
  scene: string;
  explore: string;
  example: string;
  workStyle: string;
};
export type ReportData = {
  version: string;
  interpretations: {
    id: number;
    title: string;
    A: Interpretation;
    B: Interpretation;
  }[];
  domains: DomainDefinition[];
  combinationRules: CombinationRule[];
  generalQuestions: string[];
  disclaimer: string;
  limitation: string;
};
export type Finding = {
  id: string;
  kind: "single" | "combination";
  title: string;
  confirmed: string;
  scene: string;
  explore: string;
  example: string;
  workStyle: string;
  domainIds: string[];
  sources: ReportSource[];
};
export type IndividualFinding = Finding & {
  question: string;
  condition: string;
};
export type DomainReport = DomainDefinition & {
  summary: string[];
  selected: IndividualFinding[];
  details: IndividualFinding[];
  covered: IndividualFinding[];
  bothCount: number;
  missingCount: number;
};
export type EnvironmentReport = {
  version: string;
  responseCount: number;
  bothCount: number;
  burdenCount: number;
  allBoth: boolean;
  sources: ReportSource[];
  individuals: IndividualFinding[];
  matchedCombinations: Finding[];
  highlights: Finding[];
  additional: Finding[];
  domains: DomainReport[];
  scenes: { id: string; text: string; sources: ReportSource[] }[];
  workStyles: { id: string; text: string; sources: ReportSource[] }[];
  checklist: { text: string; sources: ReportSource[]; general: boolean }[];
  disclaimer: string;
  limitation: string;
};
const sourceKey = (source: ReportSource) =>
  `${source.questionId}${source.answer}`;
function diverse<T extends { domainIds: string[]; sources: ReportSource[] }>(
  candidates: T[],
  limit: number,
  usedKeys = new Set<string>(),
  usedDomains = new Set<string>(),
): T[] {
  const pending = [...candidates],
    selected: T[] = [];
  while (pending.length && selected.length < limit) {
    const eligible = pending.filter((item) =>
      item.sources.every((source) => !usedKeys.has(sourceKey(source))),
    );
    if (!eligible.length) break;
    const pick =
      eligible.find((item) =>
        item.domainIds.some((id) => !usedDomains.has(id)),
      ) ?? eligible[0];
    selected.push(pick);
    pending.splice(pending.indexOf(pick), 1);
    pick.sources.forEach((source) => usedKeys.add(sourceKey(source)));
    pick.domainIds.forEach((id) => usedDomains.add(id));
  }
  return selected;
}
export function generateReport(
  questions: Question[],
  answers: Answers,
  data: ReportData,
): EnvironmentReport {
  const sources: ReportSource[] = questions.flatMap((question) => {
    const answer = answers[question.id];
    return answer === "A" || answer === "B" || answer === "both"
      ? [
          {
            questionId: question.id,
            title: question.title,
            answer,
            text:
              answer === "A"
                ? question.a
                : answer === "B"
                  ? question.b
                  : "둘 다 문제 없음",
          },
        ]
      : [];
  });
  const individuals: IndividualFinding[] = sources.flatMap((source) => {
    if (source.answer === "both") return [];
    const interpretation = data.interpretations.find(
      (item) => item.id === source.questionId,
    )?.[source.answer];
    if (!interpretation) return [];
    return [
      {
        id: `Q${source.questionId}${source.answer}`,
        kind: "single" as const,
        title: interpretation.title,
        condition: interpretation.condition,
        confirmed: `‘${interpretation.condition}’ 조건이 상대적으로 더 감당하기 어렵다고 선택했습니다.`,
        scene: `${interpretation.scene} 같은 상황은 부담이 될 수 있습니다.`,
        explore: interpretation.explore,
        example: interpretation.example,
        workStyle: interpretation.workStyle,
        question: interpretation.question,
        domainIds: data.domains
          .filter((domain) => domain.questions.includes(source.questionId))
          .map((domain) => domain.id),
        sources: [source],
      },
    ];
  });
  const matchedCombinations: Finding[] = data.combinationRules.flatMap(
    (rule) => {
      if (
        !rule.requirements.every(
          (requirement) =>
            answers[requirement.questionId] === requirement.answer,
        )
      )
        return [];
      const evidence = rule.requirements.flatMap((requirement) =>
        sources.filter(
          (source) =>
            source.questionId === requirement.questionId &&
            source.answer === requirement.answer,
        ),
      );
      return [
        {
          id: rule.id,
          kind: "combination" as const,
          title: rule.title,
          confirmed: rule.confirmed,
          scene: rule.scene,
          explore: rule.explore,
          example: rule.example,
          workStyle: rule.workStyle,
          domainIds: data.domains
            .filter((domain) =>
              rule.requirements.some((requirement) =>
                domain.questions.includes(requirement.questionId),
              ),
            )
            .map((domain) => domain.id),
          sources: evidence,
        },
      ];
    },
  );
  const used = new Set<string>(),
    domainIds = new Set<string>();
  const highlights = diverse(matchedCombinations, 3, used, domainIds);
  highlights.push(
    ...diverse(individuals, 3 - highlights.length, used, domainIds),
  );
  // A shared answer must not produce a second card that repeats the same condition.
  const additional = diverse(
    matchedCombinations.filter(
      (item) => !highlights.some((highlight) => highlight.id === item.id),
    ),
    2,
    new Set(used),
    new Set(domainIds),
  );
  const explained = new Set(
    [...highlights, ...additional].flatMap((finding) =>
      finding.sources.map(sourceKey),
    ),
  );
  const domains: DomainReport[] = data.domains.map((domain) => {
    const selected = individuals.filter((item) =>
      item.domainIds.includes(domain.id),
    );
    const details = selected.filter(
      (item) => !explained.has(sourceKey(item.sources[0])),
    );
    const covered = selected.filter((item) =>
      explained.has(sourceKey(item.sources[0])),
    );
    const bothCount = sources.filter(
      (source) =>
        domain.questions.includes(source.questionId) &&
        source.answer === "both",
    ).length;
    const missingCount =
      domain.questions.length -
      sources.filter((source) => domain.questions.includes(source.questionId))
        .length;
    const context =
      selected.length === domain.questions.length
        ? domain.context
        : `${selected.map((item) => item.sources[0].title).join("·")}에 해당하는 실제 업무 조건과 운영 방식을 확인해 보세요.`;
    const summary =
      selected.length === 0
        ? [
            missingCount
              ? "이 영역에는 아직 응답하지 않은 문항이 있습니다."
              : "이 영역에서는 특별히 더 어렵다고 선택한 조건이 없습니다.",
            "이번 응답만으로 이 영역의 선호나 역량을 판단하지 않습니다.",
          ]
        : details.length
          ? [
              `이 영역에서 추가로 살펴볼 부담 조건은 ${details.map((item) => `‘${item.condition}’`).join(", ")}입니다.`,
              context,
            ]
          : [
              "이 영역에서 선택한 조건은 해설 카드에서 함께 설명했습니다.",
              context,
            ];
    return {
      ...domain,
      selected,
      details,
      covered,
      bothCount,
      missingCount,
      summary,
    };
  });
  const scenarioCandidates = [...highlights, ...additional, ...individuals];
  const scenarioSelection = diverse(scenarioCandidates, 3);
  const checklistSelection = diverse(individuals, 3);
  const responseCount = sources.length,
    bothCount = sources.filter((source) => source.answer === "both").length;
  return {
    version: data.version,
    responseCount,
    bothCount,
    burdenCount: individuals.length,
    allBoth:
      responseCount === questions.length && bothCount === questions.length,
    sources,
    individuals,
    matchedCombinations,
    highlights,
    additional,
    domains,
    scenes: scenarioSelection.map((item) => ({
      id: item.id,
      text: item.example,
      sources: item.sources,
    })),
    workStyles: scenarioSelection.map((item) => ({
      id: item.id,
      text: item.workStyle,
      sources: item.sources,
    })),
    checklist: checklistSelection.length
      ? checklistSelection.map((item) => ({
          text: item.question,
          sources: item.sources,
          general: false,
        }))
      : data.generalQuestions
          .slice(0, 3)
          .map((text) => ({ text, sources: [], general: true })),
    disclaimer: data.disclaimer,
    limitation: data.limitation,
  };
}
export function parseReportPreview(
  value: unknown,
  questions: Question[],
): Answers {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("문항 번호를 키로 갖는 JSON 객체를 입력하세요.");
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== questions.length ||
    Object.keys(record).some(
      (key) => !questions.some((question) => String(question.id) === key),
    )
  )
    throw new Error("1~17번 응답을 빠짐없이 입력하세요.");
  const result: Answers = {};
  for (const question of questions) {
    const answer = record[question.id];
    if (answer !== "A" && answer !== "B" && answer !== "C" && answer !== "both")
      throw new Error(
        `${question.id}번은 A, B, C(둘 다 문제 없음) 중 하나여야 합니다.`,
      );
    result[question.id] = answer === "C" ? "both" : answer;
  }
  return result;
}
export function reportDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "완료일 미기록";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
