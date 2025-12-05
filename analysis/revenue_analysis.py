import numpy as np
import pandas as pd
from models import ModelTrainer

from data import basic_cleaning, load_data_raw


def run_revenue_analysis(trainer, X_train, y_train_rev, X_test, y_test_rev):
    print("\n[Revenue Analysis] Modeling & Drivers")
    
    # 1. Point Estimate
    rev_model = trainer.train_point_estimator(X_train, y_train_rev, "Revenue_Point")
    rev_preds, rev_r2, rev_mae = trainer.evaluate(rev_model, X_test, y_test_rev, "Revenue Model")
    
    # 2. Interval Estimate
    rev_low = trainer.train_quantile_estimator(X_train, y_train_rev, 0.1, "Revenue_Lower")
    rev_high = trainer.train_quantile_estimator(X_train, y_train_rev, 0.9, "Revenue_Upper")
    
    r_low_preds = rev_low.predict(X_test)
    r_high_preds = rev_high.predict(X_test)
    
    # 3. Coverage Calculation
    rev_cov = np.mean((y_test_rev >= r_low_preds) & (y_test_rev <= r_high_preds)) * 100
    print(f"Revenue Range Coverage (10th-90th percentile): {rev_cov:.2f}%")
    
    # 4. Amenities Drivers Analysis
    print("\n--- Revenue Drivers Analysis (Amenities) ---")
    raw_df = load_data_raw()
    clean_df = basic_cleaning(raw_df)
    
    amenity_cols = [c for c in clean_df.columns if c.startswith('has_')]
    impacts = []
    for col in amenity_cols:
        name = col.replace('has_', '').replace('_', ' ').title()
        val_with = clean_df[clean_df[col] == 1]['estimated_revenue_l365d'].mean()
        val_without = clean_df[clean_df[col] == 0]['estimated_revenue_l365d'].mean()
        impacts.append({'Amenity': name, 'Premium': val_with - val_without})
    
    impact_df = pd.DataFrame(impacts).sort_values('Premium', ascending=False).head(5)
    print("Top 5 Value-Adding Amenities:")
    print(impact_df.to_string(index=False))
    
    return rev_preds, r_low_preds, r_high_preds, rev_model

