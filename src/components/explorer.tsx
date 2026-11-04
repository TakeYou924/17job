"use client";
import { useEffect, useRef, useState } from "react";
import questions from "@/data/questions.json";
import jobs from "@/data/jobs.json";
import exploration from "@/data/exploration.json";
import { conditionPrompts, focusFor } from "@/lib/exploration";
import {
  ConditionResults,
  ObservationGuide,
  DiscoveryRecord,
} from "@/components/exploration";
import { friction, recommend, type Answer } from "@/lib/analysis";
import { localFeedback } from "@/lib/feedback";
import {
  initialProgress,
  parseProgress,
  STORAGE_KEY,
  experienceFor,
  isComplete,
  selectJob,
  updateExperience,
  editResponse,
  chooseOption,
  type JobId,
  type Experience,
  type Progress,
  type Stage,
} from "@/lib/storage";
type Job = (typeof jobs)[number];
const interestLabels = [
  "전혀 끌리지 않아요",
  "별로 끌리지 않아요",
  "조금 더 알아보고 싶어요",
  "꽤 흥미로워요",
  "계속 해보고 싶어요",
];
export default function Explorer() {
  const [s, setS] = useState<Progress>(initialProgress);
  const experience = experienceFor(s);
  const activeJob = jobs.find((job) => job.id === s.activeJob)!;
  const updateCurrent = (patch: Partial<Experience>) =>
    setS((prev) => updateExperience(prev, patch));
  const openJob = (id: string) => {
    setNotice("");
    setS((prev) => {
      let next = selectJob(prev, id as JobId);
      if (id === "analyst" && !experienceFor(next).explorationFocus) {
        const prompts = conditionPrompts(
          questions,
          prev.answers,
          exploration.conditions,
        );
        next = updateExperience(next, {
          explorationFocus: focusFor(
            prompts,
            prev.focusQuestionId,
            exploration.analyst,
          ),
        });
      }
      return next;
    });
  };
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [resetting, setResetting] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const modal = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!resetting) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setResetting(false);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons =
        modal.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [resetting]);
  const update = (patch: Partial<Progress>) =>
    setS((prev) => ({ ...prev, ...patch }));
  useEffect(() => {
    try {
      const restored = parseProgress(localStorage.getItem(STORAGE_KEY));
      const job = jobs.find((job) => job.id === restored.activeJob);
      if (!job?.available) {
        restored.activeJob = "planner";
        if (restored.stage === "mission" || restored.stage === "complete")
          restored.stage = "jobs";
      }
      setS(restored);
    } catch {
      setSaveError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [s, ready]);
  useEffect(() => {
    if (ready) {
      title.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [s.stage, s.question, s.activeJob, experience.mission, ready]);
  const go = (stage: Stage) => {
    setNotice("");
    update({ stage });
  };
  const prompts = conditionPrompts(
    questions,
    s.answers,
    exploration.conditions,
  );
  const allAnswered = questions.every((q) => s.answers[q.id]);
  const q = questions[s.question];
  const mission = activeJob.missions[experience.mission];
  const currentFeedback = experience.feedback[experience.mission];
  async function submitMission() {
    if (mission.choices.length > 0 && !experience.choices[experience.mission]) {
      setNotice("선택지를 고르고 판단 근거를 적어 주세요.");
      return;
    }
    if (experience.responses[experience.mission].trim().length === 0) {
      setNotice("선택한 이유를 한 줄이라도 적어 주세요.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const jobId = s.activeJob;
      const index = experience.mission;
      const response = experience.responses[index];
      const choice = experience.choices[index];
      const feedback = await localFeedback.evaluate(mission, response, choice);
      setS((prev) => {
        const e = experienceFor(prev, jobId);
        if (e.responses[index] !== response || e.choices[index] !== choice)
          return prev;
        return updateExperience(
          prev,
          { feedback: e.feedback.map((f, i) => (i === index ? feedback : f)) },
          jobId,
        );
      });
    } catch {
      setNotice(
        "피드백을 준비하지 못했어요. 답변은 유지되니 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  const heading = (eyebrow: string, text: string, desc?: string) => (
    <div className="section-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1 tabIndex={-1} ref={title}>
        {text}
      </h1>
      {desc && <p>{desc}</p>}
    </div>
  );
  const jobCard = (job: Job) => {
    const matches = friction(job.environments, s.answers);
    const saved = experienceFor(s, job.id as JobId);
    const done = isComplete(saved);
    const started = saved.responses.some(Boolean);
    return (
      <article className="job-card" key={job.id} data-job-id={job.id}>
        <div className="card-top">
          <span className={`job-icon ${job.color}`} aria-hidden="true">
            {job.icon}
          </span>
          <span className={job.available ? "pill green" : "pill"}>
            {done
              ? "체험 완료"
              : started
                ? "진행 중"
                : job.available
                  ? "체험 가능"
                  : "준비 중"}
          </span>
        </div>
        <div className="small muted">
          {job.id === "analyst" ? `관련 직무: ${job.title}` : job.category}
        </div>
        <h3>{job.id === "analyst" ? exploration.analyst.title : job.title}</h3>
        <p>
          {job.id === "analyst"
            ? exploration.analyst.description
            : job.description}
        </p>
        <div className="tags">
          {job.tasks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {s.stage !== "home" && (
          <div className="environment-note">
            {matches.length
              ? `살펴볼 부담 환경: ${matches.map((id) => questions[id - 1].title).join(", ")}`
              : "등록된 대표 업무 환경에서 응답과 겹치는 부담이 없어요."}
            <details>
              <summary>업무 환경 살펴보기</summary>
              {job.environments.map((e) => (
                <p key={e.question}>
                  {e.answer === "A"
                    ? questions[e.question - 1].a
                    : questions[e.question - 1].b}
                </p>
              ))}
              <p>
                실제 환경은 조직·역할에 따라 달라요. 부담이 겹치지 않아도
                적합하다는 뜻은 아니에요.
              </p>
            </details>
          </div>
        )}
        <div className="card-bottom">
          <span>◷ {job.duration}</span>
          {job.available ? (
            <button
              className="text-button"
              onClick={() => openJob(job.id)}
              aria-label={`${job.title} ${done ? "회고 보기" : started ? "체험 이어가기" : "체험 시작"}`}
            >
              {done ? "회고 보기" : started ? "체험 이어가기" : "체험 시작"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <span className="small muted">곧 만나요</span>
          )}
        </div>
      </article>
    );
  };
  if (!ready)
    return (
      <main className="loading" aria-live="polite">
        탐색 기록을 불러오고 있어요…
      </main>
    );
  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="17job 홈"
        >
          17<span>job</span>
          <i />
        </button>
        <nav aria-label="주 메뉴">
          <button
            className={
              s.stage === "survey" || s.stage === "results" ? "active" : ""
            }
            onClick={() => go(allAnswered ? "results" : "survey")}
          >
            나의 업무 환경
          </button>
          <button
            className={
              s.stage === "jobs" || s.stage === "mission" ? "active" : ""
            }
            onClick={() => go(allAnswered ? "jobs" : "survey")}
          >
            직무 체험
          </button>
        </nav>
        <span className="header-note">
          <span className="status-dot" />
          작은 경험, 새로운 발견
        </span>
      </header>
      {saveError && (
        <div role="alert" className="save-warning">
          브라우저에 저장할 수 없어요. 현재 화면에서는 진행할 수 있지만
          새로고침하면 기록이 사라질 수 있습니다.
        </div>
      )}
      <main>
        {s.stage === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="pill hero-badge">
                  <span className="status-dot" /> 나에게 맞는 일을 찾는 새로운
                  방법
                </span>
                <h1 tabIndex={-1} ref={title}>
                  어떤 일이 맞을까?
                  <br />
                  <em>작게 경험하면,</em>
                  <br />
                  조금 더 선명해져요.
                </h1>
                <p>
                  좋아하는 일을 바로 찾지 못해도 괜찮아요.
                  <br />
                  나에게 버거운 환경을 알아보고,
                  <br className="mobile-only" /> 진짜 업무를 경험하며 탐색해
                  보세요.
                </p>
                <button
                  className="primary large"
                  onClick={() => go(allAnswered ? "results" : "survey")}
                >
                  {Object.keys(s.answers).length
                    ? "나의 탐색 이어가기"
                    : "나의 탐색 시작하기"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
                <div className="hero-meta">
                  <span>◷ 설문 약 3분</span>
                  <span>✓ 가입 없이 무료로</span>
                  <span>✧ AI API 없이 체험</span>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="질문, 경험, 발견으로 이어지는 탐색 과정"
              >
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="spark spark-one">✳</span>
                <span className="spark spark-two">✧</span>
                <div className="floating-note note-one">
                  <span className="mini-icon lavender">?</span>
                  <div>
                    <b>나를 이해하는 17가지 질문</b>
                    <small>잘하는 일보다, 감당할 수 있는 환경부터</small>
                  </div>
                </div>
                <div className="explore-window">
                  <div className="window-bar">
                    <span />
                    <span />
                    <span />
                    <small>MY CAREER EXPLORATION</small>
                  </div>
                  <div className="illustration-icon">↗</div>
                  <span className="eyebrow">
                    A SMALL STEP, A NEW POSSIBILITY
                  </span>
                  <h2>
                    경험이 쌓이면
                    <br />
                    나의 방향이 보여요.
                  </h2>
                  <div className="path">
                    <span>질문</span>
                    <i />
                    <span>경험</span>
                    <i />
                    <span className="filled">발견 ✦</span>
                  </div>
                </div>
                <div className="floating-note note-two">
                  <span className="mini-icon mint">✓</span>
                  <div>
                    <b>정답 대신, 나만의 발견</b>
                    <small>직접 해보고 느끼는 작은 직무 체험</small>
                  </div>
                </div>
                <span className="art-caption">
                  YOUR NEXT CHAPTER STARTS HERE
                </span>
              </div>
            </section>
            <section className="how-section">
              <div>
                <span className="eyebrow">HOW IT WORKS</span>
                <h2>나를 알아가는 세 번의 작은 걸음</h2>
              </div>
              <div className="steps">
                {[
                  [
                    "01",
                    "나의 환경 알아보기",
                    "17개의 질문으로 오래 감당하기 어려운 업무 환경을 살펴봐요.",
                  ],
                  [
                    "02",
                    "직접 경험해 보기",
                    "실제 상황을 바탕으로 한 작은 미션으로 직무를 경험해요.",
                  ],
                  [
                    "03",
                    "나의 방향 발견하기",
                    "해본 뒤의 감정을 돌아보고 다음 탐색으로 이어가요.",
                  ],
                ].map(([n, t, d]) => (
                  <div className="step" key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="jobs-section">
              <div className="section-row">
                <div>
                  <span className="eyebrow">EXPLORE THE POSSIBILITIES</span>
                  <h2>어떤 일을 경험해 볼까요?</h2>
                  <p className="muted">
                    다섯 가지 다른 일의 세계. 궁금한 직무부터 직접 경험해
                    보세요.
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => go(allAnswered ? "jobs" : "survey")}
                >
                  나의 작은 경험 찾아보기 ↗
                </button>
              </div>
              <div className="job-grid">{jobs.map(jobCard)}</div>
            </section>
            <div className="gentle-note">
              ✳ &nbsp; 이곳에는 당신의 직업을 결정하는 점수가 없어요. 직접
              경험하고, 나만의 기준을 만들어 보세요.
            </div>
          </>
        )}
        {s.stage === "survey" && (
          <section className="flow narrow">
            {heading(
              "STEP 01 · 나의 업무 환경",
              "어느 쪽이 더 버거울까요?",
              "좋아하는 쪽이 아니라, 장기간 감당하기 더 어려운 환경을 골라 주세요.",
            )}
            <div className="progress-label">
              <span>{q.title}</span>
              <b>
                {s.question + 1} <span className="muted">/ 17</span>
              </b>
            </div>
            <progress aria-label="설문 진행" max={17} value={s.question + 1} />
            <div className="question-panel">
              <span className="eyebrow">
                QUESTION {String(s.question + 1).padStart(2, "0")}
              </span>
              <h2>{q.prompt}</h2>
              <fieldset>
                <legend className="sr-only">감당하기 더 어려운 환경</legend>
                {(
                  [
                    ["A", q.a],
                    ["B", q.b],
                    ["both", "둘 다 문제 없음"],
                  ] as [Answer, string][]
                ).map(([value, label]) => (
                  <label
                    className={`option ${s.answers[q.id] === value ? "selected" : ""}`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={value}
                      checked={s.answers[q.id] === value}
                      onChange={() =>
                        update({
                          answers: { ...s.answers, [q.id]: value },
                          focusQuestionId:
                            s.focusQuestionId === q.id
                              ? null
                              : s.focusQuestionId,
                        })
                      }
                    />
                    <span className="option-letter">
                      {value === "both" ? "✓" : value}
                    </span>
                    <span>{label}</span>
                    <span className="radio-mark" />
                  </label>
                ))}
              </fieldset>
              <p className="helper">
                ‘둘 다 문제 없음’은 두 환경 모두 감당 가능하다는 의미예요.
                반대쪽을 선택하지 않았다고 좋아하거나 잘한다고 해석하지 않아요.
              </p>
            </div>
            <div className="actions">
              <button
                className="secondary"
                disabled={s.question === 0}
                onClick={() => update({ question: s.question - 1 })}
              >
                ← 이전
              </button>
              <span className="small muted">선택은 언제든 바꿀 수 있어요</span>
              <button
                className="primary"
                disabled={!s.answers[q.id]}
                onClick={() => {
                  if (s.question === 16) {
                    if (allAnswered) go("results");
                  } else update({ question: s.question + 1 });
                }}
              >
                {s.question === 16 ? "결과 살펴보기" : "다음 질문"} →
              </button>
            </div>
          </section>
        )}
        {s.stage === "results" && (
          <section className="flow">
            {heading(
              "STEP 01 · 나의 업무 환경",
              "내가 확인해 볼 일의 조건",
              "어울리는 직업을 정하는 대신, 응답한 부담을 실제로 확인할 질문과 작은 행동으로 연결했어요.",
            )}
            <ConditionResults
              prompts={prompts}
              selectedId={s.focusQuestionId}
              onSelect={(id) => update({ focusQuestionId: id })}
              onStart={() => openJob("analyst")}
              onBrowse={() => go("jobs")}
              savedFocus={experienceFor(s, "analyst").explorationFocus}
            />
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  update({ question: 0 });
                  go("survey");
                }}
              >
                응답 수정
              </button>
            </div>
          </section>
        )}
        {s.stage === "jobs" && (
          <section className="flow">
            {heading(
              "STEP 02 · 직무 체험",
              "작은 경험으로 알아보세요.",
              "다섯 가지 직무를 비교해 보세요. 부담 환경이 겹쳐도 체험을 제한하지 않습니다.",
            )}
            <div className="info-strip">
              서비스 기획자와 데이터 분석가의 <b>4단계 미션</b>을 체험할 수
              있어요. 나머지 직무는 준비 중입니다. 직무를 바꿔도 각 답변과
              회고는 따로 보관됩니다. 자료와 상황은 체험용 예시입니다.
            </div>
            <ExperienceHistory state={s} onOpen={openJob} />
            <div className="job-grid">{jobs.map(jobCard)}</div>
            <button
              className="text-button back-link"
              onClick={() => go("results")}
            >
              ← 업무 환경 분석 다시 보기
            </button>
          </section>
        )}
        {s.stage === "mission" && (
          <section className="flow">
            <div className="mission-layout">
              <aside className="mission-sidebar">
                <button className="text-button" onClick={() => go("jobs")}>
                  ← 직무 목록
                </button>
                <span className={`job-icon ${activeJob.color}`}>
                  {activeJob.icon}
                </span>
                <div className="eyebrow">YOUR CAREER EXPERIENCE</div>
                <h2>
                  {s.activeJob === "analyst"
                    ? exploration.analyst.title
                    : activeJob.title}
                </h2>
                {s.activeJob === "analyst" && (
                  <p>관련 직무: {activeJob.title}</p>
                )}
                <p>{activeJob.project}</p>
                <ol>
                  {activeJob.missions.map((m, i) => (
                    <li key={m.title}>
                      <button
                        disabled={
                          (i > 0 && !experience.feedback[i - 1]) || busy
                        }
                        className={i === experience.mission ? "current" : ""}
                        onClick={() => {
                          updateCurrent({ mission: i });
                          setNotice("");
                        }}
                      >
                        <span>{experience.feedback[i] ? "✓" : i + 1}</span>
                        {m.title}
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="small muted">
                  답변은 이 브라우저에 자동 저장돼요. 실제 AI와 대화하거나
                  회사에 제출되지 않습니다.
                </div>
              </aside>
              <div>
                {heading(
                  `MISSION 0${experience.mission + 1} / 04 · ${mission.subtitle}`,
                  mission.title,
                )}
                {s.activeJob === "analyst" && experience.explorationFocus && (
                  <ObservationGuide
                    focus={experience.explorationFocus}
                    mission={experience.mission}
                  />
                )}
                <div className="scenario">
                  <b>당신의 상황</b>
                  <p>{activeJob.scenario}</p>
                </div>
                <div className="panel mission-content">
                  <h2>업무 자료</h2>
                  {mission.table && (
                    <div className="data-table-wrap">
                      <table>
                        <caption>{mission.table.caption}</caption>
                        <thead>
                          <tr>
                            {mission.table.columns.map((column) => (
                              <th scope="col" key={column}>
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mission.table.rows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, k) => (
                                <td key={k}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <ul className="resources">
                    {mission.resources.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {mission.choices.length > 0 && (
                    <fieldset className="mission-choices">
                      <legend>{mission.decisionPrompt}</legend>
                      {mission.choices.map((choice) => (
                        <label
                          key={choice.id}
                          className={`option ${experience.choices[experience.mission] === choice.id ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="mission-choice"
                            value={choice.id}
                            checked={
                              experience.choices[experience.mission] ===
                              choice.id
                            }
                            onChange={() =>
                              setS((prev) => chooseOption(prev, choice.id))
                            }
                          />
                          <span className="option-letter">{choice.id}</span>
                          <span>{choice.label}</span>
                          <span className="radio-mark" />
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <label className="answer-label" htmlFor="mission-answer">
                    {mission.brief}
                  </label>
                  <textarea
                    id="mission-answer"
                    value={experience.responses[experience.mission]}
                    maxLength={4000}
                    rows={8}
                    placeholder={mission.placeholder}
                    onChange={(e) =>
                      setS((prev) => editResponse(prev, e.target.value))
                    }
                  />
                  <div className="textarea-meta">
                    <span>
                      짧게 적어도 괜찮아요 · 자료를 그대로 따라 쓸 필요는 없어요
                    </span>
                    <span>
                      {experience.responses[experience.mission].length}/4000
                    </span>
                  </div>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      (mission.choices.length > 0 &&
                        !experience.choices[experience.mission]) ||
                      experience.responses[experience.mission].trim().length ===
                        0
                    }
                    onClick={submitMission}
                  >
                    {busy
                      ? "피드백 준비 중…"
                      : currentFeedback
                        ? "피드백 다시 보기"
                        : "답변 제출하고 피드백 받기"}{" "}
                    ↗
                  </button>
                </div>
                {currentFeedback && (
                  <div className="feedback" role="status">
                    <span className="eyebrow">
                      REFLECTION GUIDE · 규칙 기반 피드백
                    </span>
                    <h2>생각을 한 걸음 더</h2>
                    <p>{currentFeedback.observation}</p>
                    <p>{currentFeedback.next}</p>
                    <small>
                      선택지는 제공 자료에 따른 해설을 보여줍니다. 서술 근거는
                      키워드 기반 성찰 안내이며 정확성·논리를 자동 판정하지
                      않습니다. 직무 적합도 평가가 아니에요.
                    </small>
                    <div className="actions">
                      <span />
                      <button
                        className="primary"
                        onClick={() =>
                          experience.mission === 3
                            ? go("complete")
                            : updateCurrent({ mission: experience.mission + 1 })
                        }
                      >
                        {experience.mission === 3
                          ? "체험 마무리하기"
                          : "다음 미션"}{" "}
                        →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        {s.stage === "complete" && (
          <section className="flow">
            {heading(
              "STEP 03 · 나의 발견",
              "한 가지 일을 경험했어요!",
              "잘했는지보다, 해보니 어땠는지 돌아볼 시간이에요.",
            )}
            <div className="completion-banner">
              <span>{activeJob.icon}</span>
              <div>
                <h2>
                  {s.activeJob === "analyst"
                    ? exploration.analyst.title
                    : activeJob.title}{" "}
                  · 4단계 체험 완료
                </h2>
                <p>{activeJob.project} — 내 생각으로 끝까지 해봤어요.</p>
              </div>
            </div>
            {s.activeJob === "analyst" && (
              <DiscoveryRecord
                experience={experience}
                onChange={updateCurrent}
                onCompare={() => openJob("planner")}
              />
            )}
            {s.activeJob === "analyst" ? (
              <details className="panel task-review">
                <summary>과제 선택과 자료 해설 다시 보기</summary>
                <CompletionReview job={activeJob} experience={experience} />
              </details>
            ) : (
              <CompletionReview job={activeJob} experience={experience} />
            )}
            <div className="panel">
              <h2>
                {s.activeJob === "analyst"
                  ? "전체 체험의 느낌도 남겨볼까요?"
                  : "이런 일을 더 해보고 싶나요?"}
              </h2>
              <fieldset className="interest-options">
                <legend className="sr-only">체험 후 흥미도</legend>
                {interestLabels.map((label, i) => (
                  <label
                    className={experience.interest === i + 1 ? "chosen" : ""}
                    key={label}
                  >
                    <input
                      type="radio"
                      name="interest"
                      checked={experience.interest === i + 1}
                      onChange={() =>
                        updateCurrent({ interest: i + 1, rated: false })
                      }
                    />
                    <span>{["☁", "◔", "◑", "◕", "☀"][i]}</span>
                    {label}
                  </label>
                ))}
              </fieldset>
              <label className="answer-label" htmlFor="reflection">
                어떤 순간이 흥미롭거나 버거웠나요?{" "}
                <span className="muted">(선택)</span>
              </label>
              <textarea
                id="reflection"
                rows={3}
                maxLength={4000}
                value={experience.reflection}
                placeholder="예: 자료를 읽고 문제를 찾는 과정은 즐거웠지만, 하나를 고르는 건 어려웠어요."
                onChange={(e) =>
                  updateCurrent({ reflection: e.target.value, rated: false })
                }
              />
              <button
                className="primary"
                disabled={experience.interest === null}
                onClick={() => updateCurrent({ rated: true })}
              >
                {experience.rated
                  ? "✓ 회고 저장됨"
                  : s.activeJob === "analyst"
                    ? "전체 느낌과 회고 기록하기"
                    : "회고 저장하고 다음 탐색 보기"}
              </button>
              <div role="status">
                {experience.rated && s.activeJob !== "analyst" && (
                  <p className="helper">
                    현재 브라우저에 흥미도와 회고를 기록했어요.
                  </p>
                )}
              </div>
            </div>
            {experience.rated && s.activeJob !== "analyst" && (
              <section className="next-exploration">
                <h2>다음엔 이런 경험은 어떨까요?</h2>
                <p className="muted">
                  {experience.interest !== null && experience.interest >= 4
                    ? "이번에 느낀 흥미를 다른 역할에서도 살펴보세요."
                    : "다른 업무 방식과 비교하며 나만의 기준을 찾아보세요."}{" "}
                  아래 순서는 등록된 대표 환경과 부담 응답이 적게 겹치는
                  후보부터이며, 적합도 순위가 아닙니다. 체험 가능한 후보는 바로
                  시작하거나 기록을 이어갈 수 있고, 나머지 직무는 준비 중입니다.
                </p>
                <div className="job-grid">
                  {recommend(jobs, s.answers, s.activeJob).map(jobCard)}
                </div>
              </section>
            )}
            <details className="panel answer-review">
              <summary>내가 작성한 답변 다시 보기</summary>
              {activeJob.missions.map((m, i) => (
                <div key={m.title}>
                  <h3>
                    {i + 1}. {m.title}
                  </h3>
                  <p>{experience.responses[i]}</p>
                </div>
              ))}
            </details>
            <div className="actions">
              <button className="secondary" onClick={() => go("mission")}>
                체험 돌아보기
              </button>
              <button className="text-button" onClick={() => go("results")}>
                내 업무 환경 다시 보기 →
              </button>
            </div>
          </section>
        )}
        {notice && (
          <p className="notice" role="alert">
            {notice}
          </p>
        )}
      </main>
      <footer>
        <div>
          <span className="footer-brand">17job</span>
          <span>직업을 정하기 전에, 나를 알아가는 시간.</span>
        </div>
        <div>
          <span>기록은 현재 브라우저에만 저장됩니다.</span>
          <button onClick={() => setResetting(true)}>내 기록 초기화</button>
        </div>
      </footer>
      {resetting && (
        <div className="modal-backdrop">
          <section
            ref={modal}
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-description"
          >
            <h2 id="reset-title">탐색 기록을 초기화할까요?</h2>
            <p id="reset-description">
              설문 응답, 미션 답변, 회고가 이 브라우저에서 삭제됩니다.
            </p>
            <div className="actions">
              <button
                autoFocus
                className="secondary"
                onClick={() => setResetting(false)}
              >
                취소
              </button>
              <button
                className="primary"
                onClick={() => {
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {
                    setSaveError(true);
                  }
                  setS(structuredClone(initialProgress));
                  setResetting(false);
                }}
              >
                전체 초기화
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ExperienceHistory({
  state,
  onOpen,
}: {
  state: Progress;
  onOpen: (id: string) => void;
}) {
  const savedJobs = jobs.filter((job) => state.experiences[job.id as JobId]);
  if (!savedJobs.length) return null;
  return (
    <section
      className="experience-history panel"
      aria-labelledby="history-title"
    >
      <div className="section-row">
        <h2 id="history-title">나의 탐색 기록</h2>
        <span className="pill green">
          {
            savedJobs.filter((job) =>
              isComplete(experienceFor(state, job.id as JobId)),
            ).length
          }{" "}
          / {jobs.filter((job) => job.available).length}개 체험 완료
        </span>
      </div>
      <p className="small muted">
        흥미는 체험 직후 내가 남긴 느낌이에요. 직무 적합도나 능력 평가가
        아닙니다.
      </p>
      <ul>
        {savedJobs.map((job) => {
          const e = experienceFor(state, job.id as JobId);
          const done = isComplete(e);
          return (
            <li key={job.id}>
              <span className={`job-icon ${job.color}`} aria-hidden="true">
                {job.icon}
              </span>
              <div>
                <h3>{job.title}</h3>
                <span className="small muted">
                  {done
                    ? "체험 완료"
                    : `${e.feedback.filter(Boolean).length}/4단계 제출`}
                  {e.rated && e.interest !== null
                    ? ` · ${interestLabels[e.interest - 1]}`
                    : ""}
                </span>
                {job.id === "analyst" && e.nextActionId && (
                  <p className="history-reflection">
                    다음 행동:{" "}
                    {
                      exploration.analyst.nextActions.find(
                        (action) => action.id === e.nextActionId,
                      )?.title
                    }{" "}
                    · {e.nextActionDone ? "직접 해봤어요" : "해볼 계획이에요"}
                  </p>
                )}
                {e.reflection && (
                  <p className="history-reflection">{e.reflection}</p>
                )}
              </div>
              <button
                className="text-button"
                onClick={() => onOpen(job.id)}
                aria-label={`${job.title} 기록 열기`}
              >
                {done ? "회고 보기" : "이어가기"} →
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CompletionReview({
  job,
  experience,
}: {
  job: Job;
  experience: Experience;
}) {
  const reviewed = job.missions.flatMap((mission, index) => {
    const choice = mission.choices.find(
      (c) => c.id === experience.choices[index],
    );
    return choice ? [{ mission, choice, index }] : [];
  });
  const supported = reviewed.filter((r) => r.choice.outcome === "supported");
  const reconsider = reviewed.filter((r) => r.choice.outcome === "reconsider");
  return (
    <section className="panel completion-review" aria-labelledby="review-title">
      <span className="eyebrow">EXPERIENCE REVIEW</span>
      <h2 id="review-title">이번 답변에서 발견한 점</h2>
      <p className="small muted">
        네 번의 짧은 과제에서 선택한 판단만 돌아봅니다. 개인의 직무 적합도나
        실제 역량 전체를 뜻하지 않으며, 작성 근거의 정확성을 자동 평가한 결과가
        아닙니다.
      </p>
      {reviewed.length > 0 ? (
        <div className="review-grid">
          <div>
            <h3>자료에 부합한 선택</h3>
            {supported.length ? (
              <ul>
                {supported.map((r) => (
                  <li key={r.index}>
                    <b>
                      {r.index + 1}. {r.mission.title}
                    </b>
                    <p>{r.choice.feedback}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                선택한 근거를 자료와 다시 대조하며 어떤 판단을 바꿔 볼지
                살펴보세요.
              </p>
            )}
          </div>
          <div>
            <h3>다시 살펴볼 판단</h3>
            {reconsider.length ? (
              <ul>
                {reconsider.map((r) => (
                  <li key={r.index}>
                    <b>
                      {r.index + 1}. {r.mission.title}
                    </b>
                    <p>{r.choice.feedback}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                선택 방향이 자료에 부합했어도 서술한 이유가 충분한지는 별도로
                확인해야 해요. 수치 근거와 판단의 한계를 다시 살펴보세요.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p>
          서술형 체험은 선택 판정 대신 작성한 생각을 돌아봅니다. 아래 ‘내가
          작성한 답변 다시 보기’에서 답변과 근거를 확인해 보세요.
        </p>
      )}
      <h3>실제 업무와의 차이</h3>
      <p>{job.realWork}</p>
      <div className="follow-up">
        <h3>더 탐색해 볼 후속 실습</h3>
        <p>{job.followUp}</p>
      </div>
    </section>
  );
}
