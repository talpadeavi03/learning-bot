"""
model_classes.py — Shared model definitions and lightweight standalone estimators
Used by training, prediction, explainability, and serving layers.
"""

FLOW_LABELS = {2: 'FLOW', 1: 'PRE_FLOW', 0: 'NOMINAL', -1: 'ANXIETY', -2: 'RECOVERY'}

class StandaloneFlowClassifier:
    def __init__(self, name="AETHER Decision Engine"):
        self.name = name
        self.classes_ = [2, 1, 0, -1, -2]
        self.feature_importances_ = [0.35, 0.25, 0.20, 0.05, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.0, 0.0]

    def predict(self, X):
        preds = []
        for row in X:
            e, s, f = float(row[0]), float(row[1]), float(row[2])
            if e > 0.75 and s < 0.25 and f > 0.65: preds.append(2)
            elif e > 0.60 and s < 0.35: preds.append(1)
            elif s > 0.65: preds.append(-1)
            elif e < 0.30: preds.append(-2)
            else: preds.append(0)
        return preds

    def predict_proba(self, X):
        probas = []
        for row in X:
            pred = self.predict([row])[0]
            dist = [0.08, 0.08, 0.08, 0.08, 0.08]
            idx_map = {2: 0, 1: 1, 0: 2, -1: 3, -2: 4}
            dist[idx_map.get(pred, 2)] = 0.68
            probas.append(dist)
        return probas

class StandaloneEnergyRegressor:
    def predict(self, X):
        return [round(float(row[0]) * 0.95 + 0.02, 3) for row in X]
