# Project Decisions and Implementation Status

> 기준일: 2026-06-20  
> 대상 저장소: `YB-Park/excalidraw-skill`  
> 목적: 긴 개발 세션에서 결정된 방향, 정책, 구현 상태, 남은 작업을 한 곳에 고정한다.

이 문서는 앞으로의 개발 세션에서 우선 읽어야 하는 프로젝트 기준 문서다. 세부 계약이나 사용법은 각 전문 문서를 따르되, 서로 충돌할 경우 현재 코드와 이 문서의 **확정 결정**을 먼저 확인한다.

---

## 1. 프로젝트 목표

`excalidraw-skill`은 LLM이 소프트웨어 다이어그램을 생성, 검사, 수정, 개선할 수 있도록 하는 도구다.

최종 산출물은 다음 조건을 만족해야 한다.

- 사람이 Excalidraw에서 직접 열고 수정할 수 있는 `.excalidraw` 파일이다.
- 의미 있는 객체는 semantic id를 가져야 한다.
- 다이어그램의 의미와 레이아웃 의도가 원시 좌표보다 우선한다.
- 자동 품질 검사는 구조적 문제를 찾는 수단이며, 미적 완성도를 자동으로 보증하지 않는다.
- 생성 후 작은 수정은 전체 장면 재생성보다 semantic patch를 우선한다.

현재 핵심 범위는 다음과 같다.

- 편집 가능한 Excalidraw scene 생성
- semantic id 기반 inspect / patch / validate
- text fitting, style preset, routing, frame suppression
- 다이어그램 패밀리별 renderer와 품질 invariant
- Copilot이 어느 workspace에서나 사용할 수 있는 전역 skill 설치
- 전역 npm symlink에 의존하지 않는 사용자 소유 runtime 설치

---

## 2. 최상위 설계 원칙

### 2.1 하나의 top-level router skill

Excalidraw 관련 작업은 `skills/excalidraw-skill/SKILL.md` 하나를 top-level router로 사용한다.

router는 요청에 따라 필요한 문서만 읽는다.

- 새 다이어그램: `guides/create.md`
- 기존 다이어그램 수정: `guides/edit.md`
- 시각적 정리: `guides/style.md`
- 도형 선택: `catalog/shapes.index.json`
- 다이어그램 패밀리 선택: `docs/DIAGRAM_TYPES.md`
- 수용 기준 검토: `docs/QUALITY_CRITERIA.md`
- 세부 계약: `contracts/`
- 패밀리별 규칙: `diagram-types/`

모든 가이드와 계약을 기본적으로 전부 읽지 않는다. 현재 작업에 필요한 파일만 선택적으로 읽는다.

### 2.2 raw Excalidraw JSON 직접 작성 금지

정상적인 runtime이 설치되어 있으면 CLI/runtime을 사용해야 한다.

`runtimeEntry`가 없거나 읽을 수 없는 경우에는 설치 불완전 상태를 보고하며, 이를 우회하기 위해 raw Excalidraw JSON을 손으로 작성하지 않는다.

### 2.3 의미와 레이아웃의 분리

공유 계층이 담당하는 것:

- semantic ids
- style tokens
- text fitting
- Excalidraw serialization
- validation
- structural quality reporting

각 다이어그램 패밀리가 담당하는 것:

- 레이아웃 문법
- 기본 시각적 흐름
- 패밀리 고유 invariant
- 허용되는 boundary, lane, lifeline 등의 구조

한 패밀리의 레이아웃 규칙을 다른 패밀리에 강제로 재사용하지 않는다.

### 2.4 질문 중심 패밀리 선택

도형 모양이 아니라 사용자가 답을 얻고 싶은 질문을 기준으로 패밀리를 고른다.

하나의 scene에 system, module, flow, sequence의 질문을 모두 억지로 넣지 않는다. 필요하면 같은 시스템에 대해 여러 다이어그램을 만든다.

---

## 3. 다이어그램 패밀리 정책

### 3.1 `system-architecture`

답해야 하는 질문:

