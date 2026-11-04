import type { Answers } from "../lib/analysis.ts";
const sample = (changes: Answers): Answers => ({
  ...Object.fromEntries(
    Array.from({ length: 17 }, (_, index) => [index + 1, "both"]),
  ),
  ...changes,
});
export const reportSamples = [
  { id: "all-both", label: "샘플 1 · 전체 C", answers: sample({}) },
  {
    id: "work-balance",
    label: "샘플 2 · 반복·변화·재량·책임",
    answers: sample({ 5: "A", 10: "A", 7: "A", 9: "A" }),
  },
  {
    id: "reward-meaning",
    label: "샘플 3 · 소득·시간·의미·성장",
    answers: sample({ 12: "A", 13: "A", 15: "B", 16: "B" }),
  },
];
