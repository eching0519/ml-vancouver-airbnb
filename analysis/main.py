import pandas as pd
from models import ModelTrainer
from price_analysis import run_price_analysis
from revenue_analysis import run_revenue_analysis
from strategy_analysis import run_strategy_simulations

from data import prepare_data_pipeline


def run_full_analysis():
    print("==================================================")
    print("       VANCOUVER AIRBNB ANALYTICS SUITE           ")
    print("==================================================")
    
    # 1. Data Preparation
    print("\n[Phase 1] Data Pipeline Execution")
    X_train, X_test, y_train_price, y_test_price, y_train_rev, y_test_rev, test_df, features = prepare_data_pipeline()
    print(f"Data Loaded. Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    trainer = ModelTrainer()
    
    # 2. Price Analysis
    price_preds, p_low, p_high = run_price_analysis(
        trainer, X_train, y_train_price, X_test, y_test_price, test_df
    )
    
    # 3. Revenue Analysis
    rev_preds, r_low, r_high, rev_model = run_revenue_analysis(
        trainer, X_train, y_train_rev, X_test, y_test_rev
    )
    
    # 4. Strategy Analysis
    run_strategy_simulations(rev_model, X_test)
    
    # 5. Save Final Consolidated Results
    print("\n[Phase 5] Exporting Results")
    results = pd.DataFrame({
        'id': test_df['id'],
        'Actual_Price': y_test_price,
        'Pred_Price': price_preds,
        'Range_Low_Price': p_low,
        'Range_High_Price': p_high,
        'Actual_Rev': y_test_rev,
        'Pred_Rev': rev_preds,
        'Range_Low_Rev': r_low,
        'Range_High_Rev': r_high
    })
    
    output_file = 'final_analysis_results.csv'
    results.to_csv(output_file, index=False)
    print(f"Detailed predictions saved to '{output_file}'.")

if __name__ == "__main__":
    run_full_analysis()