> 전체 HW/SW 환경에서 대상 소프트웨어 또는 미들웨어가 어디에 있고, 주변 계층·프로세스·장치·외부 시스템과 어떤 관계인가?

주요 view:

- `layered-system`
- `deployment-view`
- `context-view`

정책:

- HW → OS → middleware → application 계층을 표현할 수 있다.
- visible frame은 실제 boundary에만 사용한다.
- 모든 분류나 레이어를 자동으로 frame으로 감싸지 않는다.
- focus module은 눈에 띄어야 하지만 전체 그림을 압도해서는 안 된다.

현재 구현 상태:

- `layered-system`: renderer와 family quality check 구현됨
- `deployment-view`: contract-only
- `context-view`: contract-only

### 3.2 `module-architecture`

답해야 하는 질문:

> 하나의 모듈이 내부적으로 어떻게 구성되고, block·interface·state·책임이 어떻게 연결되는가?

주요 view:

- `component-view`
- `internal-block`
- `port-interface-view`

정책:

- 대상 module boundary는 보일 수 있다.
- 내부 block마다 별도 frame을 자동 생성하지 않는다.
- internal / external scope를 명확히 구분한다.
- provided / required interface와 control / data 관계를 의미적으로 구분한다.

현재 구현 상태:

- `component-view`: renderer, 단일 module boundary, scope 검사, runnable fixture 구현됨
- `internal-block`: contract-only
- `port-interface-view`: contract-only

### 3.3 `flow`

답해야 하는 질문:

> 요청, 이벤트, 제어 신호, 데이터가 시스템을 어떻게 이동하는가?

지원 subtype:

- `flow`
- `service-flow`
- `event-flow`
- `data-flow`

주요 view:

- `layered-flow`
- `swimlane-flow`
- `hub-and-spoke`

정책:

- main story가 있으면 primary flow 하나가 명확하게 보여야 한다.
- storage, risk check, retry, background processing은 primary flow와 시각적으로 경쟁하지 않아야 한다.
- relation kind를 calls, dependency, async, read, write, retry, failure 등으로 구분한다.

현재 구현 상태:

- 전용 flow renderer 구현됨
- 네 개의 runnable evaluation fixture가 존재함

### 3.4 `sequence`

답해야 하는 질문:

> actor, process, thread, module이 시간 순서상 어떤 메시지를 주고받는가?

주요 view:

- `synchronous-sequence`
- `asynchronous-sequence`
- `initialization-sequence`

정책:

- participant는 수평축, 시간은 수직축이다.
- 일반 graph/flow layout engine으로 렌더링하지 않는다.
- lifeline, activation, call/return, async message, alt/opt/loop, timeout, retry, error path를 전용 문법으로 다룬다.

현재 구현 상태:

- `SequenceSpec` 계약과 평가 사례 정의됨
- 전용 renderer는 아직 미구현
- contract-only 상태를 성공으로 오인하지 않는다

---

## 4. 핵심 데이터 계약

router와 renderer가 사용하는 주요 계약은 다음과 같다.

- `DiagramSpec`: 일반 graph-like 신규 scene
- `DiagramSpec` v2 + `Visual Plan`: 레이아웃 의도를 포함한 신규 scene
- `SequenceSpec`: 신규 sequence scene
- `SceneSummary`: 기존 scene의 의미 요약
- `DiagramPatch`: 기존 scene의 semantic update
- `QualityReport`: 렌더링 결과의 구조적 검토

정책:

- semantic hint와 관계 의미를 raw coordinate보다 우선한다.
- 기존 수동 레이아웃은 full relayout 요청이 없으면 최대한 보존한다.
- quality failure가 발생하면 작은 semantic patch를 먼저 시도한다.
- Mermaid는 단순 flow reasoning을 위한 임시 보조 수단일 뿐, 최종 산출물이나 sequence renderer의 대체물이 아니다.

---

## 5. 전역 설치 아키텍처

### 5.1 확정된 방향

전역 Copilot skill 사용을 위해 `npm install -g .` 또는 system-wide symlink를 필수로 요구하지 않는다.

