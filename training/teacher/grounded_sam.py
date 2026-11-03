from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Optional

from PIL.Image import Image

from app.analyzers.base import VisionAnalyzer
from app.config import CLIP_MODEL_ID, GROUNDING_MODEL_ID, MODEL_DEVICE, SAM_MODEL_ID
from app.schemas import AnalysisResult


@dataclass
class Candidate:
    category: str
    score: float
    box: list[float]


PROMPTS = [
    "computer graphics card",
    "RAM memory module",
    "CPU cooling fan",
    "CPU heatsink",
    "computer motherboard",
    "computer power supply",
    "hard disk drive",
    "solid state drive",
    "computer case cooling fan",
]

FRONT_VIEW_PROMPTS = [
    "front component side of a desktop PC interior",
    "visible motherboard GPU RAM and CPU cooler inside PC",
    "open computer case with installed components",
    "PC motherboard component side",
]

BACK_VIEW_PROMPTS = [
    "back side of motherboard tray with cable management",
    "rear cable routing side of PC case",
    "computer case cable management compartment",
    "wires behind motherboard with no components",
]

VIEW_LABELS = FRONT_VIEW_PROMPTS + BACK_VIEW_PROMPTS

CATEGORY_NAMES = {
    "gpu": "그래픽카드",
    "memory": "메모리",
    "cpu_cooler": "CPU 쿨러",
    "motherboard": "메인보드",
    "power_supply": "파워서플라이",
    "storage": "저장장치",
    "case_fan": "케이스 팬",
}


