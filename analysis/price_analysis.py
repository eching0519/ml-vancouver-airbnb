import numpy as np

from analysis.models import ModelTrainer


def run_price_analysis(trainer, X_train, y_train_price, X_test, y_test_price, test_df):
    print("\n[Price Analysis] Modeling & Optimization")
    
    # Point Estimate
    price_model = trainer.train_point_estimator(X_train, y_train_price, "Price_Point", log_transform=True)
    price_preds, _, _ = trainer.evaluate(price_model, X_test, y_test_price, "Price Model")
    
    # Interval Estimate (Train all quantiles for detailed distribution)
    trainer.train_quantiles_range(X_train, y_train_price, "Price_Lower") # Naming convention: Price_Lower_q5 ...
    # Actually, let's use a cleaner prefix since it's the whole distribution
    trainer.train_quantiles_range(X_train, y_train_price, "Price")
    
    # Retrieve 5th and 95th for legacy support and coverage calc
    price_low_model = trainer.models["Price_q5"]['model']
    price_high_model = trainer.models["Price_q95"]['model']
    
    p_low_preds = price_low_model.predict(X_test)
    p_high_preds = price_high_model.predict(X_test)
    
    # Ensure logical ordering (Low <= Pred <= High)
    stacked_preds = np.vstack((p_low_preds, price_preds, p_high_preds)).T
    sorted_preds = np.sort(stacked_preds, axis=1)
    
    p_low_preds = sorted_preds[:, 0]
    price_preds = sorted_preds[:, 1]
    p_high_preds = sorted_preds[:, 2]
    
    # Coverage Calculation
    price_cov = np.mean((y_test_price >= p_low_preds) & (y_test_price <= p_high_preds)) * 100
    print(f"Price Range Coverage: {price_cov:.2f}%")
    
    return price_preds, p_low_preds, p_high_preds