기본 설치는 현재 사용자 홈 아래에 두 개의 managed directory를 만든다.

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

역할:

- `skills/excalidraw-skill`: Copilot이 discovery하는 self-contained skill bundle
- `tools/excalidraw-skill`: skill이 직접 실행하는 user-owned runtime

기본 설치 명령:

```text
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

### 5.2 runtime 호출 방식

설치된 skill 옆의 `.excalidraw-skill-install.json`을 읽는다.

marker에 기록된 절대 경로 `runtimeEntry`를 다음 형태로 실행한다.

```text
node <runtimeEntry> <command> ...
```

PATH의 `excalidraw-skill` 명령은 선택적 convenience command다. PATH 명령이 없어도 skill은 정상 동작해야 한다.

### 5.3 설치 marker

Skill marker:

```text
.excalidraw-skill-install.json
```

주요 필드:

- `managedBy`
- `version`
- `installedAt`
- `runtimeDir`
- `runtimeEntry`

Runtime marker:

```text
.excalidraw-skill-runtime.json
```

주요 필드:

- `managedBy`
- `version`
- `installedAt`
- `skillDir`

marker의 목적은 소유권과 관리 범위를 명확히 하는 것이다.

### 5.4 runtime bundle 범위

현재 runtime installer는 다음 entry를 복사한다.

- `bin/`
- `src/`
- `assets/`
- `skills/`
- `.opencode/`
- `.github/prompts/`
- `package.json`

최소 필수 runtime 파일도 별도로 검사한다.

### 5.5 안전 정책

- 기존 디렉터리가 managed marker 없이 존재하면 덮어쓰지 않는다.
- 명시적인 `--force`에서만 unmanaged directory 교체를 허용한다.
- skill과 runtime은 임시 디렉터리와 backup을 사용해 교체한다.
- 교체 중 오류가 발생하면 가능한 범위에서 기존 디렉터리를 복구한다.
- uninstall도 managed directory만 기본 제거한다.
- `--force` 없이 unmanaged directory를 삭제하지 않는다.

### 5.6 update와 uninstall

업데이트:

```text
git pull
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

제거:

```text
npm run skill:uninstall:global
```

skill bundle과 managed runtime을 함께 교체하거나 제거한다.

### 5.7 custom location

지원 환경 변수:

- `COPILOT_HOME`
- `EXCALIDRAW_SKILL_GLOBAL_DIR`
- `EXCALIDRAW_SKILL_RUNTIME_DIR`

기본 경로는 `COPILOT_HOME` 또는 사용자 홈의 `.copilot` 아래에서 계산한다.

---

## 6. 권한과 `sudo` 정책

### 6.1 기본 원칙

npm global symlink 생성에서 `EACCES`가 발생해도 `sudo npm install -g .`를 기본 해결책으로 사용하지 않는다.

이유:

- 이후 update와 uninstall도 관리자 권한을 요구할 수 있다.
- npm 관련 디렉터리에 root-owned 파일이 남을 수 있다.
- 회사 PC와 제한된 개발 환경에서 권한 정책과 충돌할 수 있다.
- Copilot skill 동작에 global npm command 자체가 필요하지 않다.

### 6.2 권장 해결책

PATH convenience command가 꼭 필요한 경우에만 다음을 사용한다.

1. 사용자 소유 Node version manager
2. 사용자 소유 npm prefix

macOS/Linux 예:

```text
npm config set prefix ~/.local
```

그리고 `~/.local/bin`을 PATH에 추가한다.

### 6.3 `sudo` 허용 조건

의도적으로 관리자가 system-wide Node package를 운영하는 환경이고, 사용자가 이후 update/uninstall도 관리자 권한이 필요할 수 있음을 받아들인 경우에만 예외적으로 허용한다.

---

## 7. `doctor` 정책

`doctorGlobalSkill()`은 다음을 구분한다.

- `skillOk`: skill bundle, marker, 필수 파일 정상
- `runtimeOk`: runtime bundle, marker, 필수 파일, runtime entry 정상
- `cliOk`: PATH convenience command 존재 여부
- `ok`: `skillOk && runtimeOk`

