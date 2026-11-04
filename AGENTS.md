# 작업 및 저장 원칙

사용자는 의미 있는 작업 단위가 완료될 때마다 Git 커밋하고 GitHub에 push하도록 요청했습니다. 이후 작업에서도 이 지침을 따르세요. 검증 결과와 미완료 항목을 문서에 기록하고, push 실패 시 로컬 커밋과 원격 반영 상태를 구분해 보고하세요. 강제 push, 기존 사용자 변경 덮어쓰기, 비밀정보 커밋은 하지 마세요.

기존 체크아웃을 사용하고 사용자가 요청하지 않으면 별도 worktree를 만들지 마세요.

먼저 README.md, PLAN.md, VALIDATION.md, PROGRESS.md를 확인하세요. 설문 응답은 감당하기 어려운 환경이며 반대 환경의 선호·능력으로 해석하지 않습니다. 적합도 점수를 만들지 마세요.

필수 검증: npm run typecheck, npm test, npm run build. 화면·사용자 흐름을 변경할 때 서버를 실행하고 CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e로 검증하세요. 시스템 Chromium이 없다면 README의 Playwright 설치 방법을 따르세요.
