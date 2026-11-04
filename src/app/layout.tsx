import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '17job · 나를 알아가는 직무 탐색', description: '17개의 질문, 작은 직무 경험. 감당할 수 있는 환경부터 나에게 맞는 일을 탐색해 보세요.' };
export default function Layout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="ko"><body>{children}</body></html>; }
