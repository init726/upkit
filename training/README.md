# Upkit training

웹앱(`web/`)이 사용자 기기에서 실행할 **부품 분할 모델**을 만드는 오프라인 파이프라인입니다.
여기 있는 코드는 개발자 PC에서만 실행되며 서비스에 배포되지 않습니다.

```text
① 사진 수집 ──▶ ② 선생 모델 자동 라벨 ──▶ ③ 사람 검수 ──▶ ④ 학생 모델 학습
                (teacher/)                                  (RF-DETR Seg)
                                                                 │
      web/static/models/upkit-seg/  ◀── ⑥ ONNX + model.json ◀── ⑤ 고정 test 세트 평가
```

## 폴더

| 경로 | 내용 | 상태 |
| --- | --- | --- |
| `data/raw/` | Wikimedia Commons 사진 100장 | 대부분 2000년대 구형 PC, 무관한 사진 포함 |
| `data/review/`, `data/contact-sheets/` | 자동 라벨 시각화 | 검수용 |
| `data/labels-auto/` | 자동 라벨 (YOLO 다각형 형식) | **학습에 쓰지 말 것**. 아래 품질 문제 참고 |
| `data/legacy/` | 이전 검수 스냅샷 | 승인 2장 / 100장 |
| `data/dataset-smoke/` | 파이프라인 확인용 소형 데이터셋 | 미검수 라벨 |
| `teacher/grounded_sam.py` | Grounding DINO + CLIP + SAM 자동 라벨러 | 예전 백엔드에서 옮겨옴. `app.*` import를 정리해야 실행됨 |
| `tools/make_dummy_model.py` | 웹 런타임 테스트용 가짜 ONNX | 바로 사용 가능 |
| `../runs/segment/.../m4-smoke` | Ultralytics YOLO smoke 학습 (1 epoch) | 참고용. 상용 사용 불가(아래 참고) |

### 자동 라벨에서 확인된 문제

- `motherboard` 윤곽선이 케이스 전체를 덮는 경우가 많음
- 케이스 팬이 대부분 `cpu_cooler`로 분류됨 (`"CPU cooling fan"` 프롬프트가 모든 팬에 반응)
- 사람·조각품 등 무관한 사진도 `usable: true` (촬영 방향 분류가 front/back 둘 중 하나만 고름)

자동 라벨은 검수 시간을 줄이는 초안일 뿐이며, 이대로 학습하면 선생 모델의 오류를 그대로 배웁니다.

## 학생 모델 선택: RF-DETR Seg

| 후보 | 라이선스 | 판단 |
| --- | --- | --- |
| **RF-DETR Seg** (Nano~Large) | Apache 2.0 | **권장.** 상용 가능, ONNX 내보내기 지원 |
| Ultralytics YOLO11/YOLOv8-seg | AGPL-3.0 | 서비스에 쓰면 전체 소스 공개 또는 유료 라이선스 필요 |

RF-DETR XL·2XL 크기는 문서마다 라이선스 표기가 달라서, 사용할 가중치의 LICENSE를 직접 확인해야 합니다.
모바일 브라우저에서 돌리므로 Nano 또는 Small부터 시작합니다.

## 웹앱과의 계약: `model.json`

ONNX를 내보낼 때 같은 폴더에 아래 형식의 `model.json`을 함께 저장합니다.
웹앱은 `web/static/models/upkit-seg/model.json`이 있으면 기기 내 분석기를, 없으면 데모 분석기를 사용합니다.
(검증 코드: `web/src/lib/vision/onnx/manifest.ts`)

```json
{
  "name": "upkit-seg",
  "version": "0.1.0",
  "architecture": "detr-seg",
  "file": "model.onnx",
  "input": { "size": 432, "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225] },
  "classes": [null, "motherboard", "gpu", "memory", "storage", "cpu_cooler", "power_supply", "case_fan"],
  "outputs": { "boxes": "dets", "logits": "labels", "masks": "masks" },
  "thresholds": { "minScore": 0.3, "unknownBelow": 0.45, "confirmBelow": 0.6, "maskLogit": 0 },
  "maxDetections": 20
}
```

| 필드 | 의미 |
| --- | --- |
| `input.size` | 정사각형 입력 한 변. 웹앱은 **비율을 유지하지 않고** 늘려서 넣습니다 |
| `input.mean/std` | 0~1 RGB에 적용하는 정규화 값. 학습 시 전처리와 반드시 같아야 합니다 |
| `classes` | 로짓 인덱스 → 카테고리. 배경·상위 클래스처럼 쓰지 않는 인덱스는 `null` |
| `outputs` | ONNX 출력 이름. 생략하면 텐서 모양으로 추정합니다 |
| `thresholds.minScore` | 이 점수 미만은 버림 |
| `thresholds.unknownBelow` | 이 점수 미만은 카테고리를 단정하지 않고 "확인 필요"로 표시 |
| `thresholds.confirmBelow` | 이 점수 미만은 "확인 필요" 배지 표시 |
| `version` | 바뀌면 사용자 브라우저의 모델 캐시가 갱신됩니다 |

기대하는 출력 텐서:

- `boxes` `[1, Q, 4]`: cx, cy, w, h (입력 기준 0~1)
- `logits` `[1, Q, C]`: 클래스별 로짓 (sigmoid 적용 전)
- `masks` `[1, Q, H, W]`: 이미지 전체 기준 마스크 로짓 (선택)

RF-DETR에서 내보낸 ONNX의 실제 출력 이름·모양·전처리는 내보낸 뒤 반드시 확인하고 `model.json`에 맞춰 적습니다.

## 다음 작업

1. **데이터**: 요즘 빌드(강화유리, RGB, 수랭, 대형 GPU) 사진을 직접 촬영하거나 허락받고 수집. 뒷면·닫힌 케이스·무관한 사진 같은 음성 표본 20% 이상
2. **선생 모델 정비**: `teacher/grounded_sam.py`를 독립 스크립트로 정리하고 팬/쿨러 프롬프트, 메인보드 과대 영역, 무관한 사진 거부를 개선
3. **검수 도구**: 자동 라벨을 빠르게 승인·수정하는 화면
4. **학습**: RF-DETR Seg Nano/Small, PC 단위로 train/val/test 분리
5. **평가**: 고정 test 세트로 클래스별 precision/recall, mask IoU, 음성 사진 오탐률, 기기별 추론 시간
6. **배포**: ONNX + `model.json`을 `web/static/models/upkit-seg/`에 복사

### 웹 런타임만 먼저 확인하기

```bash
python3 -m venv .venv && .venv/bin/pip install onnx numpy
.venv/bin/python training/tools/make_dummy_model.py web/static/models/upkit-seg
cd web && npm run dev   # 헤더 배지가 "기기 내 AI"로 바뀜
```
