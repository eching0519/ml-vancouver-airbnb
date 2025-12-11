import json
import os

import onnxmltools
from onnx import save_model
from skl2onnx.common.data_types import FloatTensorType

from analysis.basket_analysis import run_basket_analysis
from analysis.data import prepare_data_pipeline
from analysis.models import ModelTrainer
from analysis.price_analysis import run_price_analysis
from analysis.revenue_analysis import run_revenue_analysis


def run_analysis():
    print("Starting Vancouver Airbnb Analysis...")
    
    # Data Preparation
    print("Running Data Pipeline...")
    X_train, X_test, y_train_price, y_test_price, y_train_rev, y_test_rev, test_df, features, full_df, metadata = prepare_data_pipeline()
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
    
    # Get feature names from training data
    feature_names = list(X_train.columns)
    
    # Update metadata with feature names
    metadata['feature_names'] = feature_names
    
    # Save metadata
    with open(os.path.join(model_dir, 'models_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to '{model_dir}/models_metadata.json'.")
        
    for name, model_info in trainer.models.items():
        # Export ONNX (JavaScript format)
        try:
            model = model_info['model']
            
            # Convert LightGBM model to ONNX
            # Create a dummy input for initial type inference
            initial_type = [('float_input', FloatTensorType([None, len(feature_names)]))]
            
            onnx_model = onnxmltools.convert_lightgbm(
                model.booster_,
                initial_types=initial_type,
                target_opset=12  # Use opset 12 for better compatibility
            )
            
            onnx_filename = os.path.join(model_dir, f"{name}.onnx")
            save_model(onnx_model, onnx_filename)
            print(f"Saved ONNX model: {onnx_filename}")
        except Exception as e:
            print(f"Warning: Could not convert {name} to ONNX: {e}")
            print(f"  This model will only be available as joblib format.")
        
    print(f"Models exported to '{model_dir}/'.")

if __name__ == "__main__":
    run_analysis()
