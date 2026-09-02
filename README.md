# excalidraw-skill

LLM 에이전트와 함께 **편집 가능한 네이티브 Excalidraw 소프트웨어 다이어그램**을 생성하고, 기존 다이어그램을 의미 단위로 수정하는 도구입니다.

> 현재 단계: contained dogfood / pre-release. 품질 게이트와 실제 Excalidraw 렌더 회귀 테스트를 운영하고 있지만, 아직 모든 다이어그램 패밀리를 렌더링하는 범용 도구는 아닙니다.

## 지금 바로 써보기

### 요구사항

- Node.js `20.20+`
- npm `10+`
- Git
- 결과를 VS Code에서 열려면 `pomdtr.excalidraw-editor` 확장 권장

### 1. 전역 Copilot skill 설치

현재 권장 설치 방식은 이 저장소 checkout에서 managed runtime을 설치하는 것입니다. npm 전역 symlink나 관리자 권한은 필요하지 않습니다.

```text
git clone https://github.com/YB-Park/excalidraw-skill.git
cd excalidraw-skill
npm install
npm run skill:install:global
npm run skill:doctor:global
```

`doctor`에서 `ok`, `skillOk`, `runtimeOk`가 모두 `true`면 설치가 정상입니다.

설치되는 위치:

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

설치 후 VS Code를 reload하거나 새 Copilot Chat을 시작하세요.

### 2. 첫 다이어그램 요청

다른 프로젝트 workspace에서 자연어로 요청하면 됩니다. 출력 경로를 명시하면 결과를 찾기 쉽습니다.

```text
결제 승인 흐름을 Excalidraw 다이어그램으로 만들어줘.
excalidraw-skill을 사용하고 결과는 diagrams/payment-approval.excalidraw에 저장해줘.
```

기존 다이어그램 수정도 같은 방식입니다.

```text
diagrams/payment-approval.excalidraw을 수정해줘.
Payment Service 이름을 Payment Authorization Service로 바꾸고
기존 수동 배치는 최대한 유지해줘.
```

새 다이어그램은 `build`, 기존 `.excalidraw` 수정은 `inspect → patch` 흐름을 사용합니다. 생성/수정 결과는 native text/arrow binding과 구조 품질을 검사한 뒤 반환합니다.

## 현재 렌더 가능한 범위

일반 사용 대상으로 현재 품질 게이트를 통과시키는 범위:

- `flow`, `service-flow`, `event-flow`, `data-flow`
  - `layered-flow`
  - `swimlane-flow`
  - `hub-and-spoke`
- `system-architecture`
  - `layered-system`
- `module-architecture`
  - `component-view`

아직 contract-only이거나 전용 renderer가 없는 범위:

- `sequence`
- `system-architecture`의 `deployment-view`, `context-view`
- `module-architecture`의 `internal-block`, `port-interface-view`

특히 sequence 요청은 graph/flow renderer로 우회하지 않습니다. 현재는 `SequenceSpec` 초안까지만 지원합니다.

## 기존 다이어그램에서 가능한 수정

`DiagramPatch`는 작은 의미 단위의 local edit을 우선합니다.

- `addNode`
- `addEdge`
- `updateLabel`
- `moveNear`
- `insertNodeBetween`
- `groupIntoFrame`
- `applyStylePreset`
- `removeObject`

관련 edge는 다시 라우팅할 수 있지만, 기본값은 `preserveManualLayout: true`이며 unrelated node 배치를 유지합니다.

## 프로젝트 로컬 설정

전역 설치 대신 현재 checkout/workspace에 prompt entrypoint만 만들려면:

```text
npm install
npm run doctor
npm run init
```

이 명령은 현재 workspace의 `.opencode/commands/excalidraw.md`와 `.github/prompts/excalidraw.prompt.md`를 생성하며 `~/.copilot`에는 설치하지 않습니다.

## CLI로 직접 사용

저장소 checkout에서 직접 실행할 수도 있습니다.

```text
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.visual-plan.diagram.json
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs quality-report examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
```

터미널에서 `excalidraw-skill` 명령을 직접 쓰기 위한 `npm install -g .`는 선택 사항입니다. Copilot global skill 사용에는 필요하지 않습니다.

## 업데이트 / 제거

업데이트:

```text
git pull
npm install
npm run skill:install:global
npm run skill:doctor:global
```

제거:

```text
npm run skill:uninstall:global
```

자세한 내용은 `docs/GLOBAL_INSTALL.md`를 참고하세요.

## 개발 품질 확인

기여하거나 runtime 변경을 검증할 때:

```text
npm test
npm run smoke
npm run smoke:system
npm run smoke:module
npm run evaluate:strict
```

CI는 native editability, structural/perceptual quality, 실제 Excalidraw 렌더 signature, patch round-trip regression을 함께 검사합니다.

## 문서

- 설치/업데이트/제거: `docs/GLOBAL_INSTALL.md`
- 실제 사용법: `docs/USAGE.md`
- LLM 설치 런북: `docs/AGENT_SETUP.md`
- patch 사용법: `docs/PATCH_USAGE.md`
- 다이어그램 타입: `docs/DIAGRAM_TYPES.md`
- 품질 기준: `docs/QUALITY_CRITERIA.md`
- smoke test: `docs/SMOKE_TEST.md`
- 평가 가이드: `examples/evaluation/README.md`
