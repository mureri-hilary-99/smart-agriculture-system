from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_FILE = BASE_DIR / "models" / "crop_random_forest.joblib"


class CropRecommendationService:
    def __init__(self):
        self.artifact = None
        self.model = None
        self.features = None
        self.load_model()

    def load_model(self):
        if not MODEL_FILE.exists():
            raise FileNotFoundError(
                f"Trained model not found: {MODEL_FILE}. "
                "Run: python app\\ml\\train_model.py"
            )

        self.artifact = joblib.load(MODEL_FILE)
        self.model = self.artifact["model"]
        self.features = self.artifact["features"]

    def predict(self, values: dict) -> dict:
        input_frame = pd.DataFrame(
            [[values[feature] for feature in self.features]],
            columns=self.features
        )

        predicted_crop = self.model.predict(input_frame)[0]
        probabilities = self.model.predict_proba(input_frame)[0]
        confidence = float(probabilities.max())

        top_indices = probabilities.argsort()[-3:][::-1]

        alternatives = [
            {
                "crop": str(self.model.classes_[index]),
                "confidence": round(float(probabilities[index]), 4)
            }
            for index in top_indices
        ]

        return {
            "recommended_crop": str(predicted_crop),
            "confidence": round(confidence, 4),
            "top_recommendations": alternatives
        }


crop_service = CropRecommendationService()