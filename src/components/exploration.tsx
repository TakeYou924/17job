"use client";
import content from "@/data/exploration.json";
import WorkEnvironmentReport from "@/components/report/report-view";
import questions from "@/data/questions.json";
import type { Answers } from "@/lib/analysis";
import {
  toggleFeeling,
  type ExplorationFocus,
  type Feeling,
  type conditionPrompts,
} from "@/lib/exploration";
import { switchNextAction, type Experience } from "@/lib/storage";
const feelingLabels: { id: Feeling; label: string }[] = [
  { id: "interesting", label: "흥미로웠어요" },
  { id: "burdensome", label: "버거웠어요" },
  { id: "unclear", label: "아직 모르겠어요" },
];
export function ConditionResults({
  prompts,
  onStart,
  onBrowse,
  savedFocus,
  answers,
  completedAt,
  onEdit,
}: {
  prompts: ReturnType<typeof conditionPrompts>;
  onStart: () => void;
  onBrowse: () => void;
  savedFocus: ExplorationFocus | null;
  answers: Answers;
  completedAt: string | null;
  onEdit: () => void;
}) {
  const bothCount = questions.filter(
    (question) => answers[question.id] === "both",
  ).length;
  return (
    <section
      className="panel result-sheet"
      aria-labelledby="conditions-heading"
    >
      <div className="sheet-heading">
        <span className="eyebrow">MY WORK CONDITIONS</span>
        <h2 id="conditions-heading">내가 일할 때 확인할 조건</h2>
        <p className="sheet-counts">
          부담으로 표시 {prompts.length}개 <span aria-hidden="true">·</span> 둘
          다 문제 없음 {bothCount}개
        </p>
      </div>
      <div className="sheet-section">
        <h3>부담으로 표시한 환경</h3>
        {prompts.length ? (
          <>
            <ul className="condition-tags">
              {prompts.map((prompt) => (
                <li key={prompt.id}>{prompt.shortLabel}</li>
              ))}
            </ul>
          </>
        ) : (
          <div className="sheet-neutral">
            <h3>특정한 부담은 아직 드러나지 않았어요.</h3>
            <p>
              모두 ‘둘 다 문제 없음’으로 답했어요. 선호나 능력이 확인된 것은
              아니에요.
            </p>
          </div>
        )}
      </div>
      <WorkEnvironmentReport
        answers={answers}
        completedAt={completedAt}
        onEdit={onEdit}
      />
      <div className="sheet-section sheet-next">
        <div>
          <span className="eyebrow">다음 한 걸음</span>
          <h3>{content.analyst.title}</h3>
          <p>
            표를 읽고, 원인이 아직 확실하지 않을 때 어떻게 느끼는지 살펴보세요.
          </p>
          <span className="small muted">{content.analyst.duration}</span>
        </div>
        <button className="primary" onClick={onStart}>
          이 상황을 직접 확인해 보기 →
        </button>
      </div>
      {savedFocus && (
        <div className="saved-focus-note">
          <b>이어서 볼 체험의 질문</b>
          <p>{savedFocus.question}</p>
          <small>이미 시작한 질문과 답변은 유지됩니다.</small>
        </div>
      )}
      <p className="sheet-footnote">
        표시한 응답을 요약한 결과예요. 직무 적합도나 부담의 심각도를 판단한 것은
        아닙니다.
      </p>
      <button className="text-button sheet-browse" onClick={onBrowse}>
        다른 경험도 둘러보기 →
      </button>
    </section>
  );
}