중요 결정:

- `cliOk`는 `ok`의 필수 조건이 아니다.
- PATH 명령이 없으면 warning을 제공하지만 설치 실패로 처리하지 않는다.
- 설치 성공 기준은 skill과 managed runtime의 완전성이다.

---

## 8. 프로젝트 로컬 초기화 정책

프로젝트 로컬 설정은 전역 설치와 분리한다.

```text
npm install
npm run doctor
npm run init
```

`init`이 현재 workspace에 생성하는 파일:

- `.opencode/commands/excalidraw.md`
- `.github/prompts/excalidraw.prompt.md`

정책:

- 이미 존재하는 사용자 파일은 덮어쓰지 않는다.
- project-local skill이 있으면 우선한다.
- project-local skill이 없으면 globally installed skill을 사용하도록 안내한다.
- `init` 실행 위치의 workspace를 수정해야 하며 managed runtime directory를 수정하면 안 된다.
- `init`은 `~/.copilot`에 아무것도 설치하지 않는다.

현재 `src/init.mjs`에는 local-first, global-fallback 안내가 반영되어 있다.

주의점:

- `writeIfMissing` 정책 때문에 이전 버전에서 생성된 entrypoint 문구는 자동 migration되지 않는다.
- 필요하면 향후 `init --upgrade` 또는 marker 기반 migration 정책을 별도로 설계한다.

---

## 9. 테스트와 평가 정책

### 9.1 unit/integration test

`npm test`는 `src/*.test.mjs`를 Node test runner로 실행한다.

전역 설치 관련 테스트가 확인하는 항목:

- skill과 runtime이 함께 설치됨
- 필수 파일과 marker 존재
- skill marker가 runtime 경로를 가리킴
- `doctor`가 skill/runtime 정상 상태를 판정함
- reinstall이 두 managed directory를 교체함
- stale file이 제거됨
- unmanaged skill/runtime directory를 기본 덮어쓰지 않음
- `--force` 동작
- uninstall이 두 managed directory를 제거함
- custom path와 `COPILOT_HOME` 해석
- bundled docs와 repository docs의 동기화

테스트는 실제 사용자 홈을 건드리지 않도록 임시 디렉터리를 사용한다.

### 9.2 smoke test

주요 명령:

```text
npm run smoke
npm run smoke:system
npm run smoke:module
```

smoke test는 실제 `.excalidraw` 생성과 inspect/validate 흐름을 확인한다.

### 9.3 evaluation suite

목표:

- 한 가지 결제 예제에 과적합하지 않는다.
- 패밀리별 구조와 invariant를 별도로 평가한다.
- 미구현 view를 성공으로 처리하지 않는다.

명령:

```text
npm run evaluate
npm run evaluate:flow
npm run evaluate:system
npm run evaluate:module
```

최종 pass 조건:

- 공통 구조 검사 `structuralPass`
- 패밀리별 invariant 검사 `familyPass`

둘 다 성공해야 한다.

현재 평가 suite는 네 패밀리의 사례를 포함하며, runnable과 contract-only를 구분한다.

### 9.4 품질 해석

`QualityReport` 통과는 구조적 증거다. 다음을 의미하지 않는다.

- 사람이 보기에 충분히 아름답다.
- 수동 수정 비용이 0이다.
- 모든 edge routing과 spacing이 최적이다.
- 실제 사용자의 설명 목적이 완벽히 충족됐다.

최종 검토에는 렌더 화면 확인과 수동 수정 비용 평가가 필요하다.

---

## 10. 현재 구현 상태 요약

