# excalidraw-skill

LLM 에이전트와 함께 **편집 가능한 네이티브 Excalidraw 소프트웨어 다이어그램**을 생성하고, 기존 다이어그램을 의미 단위로 수정하는 도구입니다.

> 현재 단계: cognitive-agent contained dogfood / pre-release. 기존 deterministic kernel의 품질 게이트와 실제 Excalidraw 렌더 회귀를 유지하면서, VS Code native agent + MCP + human-in-the-loop를 이용한 시각 품질 탐색을 검증하고 있습니다. 아직 모든 다이어그램 패밀리를 렌더링하는 범용 도구는 아닙니다.

핵심 방향은 다음과 같습니다.

> **The kernel prevents invalid diagrams. The agent explores understandable diagrams. The human owns final visual intent.**

## 지금 바로 써보기

### 요구사항

- Node.js `20.20+`
- npm `10+`
- Git
- 결과를 VS Code에서 열려면 `pomdtr.excalidraw-editor` 확장 권장

### 1. 전역 Copilot skill 설치

```text
git clone https://github.com/YB-Park/excalidraw-skill.git
cd excalidraw-skill
npm install
npm run skill:install:global
npm run skill:doctor:global
```

`doctor`에서 `ok`, `skillOk`, `runtimeOk`가 모두 `true`면 설치가 정상입니다.

설치 위치:

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

설치 후 VS Code를 reload하거나 새 Copilot Chat을 시작하세요.

### 2. 첫 다이어그램 요청

다른 프로젝트 workspace에서 자연어로 요청하면 됩니다.

```text
결제 승인 흐름을 Excalidraw 다이어그램으로 만들어줘.
excalidraw-skill을 사용하고 결과는 diagrams/payment-approval.excalidraw에 저장해줘.
완성 후 review PNG를 실제로 검토하고, 큰 시각적 문제가 있으면 한두 번만 수정해줘.
```

기존 다이어그램 수정도 같은 방식입니다.

```text
diagrams/payment-approval.excalidraw을 수정해줘.
Payment Service 이름을 Payment Authorization Service로 바꾸고
기존 수동 배치는 최대한 유지해줘.
수정 후 fresh review PNG도 확인해줘.
```

새 다이어그램은 `build`, 기존 `.excalidraw` 수정은 `inspect → patch` 흐름을 사용합니다. 그 뒤 `review`가 deterministic 검증과 verified PNG 생성을 묶어서 수행하며, **이미지 자체를 사람/vision-capable host가 실제로 보는 것**이 dogfood 기본 흐름입니다.

## VS Code cognitive-agent dogfood

이 저장소 자체를 VS Code로 열면 experimental cognitive-agent vertical slice를 dogfood할 수 있습니다.

구성:

- `.github/agents/excalidraw-designer.agent.md`: 사용자-facing coordinator
- `.github/agents/excalidraw-planner.agent.md`: semantic planning 전용 subagent
- `.github/agents/excalidraw-critic.agent.md`: actual PNG를 보는 perceptual critic
- `.mcp.json` + `mcp/server.mjs`: renderer 내부 명령 대신 typed semantic tools 제공

현재 **3-candidate cognitive portfolio는 flow 계열(`flow`, `service-flow`, `event-flow`, `data-flow`)에만 적용**합니다. `system-architecture`와 `module-architecture`는 렌더링 자체는 지원하지만 아직 서로 다른 세 전략을 검증하지 않았으므로 기존 deterministic build/review + actual image inspection 경로를 유지합니다.

flow 후보 전략은 다음과 같습니다.

- `narrative`: primary story continuity
- `compact`: eye travel / spread 감소
- `structured`: 관계 구조를 더 강하게 드러내되 순차 primary flow는 보존. 2개 이상의 primary step이 있으면 sequence-safe `layered-flow`를 사용하고, 진짜 hub topology에서만 `hub-and-spoke`를 사용

후보들은 모두 기존 hard quality gate를 먼저 통과해야 하며, CI는 이름만 다르고 실제 composition은 같은 near-duplicate 후보 portfolio도 거부합니다. **candidate diversity는 품질 점수가 아니라 탐색할 가치가 있는 서로 다른 해가 존재하는지 확인하는 gate**입니다.

Critic 평가에는 전략명을 넘기지 않습니다. 생성 결과는 coordinator용 full manifest와 `c01`, `c02`, `c03` 같은 opaque ID만 포함하는 `blindCandidates` view를 별도로 제공하며, Critic은 blind view의 scene을 독립적으로 이미지 검토한 뒤에만 ranking합니다. 낮은 confidence, 근소한 차이, non-blind handoff, presentation-critical 작업은 사람에게 넘깁니다.

현재 agent 모델은 비용 정책을 코드로 고정해 두었습니다. 허용 목록은 `GPT-5.6 Luna`, `MAI-Code-1.1-Flash`, `Kimi K2.7 Code`뿐입니다. Designer/Planner는 Luna를 우선하고, Critic은 image review 역할 때문에 MAI-Code-1.1-Flash를 우선합니다. agent는 더 비싼 모델로 자동 승격하거나 handoff하면 안 됩니다.

MCP 서버는 typed semantic tools만 노출하고 filesystem 접근을 현재 workspace 안으로 제한합니다. stdio 경로는 공식 MCP client를 이용해 실제 handshake, `tools/list`, tool invocation까지 integration test합니다.

