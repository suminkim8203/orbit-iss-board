# T05 인수인계 — 도구 X에서 도구 Y로

## 1. 목표
‘지구 밖의 지금’에서 **공개 보존 관측 기록 CSV 다운로드** 한 기능을 완성한다. 고정 검사 T05-F01~F10을 모두 통과해야 한다. 공통 최초 요청은 저장소 `docs/t05/initial-request.md`, 계약은 `docs/t05/fixed-tests-v1.md`, 확정 상한/집계법은 `docs/t05/protocol.md`에 있다. AI별 **45분·사용자 요청 8회**이다. 설치/준비와 구현 측정 구간을 구분하고 B 시작 이벤트를 실제 구현 전에 기록한다.

## 2. 현재 상태
- 인계받을 저장소 버전: **08840ab7e60071d4280e03bf352c2fb6140fc040**. `git rev-parse HEAD` 결과와 대조한다.
- A 시작 버전: `b2112a68bbbc491223dee346ef0f705fc44a2dc6`.
- CSV 버튼·UTF-8 BOM·CRLF·5개 열·날짜 정렬·정밀도·KST 변환·기록 분리를 구현했다. 실제 T04 관측 JSON과 공개 사이트는 바꾸지 않았다.
- A 최종 검사 대상 코드 버전 `de5a3c623021a8000101a0177e0e93ecdbb34a81`과 인계 버전의 `app` Git tree는 모두 `757bd76c84f73090fe580bda12680b61535accb2`로 같다. 마지막 커밋은 시작 기록과 검사 증거만 추가했다.
- 데이터는 세 종류다: `initial.records`는 공개 보존 기록, `liveState`는 현재값/브라우저 캐시, `SignalLab`은 합성 시험. CSV에는 첫 번째만 들어간다.

## 3. 실행 명령
Node.js 24, npm, Git 및 Chromium 실행 환경이 필요하다. 전달 ZIP을 푼 폴더에서 다음을 실행한다. `source/`는 바로 읽을 수 있는 같은 버전의 파일 사본이고, 버전 이력을 포함한 작업은 bundle에서 복제한다.

```sh
git clone repository.bundle work
cd work
git rev-parse HEAD
node scripts/t05-verify-frozen.mjs
npm ci --prefix app
cd app
npx playwright install chromium
cd ..
npm run test:t05 --prefix app
```

고정 검사 서버는 `127.0.0.1:5185`를 사용한다. Linux에서 필요한 경우 브라우저 설치 명령을 `npx playwright install --with-deps chromium`으로 실행한다. 결과는 `evidence/t05/`에 쌓인다. B 공식 실행에서는 환경값 `T05_PHASE=B`를 지정한다(PowerShell: `$env:T05_PHASE='B'`, bash: `export T05_PHASE=B`). 패키지 설치 단계는 준비로 별도 기록하고, **B 시작 시각·버전·요청 수를 저장한 뒤 동일한 검사부터 실행**한다. 처음의 준비 실행은 `preparation`으로 구분한다.

일반 화면: `npm run dev --prefix app` → `http://127.0.0.1:5173/#records`. 기존 검사/빌드/린트: `npm test --prefix app`, `npm run build --prefix app`, `npm run lint --prefix app`. 실제 ISS API 키와 환경 비밀값은 필요 없다. npm 감사 경고 11건(낮음 1/중간 2/높음 8)은 기존 의존성에 남아 있다. Windows에서 실행/자식 프로세스 종료가 제한되면 권한이 있는 일반 터미널에서 같은 명령을 실행한다.

## 4. 통과 검사
**9/10 PASS**: F01~F06, F08~F10. **F07 FAIL**. 원본 결과: `evidence/t05/A-2026-09-10T00-21-03-081Z.json`. A는 시작 0/10, 기본 구현 후 9/10으로 총 2회 실행했고 FAIL 포함 회차는 2회이다. 기존 데이터 검사 16/16, 빌드, 린트, 원본 자료 해시 대조 및 비밀값 패턴 검사는 통과했다. 이 수치에 B나 새 폴더 재현 결과를 섞지 않는다.

## 5. 남은 문제
**첫 실패 F07: 공개 기록 0개일 때 전체 관제판이 렌더링되지 않는다.** `app/app/page.tsx`의 `liveState.current_reading!`, `reading.source_time`, `latestSaved.reading` 등이 존재를 가정한다. `RecordCsvDownload`에는 빈 배열 비활성화/안내가 있지만 상위 화면이 먼저 실패한다. 고도·지도·시각·원자료 패널의 빈 상태를 일관되게 처리해야 한다. 가짜 관측값이나 합성값을 실제값처럼 채워서 해결하면 안 된다. 기록이 있는 기존 화면 및 ‘새 데이터 조회’ 복구 흐름을 유지한다.

## 6. 다음 행동
① 원본 HANDOFF.md를 그대로 보존하고 수신 SHA-256을 `A-END.json`과 대조한다. 누락이 없으면 ‘없음’, 있으면 원본과 수정본/이유를 남긴다. ② 같은 10개를 실행해 F07을 재현한 뒤 상위 화면의 빈 상태를 수정한다. ③ 같은 10개와 기존 검사·빌드·린트를 실행하고 B 종료 시각·요청 수·시작/종료 버전·오류 회차를 저장한다. `A-END.json`과 `REPRODUCTION.json`은 A 종료/새 폴더 재현 증거다. B가 완료한 뒤 공개 비교 보고서와 최종 소스 주소를 마련하고 이름을 가린 표·확인 방법 4줄·본인 판단 3줄을 완성한다. 아직 B 완료나 최종 공개 보고서가 준비된 상태는 아니다.

## 7. 건드리지 말 것
고정 검사·fixture·기대값·상한(해시 검증 대상 파일), 실제 공개 관측 자료와 원본 계약 파일, A의 시작/종료 기록과 검사 결과를 바꾸지 않는다. 누락 보완은 별도 문서에 한다. 대화 전문을 요청하거나 붙이지 않는다. 사용자 판단을 대신 지어내지 않는다. 기존 main 배포에 중간 코드를 올리지 않으며 공개 게시 전 비밀값·개인정보를 확인한다. B는 A와 다른 서비스/모델인 학원 무료 AI를 사용하고 정확한 표시명은 사용자가 확인한다.