| 영역 | 상태 | 비고 |
|---|---|---|
| Router skill | 구현됨 | 단일 top-level router, 선택적 문서 로딩 |
| Managed skill install | 구현됨 | `~/.copilot/skills/excalidraw-skill` |
| Managed runtime install | 구현됨 | `~/.copilot/tools/excalidraw-skill` |
| Marker 기반 소유권 | 구현됨 | skill/runtime 각각 marker 사용 |
| PATH 비의존 실행 | 구현됨 | `runtimeEntry` 절대 경로 실행 |
| Atomic replacement/rollback | 구현됨 | temporary/backup directory 방식 |
| Managed uninstall | 구현됨 | skill/runtime 동시 제거 |
| Custom install paths | 구현됨 | 3개 환경 변수 지원 |
| Optional PATH CLI | 지원됨 | npm global install은 선택 사항 |
| Project-local init | 구현됨 | local-first, global-fallback 문구 |
| Flow renderer | 구현됨 | 4 subtype runnable |
| Layered system renderer | 구현됨 | family quality check 포함 |
| Module component renderer | 구현됨 | scope/boundary 검사 포함 |
| Sequence renderer | 미구현 | 계약과 평가 사례만 존재 |
| Deployment/context views | 미구현 | contract-only |
| Module internal/port views | 미구현 | contract-only |

---

## 11. 문서 체계

주요 문서 역할:

- `README.md`: 빠른 시작과 현재 범위
- `docs/PROJECT_DECISIONS_AND_STATUS.md`: 결정, 정책, 구현 상태의 기준 문서
- `docs/GLOBAL_INSTALL.md`: 사람을 위한 전역 설치 절차
- `docs/AGENT_SETUP.md`: LLM이 설치를 수행하는 runbook
- `docs/USAGE.md`: CLI와 사용 방법
- `docs/DIAGRAM_TYPES.md`: 패밀리 선택과 의미
- `docs/QUALITY_CRITERIA.md`: 품질 기준
- `docs/DIAGRAM_FAMILY_ROADMAP.md`: 패밀리 구현 로드맵
- `docs/SMOKE_TEST.md`: smoke 절차
- `docs/RELEASE_CHECKLIST.md`: release 검증
- `examples/evaluation/README.md`: 평가 suite 사용법

`DIAGRAM_TYPES.md`와 `QUALITY_CRITERIA.md`는 installed skill bundle에도 복사되며 테스트로 동기화를 검사한다.

---

## 12. 확정된 비목표

현재 단계에서 다음은 기본 목표가 아니다.

- npm global command를 필수 설치 경로로 만드는 것
- 관리자 권한을 기본 설치 요구사항으로 만드는 것
- 모든 다이어그램 패밀리를 하나의 generic graph layout으로 처리하는 것
- sequence를 flow renderer로 임시 대체하는 것
- 모든 category/layer에 frame을 자동 생성하는 것
- quality checker 통과를 미적 승인으로 간주하는 것
- 기존 사용자 workspace 파일을 무조건 덮어쓰는 것
- raw Excalidraw JSON을 LLM이 직접 유지보수하는 것

---

## 13. 알려진 제약과 기술 부채

### 13.1 절대 `runtimeEntry` 경로

marker는 절대 경로를 기록한다. 설치 디렉터리를 수동 이동하면 marker가 깨진다. 이동 대신 installer를 다시 실행해야 한다.

### 13.2 두 디렉터리 트랜잭션

현재 installer는 backup과 rollback을 사용하지만, 프로세스 강제 종료나 filesystem 수준 장애까지 완전한 원자성을 보증하지는 않는다. 일반적인 오류 복구를 목표로 한다.

### 13.3 runtime bundle 크기

runtime에 `skills/`와 entrypoint template도 포함된다. self-contained 배포에는 유리하지만 중복과 크기 증가가 있다. 향후 manifest 기반 최소 bundle을 검토할 수 있다.

### 13.4 project entrypoint migration

`init`은 기존 파일을 덮어쓰지 않는다. 안전하지만 오래된 generated entrypoint를 자동 갱신하지 못한다.

### 13.5 플랫폼 검증

경로 탐색은 Windows `PATHEXT`와 Unix executable bit를 고려한다. 다만 Windows/macOS/Linux 실제 환경의 end-to-end 설치 검증은 release 전에 반복해야 한다.

### 13.6 배포 방식

현재 기본 흐름은 repository checkout에서 installer를 실행하는 방식이다. npm registry 배포, signed release artifact, single-file installer는 별도 결정이 필요하다.

