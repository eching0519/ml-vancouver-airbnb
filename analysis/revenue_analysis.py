import numpy as np
import pandas as pd
from models import ModelTrainer

from data import basic_cleaning, load_data_raw


def run_revenue_analysis(trainer, X_train, y_train_rev, X_test, y_test_rev, test_df=None):
    print("\n[Revenue Analysis] Modeling & Drivers")
    
    # 1. Point Estimate
    # Reverting log_transform to False as it degraded performance significantly (R2 ~0.14)
    rev_model = trainer.train_point_estimator(X_train, y_train_rev, "Revenue_Point", log_transform=False)
    rev_preds, rev_r2, rev_mae = trainer.evaluate(rev_model, X_test, y_test_rev, "Revenue Model")
    
    # 2. Interval Estimate
    rev_low = trainer.train_quantile_estimator(X_train, y_train_rev, 0.05, "Revenue_Lower")
    rev_high = trainer.train_quantile_estimator(X_train, y_train_rev, 0.95, "Revenue_Upper")
    
    r_low_preds = rev_low['model'].predict(X_test)
    r_high_preds = rev_high['model'].predict(X_test)
    
    # FIX: Quantile Crossing (Ensure Low <= Pred <= High)
    stacked_preds = np.vstack((r_low_preds, rev_preds, r_high_preds)).T
    sorted_preds = np.sort(stacked_preds, axis=1)
    
    r_low_preds = sorted_preds[:, 0]
    rev_preds = sorted_preds[:, 1]
    r_high_preds = sorted_preds[:, 2]
    
    # 3. Coverage Calculation
    rev_cov = np.mean((y_test_rev >= r_low_preds) & (y_test_rev <= r_high_preds)) * 100
    print(f"Revenue Range Coverage (5th-95th percentile): {rev_cov:.2f}%")
    
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
    
    # 5. Quality/Review Impact Analysis
    if test_df is not None and 'review_scores_rating' in test_df.columns:
        print("\n--- Revenue Drivers Analysis (Quality) ---")
        # Simple analysis: High vs Low Rating
        high_rated = test_df[test_df['review_scores_rating'] >= 4.8]['estimated_revenue_l365d'].mean()
        mid_rated = test_df[(test_df['review_scores_rating'] >= 4.5) & (test_df['review_scores_rating'] < 4.8)]['estimated_revenue_l365d'].mean()
        low_rated = test_df[test_df['review_scores_rating'] < 4.5]['estimated_revenue_l365d'].mean()
        
        print(f"Avg Revenue (Rating >= 4.8): ${high_rated:.2f}")
        print(f"Avg Revenue (4.5 <= Rating < 4.8): ${mid_rated:.2f}")
        print(f"Avg Revenue (Rating < 4.5): ${low_rated:.2f}")
        
        # Correlation
        corr = test_df['review_scores_rating'].corr(test_df['estimated_revenue_l365d'])
        print(f"Correlation between Rating and Revenue: {corr:.2f}")

    return rev_preds, r_low_preds, r_high_preds, rev_model

