export type Answer = 'A' | 'B' | 'both';
export type Answers = Record<number, Answer>;
export type Question = { id: number; title: string; prompt: string; a: string; b: string };
export type JobEnvironment = { question: number; answer: string };
export function analyze(questions: Question[], answers: Answers) {
  return questions.flatMap(q => answers[q.id] === 'A' || answers[q.id] === 'B'
    ? [{ id: q.id, title: q.title, environment: answers[q.id] === 'A' ? q.a : q.b }] : []);
}
export function friction(environments: JobEnvironment[], answers: Answers) {
  return environments.filter(e => answers[e.question] === e.answer).map(e => e.question);
}
export function recommend<T extends { id: string; environments: JobEnvironment[] }>(jobs: T[], answers: Answers, excluded?: string) {
  return jobs.filter(j => j.id !== excluded).map((job, index) => ({job, index, count: friction(job.environments, answers).length}))
    .sort((a,b) => a.count - b.count || a.index - b.index).map(x => x.job);
}
