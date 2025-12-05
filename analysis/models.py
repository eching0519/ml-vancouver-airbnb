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
        
        # Hyperparameter Tuning for Higher Accuracy (More aggressive)
        model = lgb.LGBMRegressor(
            random_state=42, 
            verbose=-1, 
            n_estimators=2000,      # Increased from 1000
            learning_rate=0.01,     # Slower learning for better convergence
            num_leaves=64,          # Increased complexity (default 31)
            max_depth=10,           # Limit depth to prevent overfitting
            colsample_bytree=0.8,   # Feature subsampling
            subsample=0.8           # Row subsampling
        )
        model.fit(X_train, target)
        self.models[name] = {'model': model, 'log_transform': log_transform}
        
        # Feature Importance
        if hasattr(model, 'feature_importances_'):
            importances = pd.DataFrame({
                'Feature': X_train.columns,
                'Importance': model.feature_importances_
            }).sort_values('Importance', ascending=False).head(10) # Show top 10 now
            print(f"Top 10 Features for {name}:")
            print(importances.to_string(index=False))
            
        return self.models[name]
        
    def train_quantile_estimator(self, X_train, y_train, alpha, name="quantile_model"):
        """Trains a LightGBM Quantile Regressor"""
        # Quantile regression works better on original scale usually, or needs careful transformation
        print(f"Training {name} (Quantile: {alpha})...")
        model = lgb.LGBMRegressor(
            objective='quantile',
            alpha=alpha,
            random_state=42,
            verbose=-1,
            n_estimators=1000,      # Increased for better convergence
            learning_rate=0.05,     # Slow down slightly
            num_leaves=20,          # Simpler trees for robustness (Wider intervals)
            min_child_samples=50,   # More samples per leaf to smooth quantiles
            reg_alpha=1.0,          # L1 Regularization
            colsample_bytree=0.8
        )
        model.fit(X_train, y_train)
        self.models[f"{name}_q{int(alpha*100)}"] = {'model': model, 'log_transform': False}
        return {'model': model, 'log_transform': False}

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

