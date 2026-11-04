import type { Answers } from './analysis.ts';
import type { Feedback } from './feedback.ts';
export const STORAGE_KEY = '17job:v1';
export type Stage = 'home' | 'survey' | 'results' | 'jobs' | 'mission' | 'complete';
export type Progress = { version: 1; stage: Stage; answers: Answers; question: number; mission: number; responses: string[]; feedback: (Feedback | null)[]; interest: number | null; reflection: string; rated: boolean };
export const initialProgress: Progress = {version:1,stage:'home',answers:{},question:0,mission:0,responses:['','','',''],feedback:[null,null,null,null],interest:null,reflection:'',rated:false};
export function parseProgress(raw: string | null): Progress {
  try {
    if (!raw) return structuredClone(initialProgress);
    const s = JSON.parse(raw);
    const stages = ['home','survey','results','jobs','mission','complete'];
    if (s.version !== 1 || !stages.includes(s.stage) || !s.answers || typeof s.answers !== 'object' || Array.isArray(s.answers)
      || Object.entries(s.answers).some(([k,v]) => !/^([1-9]|1[0-7])$/.test(k) || !['A','B','both'].includes(v as string))
      || !Number.isInteger(s.question) || s.question<0 || s.question>16 || !Number.isInteger(s.mission) || s.mission<0 || s.mission>3
      || !Array.isArray(s.responses) || s.responses.length!==4 || s.responses.some((x:unknown)=>typeof x!=='string' || x.length>4000)
      || !Array.isArray(s.feedback) || s.feedback.length!==4 || s.feedback.some((f:unknown)=>f!==null && (typeof f!=='object' || typeof (f as Feedback).observation!=='string' || typeof (f as Feedback).next!=='string' || (f as Feedback).source!=='local'))
      || !(s.interest===null || Number.isInteger(s.interest) && s.interest>=1 && s.interest<=5) || typeof s.reflection!=='string' || s.reflection.length>4000 || typeof s.rated!=='boolean') return structuredClone(initialProgress);
    if (['results','jobs','mission','complete'].includes(s.stage) && Object.keys(s.answers).length!==17) s.stage='survey';
    if (s.stage==='complete' && s.feedback.some((f:unknown)=>!f)) s.stage='mission';
    if (s.stage==='mission') { const first=s.feedback.findIndex((f:unknown)=>!f); if(first>=0 && s.mission>first) s.mission=first; }
    return s as Progress;
  } catch { return structuredClone(initialProgress); }
}
