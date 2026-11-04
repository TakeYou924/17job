"use client";
import { useState } from "react";
import questions from "@/data/questions.json";
import { reportSamples } from "@/data/report-samples";
import { parseReportPreview } from "@/lib/report";
import WorkEnvironmentReport from "./report-view";
export default function ReportPreview({
  generatedAt,
}: {
  generatedAt: string;
}) {
  const [answers, setAnswers] = useState(reportSamples[0].answers);
  const [json, setJson] = useState(
    JSON.stringify(reportSamples[0].answers, null, 2),
  );
  const [error, setError] = useState("");
  return (
    <main className="report-preview-page">
      <section className="report-preview-controls">
        <h1>해설지 개발 미리보기</h1>
        <p>
          가상 응답만 주입합니다. 실제 설문 기록과 localStorage는 변경하지
          않습니다.
        </p>
        <label htmlFor="report-sample">샘플 응답</label>
        <select
          id="report-sample"
          defaultValue={reportSamples[0].id}
          onChange={(event) => {
            const sample = reportSamples.find(
              (sample) => sample.id === event.target.value,
            )!;
            setAnswers(sample.answers);
            setJson(JSON.stringify(sample.answers, null, 2));
            setError("");
          }}
        >
          {reportSamples.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.label}
            </option>
          ))}
        </select>
        <details>
          <summary>직접 응답 JSON 입력</summary>
          <label htmlFor="report-preview-json">
            1~17번 응답 · A / B / C 또는 both
          </label>
          <textarea
            id="report-preview-json"
            rows={12}
            value={json}
            onChange={(event) => setJson(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              try {
                setAnswers(parseReportPreview(JSON.parse(json), questions));
                setError("");
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "JSON 형식을 확인하세요.",
                );
              }
            }}
          >
            가상 응답 적용
          </button>
          <p role="alert">{error}</p>
        </details>
      </section>
      <WorkEnvironmentReport
        answers={answers}
        completedAt={generatedAt}
        preview
      />
    </main>
  );
}
