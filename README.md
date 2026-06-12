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
npm run smoke
```

## 다이어그램 만들기

opencode에서는 이렇게 요청합니다.

```txt
/excalidraw 결제 승인 흐름 다이어그램 만들어줘
```

CLI로 예제를 생성하려면:

```txt
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.grouped.diagram.json
```

## 문서

- LLM 설치 런북: `docs/AGENT_SETUP.md`
- 사용법: `docs/USAGE.md`
- smoke test: `docs/SMOKE_TEST.md`
- 릴리즈 체크리스트: `docs/RELEASE_CHECKLIST.md`

## 현재 범위

- 0.1 파일럿입니다.
- 기본 Excalidraw 도형을 사용합니다.
- 커스텀 도형 라이브러리는 아직 필수가 아닙니다.
- layout 품질은 실제 사용하면서 조율합니다.