### 13.7 검증 상태

이 문서는 현재 `main` 코드와 기존 문서를 대조해 작성했다. 이 문서 작성 시점에 전체 `npm test`, smoke, evaluation을 새로 실행한 것은 아니다. release 판단 전에 반드시 실제 명령을 다시 실행해야 한다.

---

## 14. 다음 작업 우선순위

### P0: 현재 설치 모델 안정화

1. `npm test` 전체 실행
2. 전역 installer를 임시 HOME에서 end-to-end 실행
3. marker의 `runtimeEntry`로 다른 workspace에서 `init`, `build`, `inspect`, `validate` 실행
4. reinstall과 uninstall 반복 검증
5. unmanaged directory와 `--force` 시나리오 확인
6. Windows, macOS, Linux 경로 테스트
7. release checklist에 `skillOk`, `runtimeOk`, optional `cliOk` 의미 반영

### P1: 다이어그램 기능 확장

1. sequence 전용 renderer 구현
2. sequence quality invariant 구현
3. deployment/context renderer 구현
4. internal-block/port-interface renderer 구현
5. 각 신규 view에 runnable fixture 추가

### P1: project init 개선

1. generated file marker 도입 검토
2. `init --upgrade` 또는 안전한 migration 설계
3. 기존 사용자 수정 파일과 generated file 구분

### P2: 배포 개선

1. runtime bundle manifest 정리
2. npm package 또는 release archive 기반 설치 검토
3. 버전 호환성과 migration 정책 정의
4. 설치 후 자동 health check 강화

---

## 15. 개발 시 유지해야 할 규칙

코드 또는 문서를 변경할 때 다음을 지킨다.

- 설치 모델을 PATH CLI 필수 방식으로 되돌리지 않는다.
- `doctor.ok`와 `cliOk`의 의미를 혼동하지 않는다.
- managed marker 없는 경로를 자동 덮어쓰거나 삭제하지 않는다.
- skill 문서와 runtime 구현을 함께 갱신한다.
- diagram family의 질문과 layout grammar를 유지한다.
- 공통 renderer 변경은 모든 runnable family fixture로 회귀 검증한다.
- contract-only 기능을 구현 완료로 표시하지 않는다.
- quality pass와 aesthetic approval을 구분한다.
- 기존 manual layout과 사용자 파일을 기본 보존한다.
- README, install guide, agent runbook, 이 문서의 설치 명령이 서로 어긋나지 않게 유지한다.

---

## 16. 기준 명령 모음

개발 검증:

```text
npm test
npm run smoke
npm run smoke:system
npm run smoke:module
npm run evaluate
```

전역 설치:

```text
npm run skill:install:global
npm run skill:doctor:global
```

전역 제거:

```text
npm run skill:uninstall:global
```

프로젝트 로컬 entrypoint:

```text
npm run init
```

설치 후 runtime 직접 실행:

```text
node <runtimeEntry> <command> ...
```

---

## 17. 결정 요약

가장 중요한 최종 결정은 다음과 같다.

1. 전역 skill 사용에 npm global symlink를 필수로 하지 않는다.
2. skill과 user-owned runtime을 `~/.copilot` 아래에 함께 설치한다.
3. skill은 marker의 절대 `runtimeEntry`를 Node.js로 직접 실행한다.
4. PATH CLI는 선택 사항이며 `cliOk` 실패는 전체 설치 실패가 아니다.
5. npm `EACCES`에서 `sudo`는 기본 해결책이 아니다.
6. unmanaged directory는 명시적 `--force` 없이 변경하지 않는다.
7. project-local init과 global installation을 분리한다.
8. diagram family는 사용자가 답을 원하는 질문을 기준으로 선택한다.
9. 각 family가 자체 layout grammar와 invariant를 소유한다.
10. sequence는 일반 flow renderer로 처리하지 않는다.
11. structural quality pass는 aesthetic approval이 아니다.
12. 미구현 view는 contract-only로 명확히 표시한다.
