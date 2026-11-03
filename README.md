# Upkit

> See it. Swap it. Upgrade it.

PC 케이스 내부 사진 한 장으로 부품의 종류와 위치를 윤곽선으로 보여주고, 라벨을 찍으면 정확한 모델을 확인해 주는 모바일 우선 웹앱입니다.

## 구조

```text
upkit/
├── web/        SvelteKit 3 앱 (화면 + 서버 API). 배포 대상
└── training/   부품 분할 모델을 만드는 Python 파이프라인. 개발자 PC에서만 실행
```

## AI 구조

분석 1회당 서버 비용이 0에 가깝도록, 무거운 추론은 **사용자 기기에서** 실행합니다.

```text
[사용자 브라우저]
  ├─ 촬영 품질 검사 (밝기·흔들림·해상도)   AI 아님, 일반 코드
  ├─ 부품 탐지 + 윤곽선                    분할 모델(ONNX)을 Web Worker에서 실행
  │                                         WebGPU 우선, 안 되면 WASM. 사진은 기기 밖으로 나가지 않음
  └─ 라벨 확대 사진 ─────────────┐
                                  ▼
[SvelteKit 서버 /api/label]  라벨 읽기 제공자 (교체 가능)
                               - gemini: Gemini API (무료 등급으로 시작)
                               - demo  : API 키 없이 흐름 확인
```

| 단계 | 위치 | 코드 |
| --- | --- | --- |
| 품질 검사 | 브라우저 | `web/src/lib/vision/quality.ts` |
| 모델 다운로드·캐시·실행 | 브라우저 Worker | `web/src/lib/vision/onnx/worker.ts` |
| 출력 디코딩, 마스크 → 다각형 | 브라우저 Worker | `web/src/lib/vision/onnx/postprocess.ts`, `contour.ts` |
| 중복 제거·개수 제한·낮은 점수 처리 | 브라우저 | `web/src/lib/vision/rules.ts` |
| 라벨 읽기 | 서버 | `web/src/lib/server/label/` |

학습된 모델(`web/static/models/upkit-seg/model.json`)이 없으면 자동으로 **데모 분석기**가 사용되고, 화면에 데모라고 표시됩니다.
모델을 만드는 방법과 웹앱과의 계약은 [training/README.md](training/README.md)를 참고하세요.

## 실행

Node.js 22.17 이상이 필요합니다.

```bash
cd web
npm install
cp .env.example .env   # 라벨 읽기를 실제로 쓰려면 GEMINI_API_KEY 입력
npm run dev
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run check` | 타입 검사 |
| `npm run build` / `npm run preview` | 프로덕션 빌드 / 미리보기 |

휴대폰 카메라로 확인하려면 HTTPS가 필요할 수 있습니다.

### 환경 변수 (`web/.env`)

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `LABEL_PROVIDER` | `auto` | `auto`(키가 있으면 gemini) · `gemini` · `demo` |
| `GEMINI_API_KEY` | — | Google AI Studio 키. 서버에서만 사용 |
| `GEMINI_MODEL` | `gemini-flash-latest` | 라벨 읽기 모델 |

Gemini 무료 등급은 한도가 계정마다 다르고, 전송한 데이터가 Google 모델 개선에 쓰일 수 있습니다.
그래서 앱은 라벨 사진을 보내기 전에 외부 전송을 고지하며, 케이스 전체 사진은 보내지 않습니다.

## 기술 메모

- **SvelteKit 3**: 설정은 `svelte.config.js`가 아니라 `vite.config.ts`의 `sveltekit({...})`에 넣습니다. `$lib` 대신 `#lib/...ts`(package.json `imports`)를 쓰고, 환경 변수는 `src/env.ts`에서 정의해 `$app/env/private`로 가져옵니다.
- **onnxruntime-web**: WebGPU 런타임 wasm(약 28MB)은 정적 호스팅의 파일 크기 제한을 넘을 수 있어서 같은 버전을 jsDelivr에서 받습니다(`onnxruntime-web-use-extern-wasm` 조건). 사용자 사진은 이 경로로 전송되지 않습니다.
- **배포**: 지금은 `adapter-auto`입니다. 배포처(Cloudflare, Vercel 등)를 정하면 해당 어댑터로 바꿉니다.

## 판단 원칙

- 외형만으로 정확한 제품 모델을 단정하지 않습니다. 모델명은 라벨에 **보이는 문자**로만 확인하고, 마지막에 사용자가 확정합니다.
- 점수가 낮은 탐지는 카테고리를 단정하지 않고 "확인 필요"로 보여줍니다. 모델 점수는 정답일 확률이 아님을 화면에 밝힙니다.
- 사진만으로 전기적 안전, 고장, 완전 체결 여부를 판단하지 않습니다.

## 안전 원칙

- 촬영 전 PC를 완전히 종료하고 전원 케이블을 분리하도록 확인합니다.
- 파워서플라이 내부를 열도록 안내하지 않습니다.

## 현재 상태

- [x] SvelteKit 3 앱: 안전 확인 → 촬영 → 품질 검사 → 분석 → 윤곽선 결과 → 라벨 확인
- [x] 기기 내 추론 런타임 (테스트용 가짜 모델로 WebGPU 실행까지 확인)
- [x] 라벨 읽기 API (데모 제공자로 확인, Gemini는 실제 키로 아직 미검증)
- [ ] 학습된 부품 분할 모델 (데이터 수집·검수부터 필요)
- [ ] 제품 DB와 모델 후보 검색
- [ ] 사용자 PC 구성 저장, 업그레이드 가이드

## 라이선스

현재 별도의 라이선스가 지정되어 있지 않습니다.
