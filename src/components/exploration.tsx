"use client";
import content from "@/data/exploration.json";
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
  selectedId,
  onSelect,
  onStart,
  onBrowse,
  savedFocus,
}: {
  prompts: ReturnType<typeof conditionPrompts>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onStart: () => void;
  onBrowse: () => void;
  savedFocus: ExplorationFocus | null;
}) {
  const renderPrompt = (
    prompt: ReturnType<typeof conditionPrompts>[number],
  ) => (
    <li key={prompt.id}>
      <div className="condition-title">
        <span>{prompt.title}</span>
        <strong>{prompt.environment}</strong>
      </div>
      <p>
        <b>확인할 조건</b> {prompt.check}
      </p>
      <p>
        <b>아직 모르는 점</b> {prompt.question}
      </p>
      <button
        className={
          selectedId === prompt.id ? "secondary focus-selected" : "text-button"
        }
        onClick={() => onSelect(prompt.id)}
        aria-pressed={selectedId === prompt.id}
        aria-label={`${prompt.title} 질문을 탐색 기록에 담기`}
      >
        {selectedId === prompt.id
          ? "✓ 이번 탐색에 담았어요"
          : "이 질문을 탐색 기록에 담기"}{" "}
        →
      </button>
      {!prompt.trialQuestion && (
        <p className="helper">
          이 조건은 이번 온라인 체험만으로 확인하기 어려워요. 실제 근무 환경을
          알아볼 질문으로 남깁니다.
        </p>
      )}
    </li>
  );
  return (
    <>
      <section
        className="panel condition-results"
        aria-labelledby="conditions-heading"
      >
        <span className="eyebrow">MY WORK CONDITIONS</span>
        <h2 id="conditions-heading">일할 때 확인할 조건</h2>
        <p className="muted small">
          직업을 정하는 대신, 실제 환경을 알아볼 질문으로 바꿨어요. 표시 순서는
          설문 순서이며 중요도 순위가 아닙니다.
        </p>
        {prompts.length ? (
          <>
            {selectedId &&
              prompts.find((prompt) => prompt.id === selectedId) && (
                <p className="selected-question-note" role="status">
                  이번 탐색에 담은 질문:{" "}
                  {prompts.find((prompt) => prompt.id === selectedId)?.question}
                </p>
              )}
            <ul className="burden-list condition-list">
              {prompts.slice(0, 3).map(renderPrompt)}
            </ul>
            {prompts.length > 3 && (
              <details className="more-conditions">
                <summary>
                  나머지 확인할 조건 {prompts.length - 3}개 펼치기
                </summary>
                <p className="small muted">
                  먼저 보인 세 항목과 동일한 응답입니다. 중요도를 다르게
                  해석하지 않아요.
                </p>
                <ul className="burden-list condition-list">
                  {prompts.slice(3).map(renderPrompt)}
                </ul>
              </details>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h3>특정한 부담은 아직 드러나지 않았어요.</h3>
            <p>
              모두 ‘둘 다 문제 없음’으로 답했습니다. 어떤 일을 좋아하거나
              잘한다는 뜻은 아니에요. 작은 체험에서 어떤 과정이 흥미롭거나
              버거운지 관찰해 보세요.
            </p>
          </div>
        )}
      </section>
      <section
        className="panel trial-invitation"
        aria-labelledby="trial-heading"
      >
        <div>
          <span className="eyebrow">ONE SMALL EXPERIENCE</span>
          <h2 id="trial-heading">{content.analyst.title}</h2>
          <p>{content.analyst.description}</p>
          <p className="small muted">
            {content.analyst.duration} · 관련 직무: 데이터 분석가
          </p>
          {savedFocus && (
            <div className="saved-focus-note">
              <b>이어서 볼 체험의 질문</b>
              <p>{savedFocus.question}</p>
              <p className="small muted">
                이미 시작한 체험의 질문과 답변을 유지합니다. 새로 고른 조건은
                별도의 확인 목록으로 남겨요.
              </p>
            </div>
          )}
          <h3>이번에 관찰할 것</h3>
          <p>
            ‘숫자를 비교하는 과정’과 ‘원인을 아직 확정할 수 없는 상황’을 각각
            어떻게 느끼는지 살펴보세요. 부담이 겹치는지와 관계없이 체험할 수
            있어요.
          </p>
        </div>
        <div className="trial-actions">
          <button className="primary" onClick={onStart}>
            이 상황을 직접 확인해 보기 →
          </button>
          <button className="text-button" onClick={onBrowse}>
            다른 경험도 둘러보기
          </button>
        </div>
      </section>
    </>
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
