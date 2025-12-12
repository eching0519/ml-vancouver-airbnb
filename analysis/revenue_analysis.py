import numpy as np
from analysis.models import ModelTrainer


def run_revenue_analysis(trainer, X_train, y_train_rev, X_test, y_test_rev, test_df=None):
    print("\n[Revenue Analysis] Modeling & Drivers")
    
    # Point Estimate
    # Reverting log_transform to False as it degraded performance significantly (R2 ~0.14)
    rev_model = trainer.train_point_estimator(X_train, y_train_rev, "Revenue_Point", log_transform=False)
    rev_preds, _, _ = trainer.evaluate(rev_model, X_test, y_test_rev, "Revenue Model")
    
    # Interval Estimate (Train all quantiles)
    trainer.train_quantiles_range(X_train, y_train_rev, "Revenue")
    
    # Retrieve 5th and 95th for legacy support
    rev_low_model = trainer.models["Revenue_q5"]['model']
    rev_high_model = trainer.models["Revenue_q95"]['model']
    
    r_low_preds = rev_low_model.predict(X_test)
    r_high_preds = rev_high_model.predict(X_test)
    
    # Ensure logical ordering
    stacked_preds = np.vstack((r_low_preds, rev_preds, r_high_preds)).T
    sorted_preds = np.sort(stacked_preds, axis=1)
    
    r_low_preds = sorted_preds[:, 0]
    rev_preds = sorted_preds[:, 1]
    r_high_preds = sorted_preds[:, 2]
    
    # Coverage Calculation
    rev_cov = np.mean((y_test_rev >= r_low_preds) & (y_test_rev <= r_high_preds)) * 100
    print(f"Revenue Range Coverage: {rev_cov:.2f}%")
    
    return rev_preds, r_low_preds, r_high_preds, rev_model

