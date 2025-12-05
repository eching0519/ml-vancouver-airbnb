import lightgbm as lgb
import numpy as np
from sklearn.metrics import mean_absolute_error, r2_score


class ModelTrainer:
    def __init__(self):
        self.models = {}
        
    def train_point_estimator(self, X_train, y_train, name="model"):
        """Trains a standard LightGBM Regressor"""
        print(f"Training {name} (Point Estimate)...")
        model = lgb.LGBMRegressor(
            random_state=42, 
            verbose=-1, 
            n_estimators=500
        )
        model.fit(X_train, y_train)
        self.models[name] = model
        return model
        
    def train_quantile_estimator(self, X_train, y_train, alpha, name="quantile_model"):
        """Trains a LightGBM Quantile Regressor"""
        print(f"Training {name} (Quantile: {alpha})...")
        model = lgb.LGBMRegressor(
            objective='quantile',
            alpha=alpha,
            random_state=42,
            verbose=-1,
            n_estimators=500
        )
        model.fit(X_train, y_train)
        self.models[f"{name}_q{int(alpha*100)}"] = model
        return model

    def evaluate(self, model, X_test, y_test, metric_prefix="Model"):
        preds = model.predict(X_test)
        r2 = r2_score(y_test, preds)
        mae = mean_absolute_error(y_test, preds)
        print(f"{metric_prefix} Performance: R² = {r2:.4f}, MAE = ${mae:.2f}")
        return preds, r2, mae

