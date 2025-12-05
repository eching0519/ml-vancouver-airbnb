import numpy as np
import pandas as pd
from models import ModelTrainer


def run_price_analysis(trainer, X_train, y_train_price, X_test, y_test_price, test_df):
    print("\n[Price Analysis] Modeling & Optimization")
    
    # 1. Point Estimate
    price_model = trainer.train_point_estimator(X_train, y_train_price, "Price_Point")
    price_preds, price_r2, price_mae = trainer.evaluate(price_model, X_test, y_test_price, "Price Model")
    
    # 2. Interval Estimate
    price_low = trainer.train_quantile_estimator(X_train, y_train_price, 0.1, "Price_Lower")
    price_high = trainer.train_quantile_estimator(X_train, y_train_price, 0.9, "Price_Upper")
    
    p_low_preds = price_low.predict(X_test)
    p_high_preds = price_high.predict(X_test)
    
    # 3. Coverage Calculation
    price_cov = np.mean((y_test_price >= p_low_preds) & (y_test_price <= p_high_preds)) * 100
    print(f"Price Range Coverage (10th-90th percentile): {price_cov:.2f}%")
    
    # 4. Optimization Insights
    print("\n--- Pricing Optimization Insights ---")
    test_df = test_df.copy()
    test_df['opt_price'] = price_preds
    test_df['price_diff_pct'] = ((price_preds - test_df['price']) / test_df['price']) * 100
    
    undervalued = test_df[(test_df['price_diff_pct'] > 20) & (test_df['number_of_reviews'] > 10)]
    print(f"Identified {len(undervalued)} potentially UNDERVALUED listings (Price could increase).")
    
    overvalued = test_df[(test_df['price_diff_pct'] < -20) & (test_df['number_of_reviews'] > 10)]
    print(f"Identified {len(overvalued)} potentially OVERVALUED listings (Consider lowering price).")
    
    return price_preds, p_low_preds, p_high_preds

