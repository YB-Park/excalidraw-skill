# excalidraw-skill

LLM과 함께 편집 가능한 Excalidraw 소프트웨어 다이어그램을 생성하고 수정하는 도구입니다.

## 전역 설치

기본 설치는 npm 전역 symlink나 관리자 권한을 요구하지 않습니다.

```text
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

다음 두 디렉터리가 현재 사용자 홈 아래에 설치됩니다.

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

첫 번째는 Copilot skill bundle이고 두 번째는 skill이 직접 호출하는 실행 runtime입니다. 설치 후 VS Code를 reload하거나 새 Copilot Chat을 시작하세요.

업데이트:

```text
git pull
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

`npm install -g .`는 터미널에서 `excalidraw-skill` 명령을 직접 사용하려는 경우에만 선택적으로 사용합니다. 권한 오류가 발생하면 Node 버전 매니저나 사용자 소유 npm prefix를 사용하세요.

자세한 설치 및 제거 방법은 `docs/GLOBAL_INSTALL.md`, LLM 자동 설치 절차는 `docs/AGENT_SETUP.md`를 참고하세요.

## 프로젝트 로컬 설정

```text
npm install
npm run doctor
npm run init
```

이 명령은 현재 workspace의 `.opencode/commands`와 `.github/prompts` entrypoint만 생성하며 `~/.copilot`에는 설치하지 않습니다.

## 개발 확인

```text
npm test
npm run smoke
npm run smoke:system
npm run smoke:module
npm run evaluate
```

## 지원 다이어그램 패밀리

- `system-architecture`
- `module-architecture`
- `flow`
- `sequence`

현재 flow, layered-system, module component-view renderer가 구현되어 있습니다. sequence는 전용 계약과 평가 사례가 준비되어 있으며 전용 renderer를 개발 중입니다.

## 주요 문서

- 전역 설치: `docs/GLOBAL_INSTALL.md`
- LLM 설치 런북: `docs/AGENT_SETUP.md`
- 사용법: `docs/USAGE.md`
- 다이어그램 타입: `docs/DIAGRAM_TYPES.md`
- 품질 기준: `docs/QUALITY_CRITERIA.md`
- 구현 로드맵: `docs/DIAGRAM_FAMILY_ROADMAP.md`
- 평가 가이드: `examples/evaluation/README.md`