class GroundedSamAnalyzer(VisionAnalyzer):
    name = "grounded-sam"

    def __init__(self) -> None:
        self._loaded = False
        self._load_lock = asyncio.Lock()
        self.device = "cpu"

    async def analyze(self, image: Image, image_id: str) -> AnalysisResult:
        await self._ensure_loaded()
        return await asyncio.to_thread(self._analyze_sync, image.copy(), image_id)

    async def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        async with self._load_lock:
            if self._loaded:
                return
            await asyncio.to_thread(self._load_models)
            self._loaded = True

    def _load_models(self) -> None:
        import torch
        from transformers import (
            AutoModelForZeroShotObjectDetection,
            AutoProcessor,
            CLIPModel,
            CLIPProcessor,
            SamModel,
            SamProcessor,
        )

        if MODEL_DEVICE == "auto":
            self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        else:
            self.device = MODEL_DEVICE

        self.torch = torch
        self.grounding_processor = AutoProcessor.from_pretrained(GROUNDING_MODEL_ID, local_files_only=True)
        self.grounding_model = AutoModelForZeroShotObjectDetection.from_pretrained(
            GROUNDING_MODEL_ID, local_files_only=True
        ).to(self.device).eval()
        self.clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID, local_files_only=True)
        self.clip_model = CLIPModel.from_pretrained(CLIP_MODEL_ID, local_files_only=True).to(self.device).eval()
        self.sam_processor = SamProcessor.from_pretrained(SAM_MODEL_ID, local_files_only=True)
        self.sam_model = SamModel.from_pretrained(SAM_MODEL_ID, local_files_only=True).to(self.device).eval()

    def _analyze_sync(self, image: Image, image_id: str) -> AnalysisResult:
        started = time.perf_counter()
        try:
            view, view_score = self._classify_view(image)
            if view != "front":
                return self._unusable_result(image_id, view, view_score, started)

            candidates = self._detect(image)
            if not candidates:
                return AnalysisResult.model_validate({
                    "imageId": image_id,
                    "imageQuality": {"usable": False, "issues": ["occluded"]},
                    "detections": [],
                    "warnings": [
                        "부품을 충분한 신뢰도로 찾지 못했습니다. 케이스 부품 면을 정면에서 다시 촬영해주세요.",
                        self._timing_warning(started),
                    ],
                })

            outlines = self._segment(image, [item.box for item in candidates])
            width, height = image.size
            detections = []
            for index, (candidate, outline) in enumerate(zip(candidates, outlines), start=1):
                x1, y1, x2, y2 = candidate.box
                detections.append({
                    "id": f"{candidate.category}-{index}",
                    "category": candidate.category,
                    "confidence": round(candidate.score, 4),
                    "boundingBox": {
                        "x": x1 / width, "y": y1 / height,
                        "width": (x2 - x1) / width, "height": (y2 - y1) / height,
                    },
                    "outline": [{"x": x / width, "y": y / height} for x, y in outline],
                    "visibleText": [],
                    "observations": [
                        "Grounding DINO 텍스트 탐지 후보",
                        "SAM 마스크를 따라 외곽선을 생성함",
                    ],
                    "manufacturerCandidates": [],
                    "productCandidates": [],
                    "needsConfirmation": True,
                    "requestedPhoto": f"{CATEGORY_NAMES[candidate.category]} 라벨이 보이도록 확대 촬영해주세요.",
                })

            return AnalysisResult.model_validate({
                "imageId": image_id,
                "imageQuality": {"usable": True, "issues": []},
                "detections": detections,
                "warnings": [
                    "오픈 보캐뷸러리 기준선 결과이며 정확한 부품 모델은 확인이 필요합니다.",
                    self._timing_warning(started),
                ],
            })
        finally:
            image.close()

    def _classify_view(self, image: Image) -> tuple[str, float]:
        inputs = self.clip_processor(text=VIEW_LABELS, images=image, return_tensors="pt", padding=True).to(self.device)
        with self.torch.no_grad():
            logits = self.clip_model(**inputs).logits_per_image[0]
            group_logits = self.torch.stack([
                logits[:len(FRONT_VIEW_PROMPTS)].mean(),
                logits[len(FRONT_VIEW_PROMPTS):len(FRONT_VIEW_PROMPTS) + len(BACK_VIEW_PROMPTS)].mean(),
            ])
            probabilities = group_logits.softmax(dim=0).cpu().tolist()
        index = max(range(len(probabilities)), key=probabilities.__getitem__)
        return ["front", "back"][index], float(probabilities[index])

    def _detect(self, image: Image) -> list[Candidate]:
        inputs = self.grounding_processor(images=image, text=[PROMPTS], return_tensors="pt").to(self.device)
        with self.torch.no_grad():
            outputs = self.grounding_model(**inputs)
        result = self.grounding_processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=0.1,
            text_threshold=0.15,
            target_sizes=[image.size[::-1]],
        )[0]
        labels = result.get("text_labels", result.get("labels", []))
        candidates = []
        for score, label, box in zip(result["scores"], labels, result["boxes"]):
            category = self._category_for(str(label))
            if not category:
                continue
            candidate = Candidate(category, float(score.item()), [float(value) for value in box.tolist()])
            if self._valid_geometry(candidate, image.size):
                candidates.append(candidate)
        return self._deduplicate(candidates)

    @staticmethod
    def _category_for(label: str) -> Optional[str]:
        value = label.lower()
        if value.startswith("cpu "): return "cpu_cooler"
        if value.startswith("computer graphics") or value.startswith("video card"): return "gpu"
        if value.startswith("ram ") or value.startswith("memory"): return "memory"
        matches = []
        if "memory" in value or " ram" in f" {value}": matches.append("memory")
        if "graphics" in value or "video card" in value: matches.append("gpu")
        if "heatsink" in value: matches.append("cpu_cooler")
        if "motherboard" in value: matches.append("motherboard")
        if "power supply" in value: matches.append("power_supply")
        if "hard disk" in value or "solid state" in value: matches.append("storage")
        if "case" in value and "fan" in value: matches.append("case_fan")
        return matches[0] if len(set(matches)) == 1 else None

    @staticmethod
    def _valid_geometry(item: Candidate, size: tuple[int, int]) -> bool:
        width, height = size
        x1, y1, x2, y2 = item.box
        box_width, box_height = max(1, x2 - x1), max(1, y2 - y1)
        area = box_width * box_height / (width * height)
        ratio = box_width / box_height
        thresholds = {"gpu": .16, "memory": .2, "cpu_cooler": .2, "motherboard": .24,
                      "power_supply": .2, "storage": .24, "case_fan": .2}
        if item.score < thresholds[item.category]: return False
        if item.category == "memory": return area < .12 and (ratio < .75 or ratio > 2.5)
        if item.category == "gpu": return .003 < area < .3 and ratio > 1.25
        if item.category == "cpu_cooler": return .006 < area < .28 and .55 < ratio < 1.9
        if item.category == "motherboard": return .12 < area < .85
        if item.category == "power_supply": return .015 < area < .3
        if item.category == "storage": return .003 < area < .18
        if item.category == "case_fan": return .003 < area < .15 and .55 < ratio < 1.8
        return False

    @classmethod
    def _deduplicate(cls, candidates: list[Candidate]) -> list[Candidate]:
        result = []
        limits = {"memory": 2, "storage": 2, "case_fan": 3}
        for candidate in sorted(candidates, key=lambda item: item.score, reverse=True):
            same = [item for item in result if item.category == candidate.category]
            if len(same) >= limits.get(candidate.category, 1): continue
            if any(cls._iou(candidate.box, item.box) > .45 for item in same): continue
            result.append(candidate)
        return result[:8]

    @staticmethod
    def _iou(a: list[float], b: list[float]) -> float:
        x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection
        return intersection / union if union else 0

    def _segment(self, image: Image, boxes: list[list[float]]) -> list[list[tuple[float, float]]]:
        import cv2
        import numpy as np

        inputs = self.sam_processor(images=image, input_boxes=[boxes], return_tensors="pt")
        inputs["input_boxes"] = inputs["input_boxes"].float()
        inputs = inputs.to(self.device)
        with self.torch.no_grad():
            outputs = self.sam_model(**inputs, multimask_output=True)
        masks = self.sam_processor.image_processor.post_process_masks(
            outputs.pred_masks.cpu(), inputs["original_sizes"].cpu(), inputs["reshaped_input_sizes"].cpu()
        )[0]
        scores = outputs.iou_scores[0].cpu()
        outlines = []
        for index, box in enumerate(boxes):
            best = int(scores[index].argmax().item())
            mask = masks[index][best].numpy().astype("uint8") * 255
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                outlines.append(self._box_outline(box)); continue
            contour = max(contours, key=cv2.contourArea)
            epsilon = max(2.0, .008 * cv2.arcLength(contour, True))
            polygon = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
            if len(polygon) < 3:
                outlines.append(self._box_outline(box)); continue
            outlines.append([(float(point[0]), float(point[1])) for point in polygon[:32]])
        return outlines

    @staticmethod
    def _box_outline(box: list[float]) -> list[tuple[float, float]]:
        x1, y1, x2, y2 = box
        return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]

    def _unusable_result(self, image_id: str, view: str, score: float, started: float) -> AnalysisResult:
        message = {
            "back": "케이블 정리용 뒷면으로 보여 부품을 분석하지 않았습니다. 반대쪽 패널을 열어 촬영해주세요.",
            "exterior": "케이스 외부 또는 부품이 보이지 않는 사진입니다. 내부 부품 면을 촬영해주세요.",
            "unrelated": "PC 내부 사진인지 확인할 수 없습니다. 케이스 내부 전체를 다시 촬영해주세요.",
        }[view]
        return AnalysisResult.model_validate({
            "imageId": image_id,
            "imageQuality": {"usable": False, "issues": ["occluded"]},
            "detections": [],
            "warnings": [message, f"촬영 방향 분류 신뢰도 {score:.0%}", self._timing_warning(started)],
        })

    @staticmethod
    def _timing_warning(started: float) -> str:
        return f"로컬 모델 처리 시간 {time.perf_counter() - started:.1f}초"
