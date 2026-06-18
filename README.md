# excalidraw-skill

LLM과 함께 수정 가능한 Excalidraw 소프트웨어 다이어그램을 만들고 고치는 파일럿 도구입니다.

최종 산출물은 사람이 직접 열어보고 수정할 수 있는 `.excalidraw` 파일입니다.

## 빠른 시작

VS Code에서 이 프로젝트 폴더를 연 뒤, 사용하는 LLM에게 이렇게 요청하세요.

```txt
Read docs/AGENT_SETUP.md and set this up.
```

LLM은 환경 확인, 설치, 초기화, smoke test, VS Code Excalidraw 확장 확인까지 진행하도록 안내되어 있습니다.

직접 실행하려면:

```txt
npm install
npm run doctor
npm run init
npm test
npm run smoke
```

## 다이어그램 만들기

opencode에서는 이렇게 요청합니다.

```txt
/excalidraw 전체 HW/SW 구조에서 우리 미들웨어 모듈의 위치와 의존 관계를 보여주는 아키텍처 다이어그램 만들어줘
```

또는:

```txt
/excalidraw 이 모듈 내부 블록과 인터페이스 관계를 보여주는 모듈 아키텍처 다이어그램 만들어줘
```

```txt
/excalidraw 초기화 시나리오를 시퀀스 다이어그램으로 만들어줘
```

현재 선정한 핵심 다이어그램 패밀리는 다음과 같습니다.

- `system-architecture`: 전체 HW/SW 계층, 배포 위치, 시스템 문맥
- `module-architecture`: 모듈 내부 블록, 책임, 포트와 인터페이스
- `flow`: 서비스 호출, 이벤트, 데이터와 제어 흐름
- `sequence`: 시간 순서에 따른 참여자 간 메시지

각 패밀리는 같은 시각 스타일을 공유하지만 레이아웃 문법은 별도로 관리합니다.

## 현재 구현 상태

- `flow`: service-flow 중심의 파일럿 renderer가 동작합니다.
- `system-architecture`: 계약과 평가 사례가 정의됐으며 전용 renderer 구현이 다음 우선순위입니다.
- `module-architecture`: 계약과 평가 사례가 정의됐으며 system-architecture 다음에 구현합니다.
- `sequence`: 전용 `SequenceSpec`과 평가 사례가 정의됐습니다. 일반 flow renderer로 대체하지 않습니다.

## 평가

한 가지 결제 예제에 과적합되지 않도록 네 패밀리의 16개 평가 사례를 관리합니다.

```txt
examples/evaluation/suite.json
```

공통 변경은 관련된 여러 패밀리의 사례로 검토해야 합니다.

## 문서

- LLM 설치 런북: `docs/AGENT_SETUP.md`
- 사용법: `docs/USAGE.md`
- 다이어그램 타입: `docs/DIAGRAM_TYPES.md`
- 품질 기준: `docs/QUALITY_CRITERIA.md`
- 구현 로드맵: `docs/DIAGRAM_FAMILY_ROADMAP.md`
- 평가 가이드: `examples/evaluation/README.md`
- smoke test: `docs/SMOKE_TEST.md`
- 릴리즈 체크리스트: `docs/RELEASE_CHECKLIST.md`

## 현재 범위

- 편집 가능한 Excalidraw scene, semantic id, text fitting, style preset, routing, frame suppression, inspect/patch/validate 기반을 제공합니다.
- 기본 Excalidraw 도형을 사용합니다.
- 커스텀 도형 라이브러리는 아직 필수가 아닙니다.
- 구조 검사 통과는 미적 품질 승인을 의미하지 않으며, 실제 화면 검토와 수동 수정 비용을 함께 평가합니다.
