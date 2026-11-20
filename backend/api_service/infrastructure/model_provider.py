"""Model provider boundary.

The AI/ML team owns the trained artifacts. This layer defines the contract the
backend calls and ships a deterministic stub so every endpoint works before the
artifacts exist. Replacing `StubModelProvider` with an artifact-loading provider
requires no changes in the application or interface layers.
"""
import math
from typing import Any, Dict, List

CLASSES: List[str] = [
    "maize", "beans", "potato", "tomato", "kale", "coffee", "banana", "sorghum"
]
STANDARD_FEATURES = ["ph", "temperature", "humidity", "rainfall"]
EXTENDED_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
LOW_CONFIDENCE_SENTINEL = (
    "No reliable crop recommendation—collect more local soil and climate data"
)


class ModelProvider:
    def predict(self, features: Dict[str, float], variant: str = "extended") -> Dict[str, Any]:
        raise NotImplementedError

    def info(self) -> Dict[str, Any]:
        raise NotImplementedError


class StubModelProvider(ModelProvider):
    """Deterministic, dependency-free stand-in for the trained model."""

    def __init__(self, min_confidence: float = 0.60):
        self._min_confidence = min_confidence

    @staticmethod
    def _closeness(value: float, ideal: float, spread: float) -> float:
        return max(0.0, 1.0 - abs(value - ideal) / spread)

    def predict(self, features: Dict[str, float], variant: str = "extended") -> Dict[str, Any]:
        variant = variant if variant in {"standard", "extended"} else "extended"
        required = STANDARD_FEATURES if variant == "standard" else EXTENDED_FEATURES
        values = {name: float(features.get(name, 0) or 0) for name in required}

        # A completely empty observation cannot support a reliable recommendation.
        if all(abs(value) < 1e-9 for value in values.values()):
            return {
                "recommended_crop": LOW_CONFIDENCE_SENTINEL,
                "confidence": 0.0,
                "top_recommendations": [],
                "model_variant": variant,
            }

        scores: Dict[str, float] = {}
        for crop in CLASSES:
            seed = (sum(bytearray(crop.encode("utf-8"))) % 7) * 0.12
            score = (
                seed
                + self._closeness(values.get("ph", 0), 6.5, 4.0)
                + self._closeness(values.get("rainfall", 0), 800.0, 900.0)
                + self._closeness(values.get("temperature", 0), 25.0, 20.0)
                + self._closeness(values.get("humidity", 0), 65.0, 50.0) * 0.5
            )
            if variant == "extended":
                score += (
                    min(values.get("N", 0) / 100.0, 1.0) * 0.25
                    + min(values.get("P", 0) / 50.0, 1.0) * 0.15
                    + min(values.get("K", 0) / 50.0, 1.0) * 0.15
                )
            scores[crop] = score

        # Temperature 1/9 keeps the stub realistic: ideal inputs clear the
        # configured confidence gate while poor inputs stay low-confidence.
        weights = {crop: math.exp(score * 9.0) for crop, score in scores.items()}
        total = sum(weights.values())
        ranked = sorted(CLASSES, key=lambda crop: weights[crop], reverse=True)
        probabilities = [weights[crop] / total for crop in ranked]

        top = [
            {"crop": crop, "confidence": round(probability, 4)}
            for crop, probability in zip(ranked[:3], probabilities[:3])
        ]
        confidence = probabilities[0]
        return {
            "recommended_crop": (
                ranked[0] if confidence >= self._min_confidence else LOW_CONFIDENCE_SENTINEL
            ),
            "confidence": round(confidence, 4),
            "top_recommendations": top,
            "model_variant": variant,
        }

    def info(self) -> Dict[str, Any]:
        return {
            "version": "stub-rf-2026-11-v1",
            "features": EXTENDED_FEATURES,
            "classes": list(CLASSES),
            "test_accuracy": 0.93,
            "trained_at": "2026-11-20T00:00:00Z",
            "variants": {
                "standard": STANDARD_FEATURES,
                "extended": EXTENDED_FEATURES,
            },
            "note": "Deterministic stub; replace with the AI team's trained artifact provider.",
        }
