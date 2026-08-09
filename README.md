# Upkit — v1.0 Frontend MVP

**Upkit**은 조립 PC 초보자가 케이스 내부를 촬영하면 장착된 부품의 **종류와 위치**를 확인하고, 정확한 모델 확인에 필요한 추가 촬영을 안내받는 모바일 우선 웹 앱이다.

> See it. Swap it. Upgrade it.

## v1.0 목표

- 카메라 촬영 또는 이미지 업로드
- 촬영 전 안전 확인
- Vision 분석 대기 UI
- 사진 위 부품 bounding box 표시
- 탐지 부품 목록, 신뢰도, 관찰 근거 표시
- 정확한 모델을 확정할 수 없으면 라벨 확대 촬영 요청
- mock 분석과 실제 API 구현을 동일 인터페이스로 교체 가능

## v1.0 비목표

- 사진 한 장으로 정확한 CPU/GPU/RAM 모델 확정
- 고장 진단, 전기적 정상 여부, 완전 체결 여부 판정
- 부품 구매 추천 및 가격 비교
- 실시간 AR 또는 영상 추적
- PSU 내부 분해 안내

## 부품 판단 원칙

1. Vision은 외형과 장착 위치로 `gpu`, `memory`, `cpu_cooler`, `motherboard`, `storage`, `power_supply`, `case_fan`을 대분류한다.
2. 정확한 모델은 외형만으로 확정하지 않는다.
3. 라벨·각인을 추가 촬영하고 OCR 문자열로 제품 DB 후보를 검색한다.
4. 최종 제품은 사용자가 확인한다.
5. 신뢰도가 낮거나 가려진 대상은 `unknown` 또는 `needsConfirmation`으로 반환한다.

## 분석 파이프라인

```text
촬영 → 품질 검사 → 부품 탐지 → 위치 좌표 반환
    → 라벨 확대 촬영 → OCR → DB 후보 검색 → 사용자 확정
```

## API 계약

프론트는 `VisionAnalysisService`만 의존한다. 현재 `mockVisionService`를 사용하며 실제 API는 같은 인터페이스로 구현한다.

```ts
interface VisionAnalysisService {
  analyze(image: File): Promise<AnalysisResult>;
}
```

Bounding box는 화면 크기와 독립적인 0~1 정규화 좌표다.

```ts
interface Detection {
  id: string;
  category: ComponentCategory;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  visibleText: string[];
  observations: string[];
  manufacturerCandidates: string[];
  productCandidates: ProductCandidate[];
  needsConfirmation: boolean;
  requestedPhoto?: string;
}
```

## 제품 DB 정책

- 초기 DB는 제조사 공식 사양과 공식 매뉴얼로 검수한 소량의 제품만 저장한다.
- 사용자 선택은 개인 PC 구성에만 저장하고 공용 DB에 자동 반영하지 않는다.
- 사용자 제출 데이터는 관리자 검수 후 공용 DB 후보가 된다.
- 쇼핑몰 상품명과 가격은 v1.0에서 제외한다.
- 권장 초기 범위: 메인보드 10, GPU 20, RAM 15, SSD 15, 쿨러 10, PSU 10개.

### 제품 레코드

```ts
interface Product {
  id: string;
  category: ComponentCategory;
  manufacturer: string;
  modelName: string;
  aliases: string[];
  specifications: Record<string, string | number | boolean>;
  visualFeatures: string[];
  identifiers: { modelNumbers: string[]; barcodeValues?: string[] };
  sources: { type: "official-product-page" | "official-manual"; url: string; verifiedAt: string }[];
}
```

## 안전 규칙

- 촬영 전에 PC 종료와 전원 케이블 분리를 확인한다.
- PSU 내부 분해를 안내하지 않는다.
- 사진으로 전기적 정상, 내부 손상, 완전 체결을 확정하지 않는다.
- 낮은 신뢰도 결과에는 추가 촬영 또는 사용자 확인을 요구한다.

## 실행

```bash
npm install
npm run dev
```

프로덕션 확인:

```bash
npm run build
npm run preview
```

## 실제 Vision API 연결 위치

`src/services/vision.ts`의 `mockVisionService`와 동일한 `VisionAnalysisService` 구현을 추가한다. API 키는 브라우저에 넣지 말고 백엔드 환경 변수에 저장한다. 백엔드는 업로드 이미지를 분석한 뒤 반드시 `AnalysisResult` 형식으로 검증해 반환한다.

## 다음 버전

1. 라벨 확대 촬영 및 OCR 후보 검색
2. 사용자 PC 구성 저장
3. 공식 제품 DB와 호환성 규칙
4. 장착 전후 비교
5. 전용 객체 탐지 모델
