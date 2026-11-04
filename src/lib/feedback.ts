export type Criterion = { label: string; keywords: string[] };
export type Mission = { title: string; subtitle: string; brief: string; resources: string[]; placeholder: string; criteria: Criterion[] };
export type Feedback = { observation: string; next: string; source: 'local' };
// Keep the provider async so a server-only API adapter can replace it later.
export interface FeedbackProvider { evaluate(mission: Mission, response: string): Promise<Feedback> }
export const localFeedback: FeedbackProvider = {
  async evaluate(mission, response) {
    const found = mission.criteria.filter(c => c.keywords.some(k => response.includes(k)));
    const missing = mission.criteria.filter(c => !found.includes(c));
    return {
      observation: found.length ? `답변에서 ‘${found.map(c => c.label).join('’, ‘')}’ 관련 표현을 찾았어요. 해당 내용이 자료와 연결되는지 직접 확인해 보세요.` : '생각을 기록했어요. 자료의 어떤 내용이 판단의 근거인지 한 문장 더 적어 보세요.',
      next: missing.length ? `다듬어 볼 점: ‘${missing[0].label}’을 구체적으로 설명해 보세요. 정답보다 판단 과정이 중요해요.` : '한 걸음 더: 내 판단과 다른 설명도 가능할까요? 반대 가설이나 추가로 필요한 자료를 적어 보세요.',
      source: 'local'
    };
  }
};
