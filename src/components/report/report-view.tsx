"use client";
import questions from "@/data/questions.json";
import data from "@/data/report.json";
import type { Answers } from "@/lib/analysis";
import {
  generateReport,
  reportDate,
  type EnvironmentReport,
  type Finding,
  type ReportSource,
} from "@/lib/report";
function SourceLabel({ sources }: { sources: ReportSource[] }) {
  return (
    <span className="report-source-label">
      근거:{" "}
      {sources
        .map(
          (source) =>
            `${source.questionId}번 ${source.answer === "both" ? "C" : source.answer}`,
        )
        .join(" · ")}
    </span>
  );
}
function Evidence({ sources }: { sources: ReportSource[] }) {
  return (
    <details className="report-evidence">
      <summary>
        근거 보기 ·{" "}
        {sources
          .map(
            (source) =>
              `${source.questionId}${source.answer === "both" ? "C" : source.answer}`,
          )
          .join(" · ")}
      </summary>
      <ul>
        {sources.map((source) => (
          <li key={source.questionId}>
            <b>
              {source.questionId}번 · {source.title}
            </b>
            <p>
              {source.answer === "both" ? "C" : source.answer} · {source.text}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="report-finding" data-finding-id={finding.id}>
      <h4>{finding.title}</h4>
      <dl>
        <div>
          <dt>확인된 응답</dt>
          <dd>{finding.confirmed}</dd>
        </div>
        <div>
          <dt>실제 업무에서는</dt>
          <dd>{finding.scene}</dd>
        </div>
        <div>
          <dt>추가로 살펴볼 조건</dt>
          <dd>{finding.explore}</dd>
        </div>
      </dl>
      <SourceLabel sources={finding.sources} />
      <Evidence sources={finding.sources} />
    </article>
  );
}
function ReportHeader({
  report,
  date,
  preview = false,
  compact = false,
}: {
  report: EnvironmentReport;
  date: string | null;
  preview?: boolean;
  compact?: boolean;
}) {
  return (
    <header className="report-heading">
      {!compact && (
        <>
          <span>WORK ENVIRONMENT REPORT</span>
          <h2>나의 업무 환경 탐색 결과</h2>
          <p>17개 응답을 바탕으로 일할 때 고려할 조건을 정리했어요.</p>
        </>
      )}
      {compact && (
        <p className="report-complete-status">
          {report.responseCount}문항 응답 완료
        </p>
      )}
      <dl className="report-metadata">
        <div>
          <dt>{preview ? "샘플 생성일" : "검사 완료일"}</dt>
          <dd>{reportDate(date)}</dd>
        </div>
        <div>
          <dt>응답 문항</dt>
          <dd>{report.responseCount}개 / 17개</dd>
        </div>
        <div>
          <dt>결과 성격</dt>
          <dd>업무 환경 탐색</dd>
        </div>
      </dl>
      {preview && (
        <p className="report-preview-notice">
          개발자용 가상 응답 미리보기 · 실제 사용자 기록을 변경하지 않습니다.
        </p>
      )}
    </header>
  );
}
function Highlights({ report }: { report: EnvironmentReport }) {
  return (
    <section className="report-section report-highlights">
      <h3>눈여겨볼 업무 조건</h3>
      <p className="report-section-intro">
        여러 응답을 함께 살펴보며 확인할 가치가 있는 조건을 정리했습니다. 카드
        순서는 심리적 중요도 순위가 아닙니다.
      </p>
      {report.highlights.length ? (
        <div className="report-card-grid">
          {report.highlights.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      ) : (
        <div className="report-neutral">
          <h4>
            {report.allBoth
              ? "이번 설문에서는 뚜렷한 부담 조건이 확인되지 않았습니다."
              : "해설을 위해 응답을 더 확인해 주세요."}
          </h4>
          <p>
            {report.allBoth
              ? "17개 문항에서 특별히 감당하기 어렵다고 선택한 환경이 없습니다. 이번 결과만으로 특정 업무 방식이 더 적합하다고 판단하기는 어렵습니다."
              : "응답하지 않은 항목을 둘 다 문제 없음으로 해석하지 않습니다."}
          </p>
        </div>
      )}
    </section>
  );
}
function WorkScenes({ report }: { report: EnvironmentReport }) {
  if (!report.scenes.length) return null;
  return (
    <section className="report-section">
      <h3>실제 업무에서는 어떻게 나타날까요?</h3>
      <div className="report-scene-grid">
        <div className="report-caution">
          <h4>주의해서 살펴볼 업무</h4>
          <ul>
            {report.scenes.map((scene) => (
              <li key={scene.id}>
                <p>{scene.text}</p>
                <SourceLabel sources={scene.sources} />
              </li>
            ))}
          </ul>
        </div>
        <div className="report-exploration">
          <h4>추가로 살펴볼 업무 방식</h4>
          <p className="report-hypothesis">
            적합하다는 판정이 아닌, 아직 검증되지 않은 탐색 후보입니다.
          </p>
          <ul>
            {report.workStyles.map((style) => (
              <li key={style.id}>
                <p>{style.text}</p>
                <SourceLabel sources={style.sources} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
function Domains({
  report,
  print = false,
}: {
  report: EnvironmentReport;
  print?: boolean;
}) {
  return (
    <section className="report-section report-domains">
      <h3>5가지 관점으로 살펴본 업무 환경</h3>
      {report.domains.map((domain) => (
        <article
          className="report-domain"
          key={domain.id}
          data-domain-id={domain.id}
        >
          <h4>{domain.title}</h4>
          <p>
            {print
              ? (domain.selected.length
                  ? domain.summary
                  : [domain.summary[0]]
                ).join(" ")
              : domain.selected.length
                ? `${domain.selected.map((item) => `‘${item.condition}’`).join(", ")}에 부담을 표시했어요.`
                : domain.summary[0]}
          </p>
          {!print && (
            <details className="report-domain-details">
              <summary>
                {domain.selected.length
                  ? "자세한 해설과 근거 보기"
                  : "응답 근거 보기"}{" "}
                ·{" "}
                {domain.selected.length
                  ? `${domain.selected.length}개 부담 조건`
                  : `둘 다 문제 없음 ${domain.bothCount}개`}
              </summary>
              <p className="report-domain-context">
                {domain.summary.join(" ")}
              </p>
              {domain.details.map((item) => (
                <div key={item.id} className="report-individual-detail">
                  <b>{item.condition}</b>
                  <p>{item.confirmed}</p>
                  <p>{item.scene}</p>
                  <p>{item.explore}</p>
                  <SourceLabel sources={item.sources} />
                  <Evidence sources={item.sources} />
                </div>
              ))}
              {domain.covered.length > 0 && (
                <div className="report-covered">
                  <p>아래 응답은 해설 카드에서 함께 다뤘습니다.</p>
                  <ul>
                    {domain.covered.map((item) => (
                      <li key={item.id}>
                        {item.condition} <SourceLabel sources={item.sources} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="report-domain-responses">
                {report.sources
                  .filter((source) =>
                    domain.questions.includes(source.questionId),
                  )
                  .map((source) => (
                    <li key={source.questionId}>
                      {source.questionId}번{" "}
                      {source.answer === "both" ? "C" : source.answer} ·{" "}
                      {source.text}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </article>
      ))}
      {report.domains.some((domain) => !domain.selected.length) && (
        <p className="report-hypothesis">
          부담 조건이 없는 영역의 선호나 역량은 이번 응답만으로 판단하지
          않습니다.
        </p>
      )}
    </section>
  );
}
function Checklist({ report }: { report: EnvironmentReport }) {
  return (
    <section className="report-section report-checklist">
      <h3>직장을 선택할 때 확인해 보세요</h3>
      {report.allBoth && (
        <p className="report-hypothesis">
          부담 조건을 추론한 질문이 아닌, 누구나 활용할 수 있는 일반 확인
          질문입니다.
        </p>
      )}
      <ul>
        {report.checklist.map((item, index) => (
          <li key={item.text}>
            <span aria-hidden="true">✓</span>
            <div>
              <p>{item.text}</p>
              {!item.general && <SourceLabel sources={item.sources} />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
function InterpretationNotice({ report }: { report: EnvironmentReport }) {
  return (
    <div className="report-notice">
      <p>{report.disclaimer}</p>
      <p>
        A/B는 다른 선택지에 비해 상대적으로 더 어렵다고 선택한 조건입니다. 그
        환경에서 전혀 일할 수 없다는 뜻은 아닙니다. C는 두 환경 모두 감당
        가능하다는 응답이며 선호나 숙련을 뜻하지 않습니다.
      </p>
      <p>{report.limitation}</p>
    </div>
  );
}
export function PrintReport({
  report,
  date,
  preview,
}: {
  report: EnvironmentReport;
  date: string | null;
  preview?: boolean;
}) {
  return (
    <div
      className={`report-print${report.highlights.length >= 3 ? " report-print-flow" : ""}`}
      aria-hidden="true"
    >
      <div className="report-print-page">
        <ReportHeader report={report} date={date} preview={preview} />
        <Highlights report={report} />
        <WorkScenes report={report} />
        <p className="report-print-footer">
          개인 업무환경 안내서 · 업무 수행 능력이나 직무 적합도 점수가 아닙니다.
        </p>
      </div>
      <div className="report-print-page">
        <Domains report={report} print />
        {report.additional.length > 0 && (
          <section className="report-section">
            <h3>함께 고려하면 좋은 조건</h3>
            {report.additional.map((item) => (
              <div key={item.id}>
                <h4>{item.title}</h4>
                <p>
                  {item.confirmed} {item.explore}
                </p>
                <SourceLabel sources={item.sources} />
              </div>
            ))}
          </section>
        )}
        <Checklist report={report} />
        <section className="report-section report-print-answers">
          <h3>원본 응답 간단 요약</h3>
          <p>A/B: 상대적으로 더 어려운 조건 · C: 둘 다 문제 없음</p>
          <div>
            {report.sources.map((source) => (
              <span key={source.questionId}>
                {source.questionId}
                {source.answer === "both" ? "C" : source.answer}
              </span>
            ))}
          </div>
        </section>
        <InterpretationNotice report={report} />
      </div>
    </div>
  );
}
export default function WorkEnvironmentReport({
  answers,
  completedAt = null,
  onEdit,
  preview = false,
  compactHeader = false,
}: {
  answers: Answers;
  completedAt?: string | null;
  onEdit?: () => void;
  preview?: boolean;
  compactHeader?: boolean;
}) {
  const report = generateReport(questions, answers, data);
  return (
    <div className="interpretation-report">
      <div className="report-web">
        <ReportHeader
          report={report}
          date={completedAt}
          preview={preview}
          compact={compactHeader}
        />
        <Highlights report={report} />
        {report.scenes.length > 0 && (
          <details className="report-scenes-details">
            <summary>실제 업무 상황 자세히 보기</summary>
            <WorkScenes report={report} />
          </details>
        )}
        <Domains report={report} />
        {report.additional.length > 0 && (
          <section className="report-section report-additional">
            <details>
              <summary>함께 고려할 조건 더 보기</summary>
              <div className="report-card-grid">
                {report.additional.map((item) => (
                  <FindingCard key={item.id} finding={item} />
                ))}
              </div>
            </details>
          </section>
        )}
        <Checklist report={report} />
        <section className="report-section report-original">
          <details>
            <summary>전체 17개 응답 보기</summary>
            <div className="report-response-wrap">
              <table>
                <caption>17문항에서 선택한 응답</caption>
                <thead>
                  <tr>
                    <th scope="col">문항</th>
                    <th scope="col">내가 선택한 응답</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((source) => (
                    <tr key={source.questionId}>
                      <th scope="row">
                        {source.questionId}. {source.title}
                      </th>
                      <td>
                        <b>{source.answer === "both" ? "C" : source.answer}</b>{" "}
                        {source.text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InterpretationNotice report={report} />
          </details>
        </section>
        <div className="report-actions">
          {onEdit && (
            <button type="button" className="report-secondary" onClick={onEdit}>
              응답 수정
            </button>
          )}
          <button
            type="button"
            className="report-primary"
            onClick={() => window.print()}
          >
            인쇄 / PDF 저장
          </button>
        </div>
        <p className="report-print-help">
          인쇄 창에서 ‘PDF로 저장’을 선택할 수 있어요. 보고서 길이에 따라 2쪽
          이상으로 나뉩니다.
        </p>
      </div>
      <PrintReport report={report} date={completedAt} preview={preview} />
    </div>
  );
}
