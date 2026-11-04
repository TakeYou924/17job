const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3000');await page.getByRole('button',{name:'나의 탐색 시작하기'}).waitFor();
 await page.screenshot({path:'/tmp/17job-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'나의 탐색 시작하기'}).click();
 assert.equal(await page.getByRole('button',{name:'다음 질문'}).isDisabled(),true);
 for(let i=0;i<17;i++){
  const options=page.getByRole('radio');await options.nth(i===0?0:i===1?1:2).check();
  await page.getByRole('button',{name:i===16?'결과 살펴보기':'다음 질문',exact:false}).click();
 }
 await page.getByRole('heading',{name:'나를 위해 살펴볼 업무 환경',exact:true}).waitFor();
 assert.equal(await page.locator('.burden-list li').count(),2);
 await page.reload();await page.getByRole('heading',{name:'나를 위해 살펴볼 업무 환경',exact:true}).waitFor();
 await page.getByRole('button',{name:'직무 후보 둘러보기'}).click();
 assert.equal(await page.locator('.job-card').count(),5);
 await page.getByRole('button',{name:'체험 시작'}).click();
 const response='사실: 주문 200건 중 110건이 결제했습니다. 사용자에게 품절과 대기 문제가 있습니다. 가설을 확인할 지표와 위험을 검토하고 이번 개선 선택의 이유와 제외할 일을 설명합니다.';
 for(let i=0;i<4;i++){
  await page.getByLabel(/자료를 읽고|사용자 한 명의|① 옵션|선택한 개선안/).fill(response);
  await page.getByRole('button',{name:'답변 제출하고 피드백 받기'}).click();
  await page.getByRole('heading',{name:'생각을 한 걸음 더'}).waitFor();
  if(i===0){await page.reload();await page.getByRole('heading',{name:'생각을 한 걸음 더'}).waitFor();assert.equal(await page.locator('textarea').inputValue(),response);}
  await page.getByRole('button',{name:i===3?'체험 마무리하기':'다음 미션',exact:false}).click();
 }
 await page.getByRole('heading',{name:'첫 번째 경험을 마쳤어요!'}).waitFor();
 await page.getByRole('radio',{name:'꽤 흥미로워요',exact:false}).check();
 await page.getByLabel(/어떤 순간이 흥미롭거나/).fill('문제를 정의하는 과정이 흥미로웠습니다.');
 await page.getByRole('button',{name:'회고 저장하고 다음 탐색 보기'}).click();
 await page.getByRole('heading',{name:'다음엔 이런 경험은 어떨까요?'}).waitFor();
 assert.equal(await page.locator('.next-exploration .job-card').count(),4);
 await page.reload();await page.getByRole('heading',{name:'다음엔 이런 경험은 어떨까요?'}).waitFor();
 await page.getByRole('button',{name:'체험 돌아보기'}).click();
 await page.getByRole('button',{name:'사용자의 목소리 듣기',exact:false}).click();
 await page.locator('textarea').fill(response+' 수정한 답변입니다.');
 assert.equal(await page.getByRole('heading',{name:'생각을 한 걸음 더'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'팀에 개선안 제안하기',exact:false}).isDisabled(),true);
 await page.getByRole('button',{name:'내 기록 초기화'}).click();await page.getByRole('button',{name:'전체 초기화',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'나의 탐색 시작하기'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/17job-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'나의 탐색 시작하기'}).click();
 await page.getByRole('radio').nth(2).check();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/17job-survey-mobile.png',fullPage:true});
 for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 const blocked=await browser.newPage();await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('blocked')};Storage.prototype.getItem=()=>{throw new Error('blocked')};});await blocked.goto(process.env.BASE_URL || 'http://127.0.0.1:3000');await blocked.locator('.save-warning').waitFor();await blocked.getByRole('button',{name:'나의 탐색 시작하기'}).click();await blocked.getByRole('radio').nth(2).check();assert.equal(await blocked.getByRole('button',{name:'다음 질문'}).isDisabled(),false);
 assert.deepEqual(errors,[]);console.log('PASS: desktop full flow, all 17 questions, 4 missions, local feedback, reload persistence, rating, recommendations, edit invalidation, reset, mobile overflow, no browser errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
