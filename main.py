import os

import joblib

from analysis.basket_analysis import run_basket_analysis
from analysis.data import prepare_data_pipeline
from analysis.models import ModelTrainer
from analysis.price_analysis import run_price_analysis
from analysis.revenue_analysis import run_revenue_analysis


def run_analysis():
    print("Starting Vancouver Airbnb Analysis...")
    
    # Data Preparation
    print("Running Data Pipeline...")
    X_train, X_test, y_train_price, y_test_price, y_train_rev, y_test_rev, test_df, features, full_df = prepare_data_pipeline()
    print(f"Data Loaded. Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Amenity Basket Analysis
    run_basket_analysis(full_df)
    
    trainer = ModelTrainer()
    
    # Price Analysis
    run_price_analysis(
        trainer, X_train, y_train_price, X_test, y_test_price, test_df
    )
    
    # Revenue Analysis
    run_revenue_analysis(
        trainer, X_train, y_train_rev, X_test, y_test_rev, test_df
    )
    
    # Export Models
    print("Exporting Models...")
    model_dir = 'outputs'
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)
        
    for name, model_info in trainer.models.items():
        filename = os.path.join(model_dir, f"{name}.joblib")
        joblib.dump(model_info, filename)
        print(f"Saved model: {filename}")
        
    print(f"Models exported to '{model_dir}/'.")

if __name__ == "__main__":
    run_analysis()