export function ObservationGuide({
  focus,
  mission,
}: {
  focus: ExplorationFocus;
  mission: number;
}) {
  return (
    <aside className="observation-guide">
      <span className="eyebrow">MY EXPLORATION QUESTION</span>
      <h2>이번에 확인할 나의 질문</h2>
      <p>{focus.question}</p>
      <p className="small muted">{content.analyst.noticing[mission]}</p>
      <details>
        <summary>이 체험으로 확인할 수 있는 범위</summary>
        <p>{focus.scope}</p>
      </details>
    </aside>
  );
}
export function DiscoveryRecord({
  experience,
  onChange,
  onCompare,
}: {
  experience: Experience;
  onChange: (patch: Partial<Experience>) => void;
  onCompare: () => void;
}) {
  const focus = experience.explorationFocus;
  const interesting = content.analyst.activities.filter((activity) =>
    experience.observations[activity.id]?.includes("interesting"),
  );
  const burdensome = content.analyst.activities.filter((activity) =>
    experience.observations[activity.id]?.includes("burdensome"),
  );
  const unknown = content.analyst.activities.filter(
    (activity) =>
      !experience.observations[activity.id]?.length ||
      experience.observations[activity.id]?.includes("unclear"),
  );
  const action = content.analyst.nextActions.find(
    (action) => action.id === experience.nextActionId,
  );
  function downloadRecord() {
    const lines = [
      "17job · 나의 탐색 기록",
      `출발점: ${focus?.condition ?? "아직 특정하지 않음"}`,
      `확인한 질문: ${focus?.question ?? content.analyst.defaultQuestion}`,
      "",
      ...content.analyst.activities.map(
        (activity) =>
          `${activity.label}: ${(experience.observations[activity.id] ?? []).map((value) => feelingLabels.find((feeling) => feeling.id === value)?.label).join(" · ") || "아직 기록하지 않음"}`,
      ),
      "",
      `내 회고: ${experience.reflection || "아직 기록하지 않음"}`,
      `다음 행동: ${action?.title ?? "아직 정하지 않음"}`,
      `행동 메모: ${experience.nextActionNote || "아직 기록하지 않음"}`,
      `실행 여부: ${experience.nextActionDone ? "직접 해봤다고 기록함" : "아직 완료로 기록하지 않음"}`,
      "",
      content.analyst.scope,
      "이 기록은 사용자가 직접 남긴 자기보고이며 직무 적합도나 능력의 판정이 아닙니다.",
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "17job-my-exploration.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="panel discovery-record"
      aria-labelledby="discovery-heading"
    >
      <span className="eyebrow">MY DISCOVERY, MY NEXT STEP</span>
      <h2 id="discovery-heading">직업 이름 대신, 나의 발견을 남겨요.</h2>
      <div className="discovery-question">
        <b>체험 전의 질문</b>
        <p>{focus?.question ?? content.analyst.defaultQuestion}</p>
        {focus && <p className="small muted">출발점: {focus.condition}</p>}
      </div>
      <h3>직접 해보니, 각 과정은 어땠나요?</h3>
      <p className="small muted">
        흥미롭고 버거웠던 느낌을 함께 선택해도 괜찮아요. 미선택은 아직 기록하지
        않은 상태이며, 느낌을 자동으로 추론하지 않습니다.
      </p>
      <div className="activity-observations">
        {content.analyst.activities.map((activity) => (
          <fieldset key={activity.id}>
            <legend>{activity.label}</legend>
            <div>
              {feelingLabels.map((feeling) => (
                <label
                  key={feeling.id}
                  className={
                    experience.observations[activity.id]?.includes(feeling.id)
                      ? "checked"
                      : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={
                      experience.observations[activity.id]?.includes(
                        feeling.id,
                      ) ?? false
                    }
                    onChange={() =>
                      onChange({
                        observations: {
                          ...experience.observations,
                          [activity.id]: toggleFeeling(
                            experience.observations[activity.id] ?? [],
                            feeling.id,
                          ),
                        },
                      })
                    }
                  />
                  {feeling.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="discovery-summary" aria-live="polite">
        <h3>내가 직접 남긴 탐색 기록</h3>
        <p>
          <b>흥미로웠던 과정</b>{" "}
          {interesting.map((a) => a.label).join(" · ") ||
            "아직 기록하지 않았어요."}
        </p>
        <p>
          <b>버거웠던 과정</b>{" "}
          {burdensome.map((a) => a.label).join(" · ") ||
            "아직 기록하지 않았어요."}
        </p>
        <p>
          <b>더 알아볼 과정</b>{" "}
          {unknown.map((a) => a.label).join(" · ") ||
            "다음 경험에서 느낌이 달라지는지도 살펴보세요."}
        </p>
        <p className="small muted">
          선택지의 정답 여부와 관계없이 내가 표시한 느낌만 정리했습니다.{" "}
          {content.analyst.scope}
        </p>
      </div>
      <h3>이제 무엇을 한 번 더 해볼까요?</h3>
      <p className="small muted">
        직무 순위 대신 다음 행동을 직접 골라 보세요. 아무것도 고르지 않아도
        기록은 남습니다.
      </p>
      <fieldset className="next-action-options">
        <legend className="sr-only">나의 다음 행동</legend>
        {content.analyst.nextActions.map((next) => (
          <label
            key={next.id}
            className={next.id === experience.nextActionId ? "selected" : ""}
          >
            <input
              type="radio"
              name="next-action"
              checked={next.id === experience.nextActionId}
              onChange={() => onChange(switchNextAction(experience, next.id))}
            />
            <span>
              <b>{next.title}</b>
              <small>{next.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {action && (
        <div className="action-plan">
          <h3>내가 고른 다음 행동: {action.title}</h3>
          {action.id === "spreadsheet" && (
            <a
              className="primary"
              href="/practice/checkout-devices.csv"
              download
            >
              연습용 표 내려받기 (CSV) ↓
            </a>
          )}
          {action.id === "compare" && (
            <button className="primary" onClick={onCompare}>
              인터뷰를 읽는 체험 시작하기 →
            </button>
          )}
          <label className="answer-label" htmlFor="next-action-note">
            {action.id === "hypothesis"
              ? "다른 원인 한 가지와 확인할 자료를 적어 보세요."
              : "이 행동에서 확인하고 싶은 점이나, 해본 뒤 알게 된 점을 적어 보세요."}
          </label>
          <textarea
            id="next-action-note"
            rows={3}
            maxLength={4000}
            value={experience.nextActionNote}
            onChange={(event) =>
              onChange({ nextActionNote: event.target.value })
            }
          />
          <label className="done-check">
            <input
              type="checkbox"
              checked={experience.nextActionDone}
              onChange={(event) =>
                onChange({ nextActionDone: event.target.checked })
              }
            />
            이 행동을 직접 해봤어요 (내 기록)
          </label>
          <p role="status" className="small muted">
            {experience.nextActionDone
              ? "해본 행동으로 기록했어요. 무엇을 발견했는지도 남겨 보세요."
              : "다음에 해볼 행동으로 기록했어요. 내려받거나 버튼을 누르는 것만으로 완료 처리하지 않습니다."}
          </p>
        </div>
      )}
      <button className="secondary record-download" onClick={downloadRecord}>
        내 탐색 기록 내려받기 (.txt) ↓
      </button>
    </section>
  );
}
