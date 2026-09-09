# ORBIT — ISS 관제판

요약: 실제 ISS 고도·위치를 조회하고 한국 날짜별 기록을 보존하는 정적 웹 앱입니다. 데이터 수신 실패 다섯 종류와 복구를 공개 합성 자료로 재생합니다. 실제 이틀 기록과 플랫폼 증빙은 별도로 구분합니다.

## 진행 순서와 상태

1. 디자인: 사용자 확인 완료. 포인트 색상 #7BFDE3.
2. 기능 구현: 실제 조회, 브라우저 날짜별 캐시, 공개 일별 수집, 실패·복구 구현 완료.
3. 검증: 16개 데이터/수집 테스트 통과. 17개 원본 파일과 9개 배포 fixture SHA-256 대조 통과. 화면에 연결된 구조화 시험 도구의 실패/복구/잘못된 입력 거절 확인.
4. 배포: GitHub Actions와 Pages 구성. 공개 접속 검증은 배포 성공 후 진행.
5. 실제 두 번째 날짜: 대기. 현재 공개 실제 기록은 2026-09-09 KST 1건.
6. 제출: 실제 이틀 값 대조 후 SUBMISSION.md를 최종 확인. 플랫폼 영수증 발급 안내는 미제공 상태이며 앱이 이를 위조하거나 대신 발급하지 않음.

## 실행과 검사

Node.js 24를 사용합니다. 저장소 루트에서 실행합니다.

```powershell
npm ci --prefix app
npm run dev --prefix app
npm test --prefix app
npm run lint --prefix app
npm run build --prefix app
node scripts/verify-assets.mjs
node scripts/scan-secrets.mjs
```

GitHub Pages에 올리는 폴더는 `app/dist/`입니다. 사이트는 상대 경로를 사용하므로 `/orbit-iss-board/` 하위에서도 동작합니다. 처음 생성된 Sites 기본 도구의 서버 의존성은 배포에 사용하지 않으며, 호스팅은 GitHub Pages만 사용합니다. 린트는 앱 작성 코드에 적용하고 생성된 미사용 UI 기본 파일은 제외합니다.

## 실제 조회와 보존

- 원천: https://api.wheretheiss.at/v1/satellites/25544
- 핵심 값: `altitude`, 단위 `km`. 원본 정밀도를 보존하고 화면만 소수 둘째 자리로 반올림.
- 원천의 `timestamp`를 출처 기준 시각으로 사용. 조회 시각과 구분하여 둘 다 KST 표시.
- 기록 날짜: 실제 조회 시각을 Asia/Seoul로 변환. 고유키는 `signal_id + record_date`.
- 수신 후 120초가 지난 출처 값은 ‘오래된 값’으로 표시. 장애가 아닌 정상 노화도 숨기지 않음.
- 브라우저의 ‘새 데이터 조회’는 현재 관측값과 이 브라우저의 일별 캐시를 갱신. 공개 보존 기록과는 구분.
- 공개 기록: `app/public/data/records.json`. 새 시크릿 창에서도 동일한 공개 기록을 표시.
- 실패한 요청은 정상값/기존 일별 행을 덮어쓰지 않음. 429 Retry-After와 재시도 간격을 적용.
- 저장소 수집은 `node scripts/collect.mjs`. 파일 잠금 + 같은 폴더의 임시 파일 + rename으로 원자적 기록.
- 같은 날 재실행은 한 행 갱신. 실제 두 날짜가 확보되면 제출 기록 2건을 고정하고 추가 호출/덮어쓰기를 멈춤.
- 전일 대비는 저장된 두 값의 `나중 값 - 이전 값`이며 원본 값으로 계산하고 화면에서 반올림. 날짜가 건너뛰면 ‘이전 기록 대비’로 구분.
- 각 공개 행의 ‘원자료 보기’에서 출처·시각·원자료·저장값·표시값을 선택하여 대조 가능.

## GitHub 배포

저장소: https://github.com/suminkim8203/orbit-iss-board

1. 저장소 Settings → Pages → Source에서 GitHub Actions 선택.
2. main push 또는 Actions의 ‘Verify, collect and deploy ORBIT’ 실행으로 정적 사이트 배포.
3. 실제 수집은 워크플로 수동 실행에서 collect를 선택하거나 매일 약 09:25 KST 예약 실행을 사용. GitHub 예약은 지연될 수 있으므로 예약 시각이 아닌 실제 조회 시각을 기록.

수집 중 실패해도 이전 정상 기록과 실패 사유를 배포하며 워크플로는 실패를 알립니다. 자동 수집 커밋은 같은 워크플로에서 직접 배포하므로 자동 토큰 커밋이 다른 워크플로를 트리거하지 않는 제약을 피합니다. API 키는 필요 없습니다. GitHub의 기본 워크플로 인증은 실행 환경 안에서만 사용하며 브라우저나 공개 파일에 넣지 않습니다.

## 합성 시험

‘수신 테스트’의 실패 버튼은 매번 초기화 → D1-A(100) → D1-B(105) → 선택한 실패 순서로 실행합니다. 마지막 정상값 105, stale, 해당 error_code, 1행을 유지합니다. ‘다시 시도 · 합성 복구’는 T04-RECOVER-D2를 적용하여 120, fresh/none, 2행, +15 pt가 됩니다. 복구 재실행은 새 행을 중복 생성하지 않습니다. ‘합성 초기화’는 실제 데이터에 영향을 주지 않습니다. 직접 정상 순서 버튼도 제공됩니다.

합성 값은 pt이며 실제 ISS 고도 km와 섞지 않습니다. 가상 날짜는 2026-08-24/25이며 실제 조회 날짜 증거로 사용하지 않습니다. 같은 공통 저장 함수를 실제 조회/수집/합성 재생에 사용합니다.

## 자료와 증빙

- `evidence/initial-response.json`, `initial-fetch.json`: 최초 실제 조회 원문과 메타데이터.
- `evidence/asset-verification.json`: 과제 package ID와 파일 SHA-256 대조.
- `evidence/secret-scan.json`: 일반적인 비밀값 패턴 검색 결과. 모든 비밀 형식을 보장하는 검사는 아니며 앱의 외부 API에 키를 사용하지 않음.
- `reference/t04-real-information-board-public-v1/`: 제공된 원본 18개 파일. manifest 자체를 제외한 17개 파일 검증.
- 첨부 계약은 `t04_day` 플랫폼 영수증 정확히 2건, 서로 다른 KST 생성 날짜, source_url/source_observed_at/normalized_value/unit 대조를 명시. 발급 화면/절차는 자료에 없으므로 실제 제출 단계에서 확인 필요.
- 앱 일별 JSON과 스크린샷은 플랫폼 봉인 영수증이 아님.

지도는 Natural Earth의 공개 도메인 데이터입니다.
https://www.naturalearthdata.com/about/terms-of-use/
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson

ISS API 문서: https://wheretheiss.at/w/developer