이 agent/MCP 경로는 **현재 저장소/workspace에서의 dogfood integration**입니다. 전역 skill installer가 arbitrary external workspace에 custom agent와 MCP 설정까지 자동 배포한다고 아직 주장하지 않습니다. 먼저 이 workflow가 실제 품질을 개선하는지 사람의 선택 데이터로 검증합니다.

## Human-in-the-loop와 LayoutState

사람이 Excalidraw에서 직접 배치를 고친 것은 자동화 실패로 취급하지 않습니다. semantic source와 presentation intent를 분리하기 위해 stable semantic ID 기반 `LayoutState`를 사용합니다.

현재 vertical slice는 semantic node 위치와 bound label을 capture/reapply하고, 이동된 node에 연결된 edge endpoint geometry를 새 node boundary에 다시 reconcile합니다. explicit LayoutState provenance가 있는 수동 배치는 presentation intent로 보존하되 primary-flow ordering, binding, editability, overlap, route-integrity 같은 hard constraint는 계속 강제합니다. reapply 후 fresh review는 여전히 필수입니다.

사람 선호 데이터도 같은 원칙으로 다룹니다. 실제 사람이 actual candidate image를 본 뒤에만 `npm run preference:record`로 opaque candidate ranking을 기록할 수 있으며 `--human-confirmed`가 없으면 기록을 거부합니다. 자세한 사용법은 `docs/PREFERENCE_CAPTURE.md`를 참고하세요.

## PNG preview와 `render`의 차이

일반 agent workflow에서는 `review`를 우선합니다.

```text
node ./bin/excalidraw-skill.mjs review diagrams/payment-approval.excalidraw
```

portable PNG만 별도로 필요하면 `preview`를 사용할 수 있습니다.

```text
node ./bin/excalidraw-skill.mjs preview diagrams/payment-approval.excalidraw -o diagrams/payment-approval.preview.png
```

`preview`는 최종 scene의 geometry, label, routing, composition을 LLM/사람이 검토하기 위한 유효한 PNG를 만듭니다. portable preview이므로 native Excalidraw renderer와 픽셀 단위로 동일하다는 의미는 아닙니다. CI에서는 별도의 실제 Excalidraw renderer regression을 renderer ground truth로 유지합니다.

**`render`는 PNG 변환 명령이 아닙니다.** `render`는 DiagramSpec을 저수준 Excalidraw JSON scene으로 만드는 developer 단계이며 `.excalidraw` 출력만 허용합니다. `render ... -o something.png`는 오류로 종료되며 가짜/깨진 PNG를 만들지 않습니다.

## 현재 렌더 가능한 범위

일반 사용 대상으로 현재 품질 게이트를 통과시키는 범위:

- `flow`, `service-flow`, `event-flow`, `data-flow`: `layered-flow`, `swimlane-flow`, `hub-and-spoke`
- `system-architecture`: `layered-system`
- `module-architecture`: `component-view`

아직 contract-only이거나 전용 renderer가 없는 범위:

- `sequence`
- `system-architecture`: `deployment-view`, `context-view`
- `module-architecture`: `internal-block`, `port-interface-view`

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

```text
npm install
npm run doctor
npm run init
```

이 명령은 현재 workspace의 `.opencode/commands/excalidraw.md`와 `.github/prompts/excalidraw.prompt.md`를 생성하며 `~/.copilot`에는 설치하지 않습니다. 이전 버전에서 생성된 managed prompt를 최신 canonical workflow로 올릴 때는 `init --upgrade`를 사용합니다. 사용자가 소유한 unmanaged prompt는 보존합니다.

## CLI로 직접 사용

```text
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.visual-plan.diagram.json
node ./bin/excalidraw-skill.mjs review examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs quality-report examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
npm run candidates -- examples/service-flow/payment-flow.visual-plan.diagram.json
npm run preference:record -- --manifest path/to/candidates.json --scenario my-task --ranking c01,c02,c03 --human-confirmed
```

터미널의 `excalidraw-skill` convenience command를 위한 `npm install -g .`는 선택 사항입니다.

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

## 개발 품질 확인

```text
npm test
npm run smoke
npm run smoke:system
npm run smoke:module
npm run evaluate:strict
npm run candidates -- examples/service-flow/payment-flow.visual-plan.diagram.json
node ./src/candidate-diversity.mjs examples/service-flow/payment-flow.visual-plan.candidates.json
```

CI는 native editability, structural/perceptual quality, candidate composition diversity, MCP stdio integration, 실제 Excalidraw 렌더 signature, patch round-trip regression을 함께 검사합니다. 품질 점수는 시각적 승인과 동일하지 않으므로 dogfood에서는 actual PNG visual review도 병행합니다.

사람 선호 평가 corpus는 의도적으로 실제 사람이 후보 이미지를 보고 선택한 뒤에만 채웁니다. LLM이나 테스트가 human ranking을 날조해서는 안 됩니다.

## 문서

- cognitive-agent 아키텍처: `docs/COGNITIVE_AGENT_ARCHITECTURE.md`
- 현재 개발 handoff: `docs/HANDOFF.md`
- 설치/업데이트/제거: `docs/GLOBAL_INSTALL.md`
- 실제 사용법: `docs/USAGE.md`
- LLM 설치 런북: `docs/AGENT_SETUP.md`
- patch 사용법: `docs/PATCH_USAGE.md`
- 사람 선호 기록: `docs/PREFERENCE_CAPTURE.md`
- 다이어그램 타입: `docs/DIAGRAM_TYPES.md`
- 품질 기준: `docs/QUALITY_CRITERIA.md`
- smoke test: `docs/SMOKE_TEST.md`
- 평가 가이드: `examples/evaluation/README.md`
