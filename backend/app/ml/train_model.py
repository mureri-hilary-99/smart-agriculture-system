from pathlib import Path
import json

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = BASE_DIR / "data" / "Crop_recommendation.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_FILE = MODEL_DIR / "crop_random_forest.joblib"
METRICS_FILE = MODEL_DIR / "model_metrics.json"

FEATURES = [
    "N",
    "P",
    "K",
    "temperature",
    "humidity",
    "ph",
    "rainfall",
]


def main():
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}\n"
            "Download Crop_recommendation.csv from Kaggle and place it in backend\\data\\"
        )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(DATA_FILE)

    required_columns = FEATURES + ["label"]
    missing_columns = [column for column in required_columns if column not in df.columns]

    if missing_columns:
        raise ValueError(
            f"Dataset is missing columns: {missing_columns}\n"
            f"Found columns: {df.columns.tolist()}"
        )

    df = df.dropna(subset=required_columns)

    X = df[FEATURES]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced"
    )

    print("Training Random Forest model...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)

    artifact = {
        "model": model,
        "features": FEATURES,
        "classes": model.classes_.tolist()
    }

    joblib.dump(artifact, MODEL_FILE)

    metrics = {
        "dataset_rows": int(len(df)),
        "crop_classes": int(y.nunique()),
        "test_accuracy": round(float(accuracy), 4),
        "features": FEATURES,
        "classification_report": classification_report(
            y_test,
            predictions,
            output_dict=True
        )
    }

    with open(METRICS_FILE, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    print(f"Dataset rows: {len(df)}")
    print(f"Crop classes: {y.nunique()}")
    print(f"Test accuracy: {accuracy:.2%}")
    print(f"Saved model: {MODEL_FILE}")
    print(f"Saved metrics: {METRICS_FILE}")


if __name__ == "__main__":
    main()