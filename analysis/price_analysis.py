import numpy as np
import pandas as pd
from models import ModelTrainer


def run_price_analysis(trainer, X_train, y_train_price, X_test, y_test_price, test_df):
    print("\n[Price Analysis] Modeling & Optimization")
    
    # 1. Point Estimate
    # Using log_transform=True for Price as it usually improves R2
    price_model = trainer.train_point_estimator(X_train, y_train_price, "Price_Point", log_transform=True)
    price_preds, price_r2, price_mae = trainer.evaluate(price_model, X_test, y_test_price, "Price Model")
    
    # 2. Interval Estimate
    # Quantiles trained on 0.05 and 0.95 to widen interval and improve coverage
    price_low = trainer.train_quantile_estimator(X_train, y_train_price, 0.05, "Price_Lower")
    price_high = trainer.train_quantile_estimator(X_train, y_train_price, 0.95, "Price_Upper")
    
    p_low_preds = price_low['model'].predict(X_test)
    p_high_preds = price_high['model'].predict(X_test)
    
    # FIX: Quantile Crossing (Ensure Low <= Pred <= High)
    # We stack them and sort row-wise to enforce logical ordering
    stacked_preds = np.vstack((p_low_preds, price_preds, p_high_preds)).T
    sorted_preds = np.sort(stacked_preds, axis=1)
    
    # Re-assign sorted values to ensure consistency
    p_low_preds = sorted_preds[:, 0]
    price_preds = sorted_preds[:, 1]
    p_high_preds = sorted_preds[:, 2]
    
    # 3. Coverage Calculation
    price_cov = np.mean((y_test_price >= p_low_preds) & (y_test_price <= p_high_preds)) * 100
    print(f"Price Range Coverage (5th-95th percentile): {price_cov:.2f}%")
    
    # 4. Optimization Insights
    print("\n--- Pricing Optimization Insights ---")
    test_df = test_df.copy()
    test_df['opt_price'] = price_preds
    test_df['price_diff_pct'] = ((price_preds - test_df['price']) / test_df['price']) * 100
    
    undervalued = test_df[(test_df['price_diff_pct'] > 20) & (test_df['number_of_reviews'] > 10)]
    print(f"Identified {len(undervalued)} potentially UNDERVALUED listings (Price could increase).")
    
    overvalued = test_df[(test_df['price_diff_pct'] < -20) & (test_df['number_of_reviews'] > 10)]
    print(f"Identified {len(overvalued)} potentially OVERVALUED listings (Consider lowering price).")
    
    # 5. Neighborhood Analysis
    print("\n--- Neighborhood Price Insights ---")
    if 'neighbourhood_cleansed' in test_df.columns:
        nbhd_stats = test_df.groupby('neighbourhood_cleansed')['price'].agg(['mean', 'count']).sort_values('mean', ascending=False)
        print("Top 5 Most Expensive Neighborhoods (Avg Price):")
        print(nbhd_stats.head(5).to_string())
    
    return price_preds, p_low_preds, p_high_preds

