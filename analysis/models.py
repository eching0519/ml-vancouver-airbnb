import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score


class ModelTrainer:
    def __init__(self):
        self.models = {}
        
    def train_point_estimator(self, X_train, y_train, name="model", log_transform=False):
        """Trains a standard LightGBM Regressor"""
        print(f"Training {name} (Point Estimate)...")
        
        target = np.log1p(y_train) if log_transform else y_train
        
        model = lgb.LGBMRegressor(
            random_state=42, 
            verbose=-1, 
            n_estimators=2000,
            learning_rate=0.01,
            num_leaves=64,
            max_depth=10,
            colsample_bytree=0.8,
            subsample=0.8
        )
        model.fit(X_train, target)
        self.models[name] = {'model': model, 'log_transform': log_transform}
        
        # Feature Importance
        if hasattr(model, 'feature_importances_'):
            importances = pd.DataFrame({
                'Feature': X_train.columns,
                'Importance': model.feature_importances_
            }).sort_values('Importance', ascending=False).head(10)
            print(f"Top 10 Features for {name}:")
            print(importances.to_string(index=False))
            
        return self.models[name]
        
    def train_quantile_estimator(self, X_train, y_train, alpha, name="quantile_model"):
        """Trains a LightGBM Quantile Regressor"""
        q_suffix = f"_q{int(alpha*100)}"
        # Append suffix if not present to ensure uniqueness in trainer.models keys
        full_name = name if name.endswith(q_suffix) else f"{name}{q_suffix}"
        
        print(f"Training {full_name} (Quantile: {alpha})...")
        model = lgb.LGBMRegressor(
            objective='quantile',
            alpha=alpha,
            random_state=42,
            verbose=-1,
            n_estimators=1000,
            learning_rate=0.05,
            num_leaves=20,
            min_child_samples=50,
            reg_alpha=1.0,
            colsample_bytree=0.8
        )
        model.fit(X_train, y_train)
        self.models[full_name] = {'model': model, 'log_transform': False}
        return {'model': model, 'log_transform': False}

    def train_quantiles_range(self, X_train, y_train, name_prefix="quantile_model"):
        """Trains LightGBM Quantile Regressors for every 5% percentile"""
        quantiles = np.arange(0.05, 1.0, 0.05)
        results = {}
        for q in quantiles:
            # Avoid re-training if exact same call
            q = float(f"{q:.2f}") # Avoid floating point precision issues
            self.train_quantile_estimator(X_train, y_train, q, name_prefix)
        return self.models

    def evaluate(self, model_wrapper, X_test, y_test, metric_prefix="Model"):
        model = model_wrapper['model']
        log_transform = model_wrapper['log_transform']
        
        preds = model.predict(X_test)
        
        if log_transform:
            preds = np.expm1(preds)
            
        r2 = r2_score(y_test, preds)
        mae = mean_absolute_error(y_test, preds)
        print(f"{metric_prefix} Performance: R² = {r2:.4f}, MAE = ${mae:.2f}")
        return preds, r2, mae

