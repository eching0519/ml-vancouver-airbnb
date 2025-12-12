import json
import os

import onnxmltools
from onnx import save_model
from onnx.compose import merge_models, add_prefix
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
        
    # Group models by target (Price vs Revenue)
    groups = {'Price': [], 'Revenue': []}
    for name in trainer.models.keys():
        if name.startswith('Price'):
            groups['Price'].append(name)
        elif name.startswith('Revenue'):
            groups['Revenue'].append(name)

    for group_name, model_names in groups.items():
        print(f"Merging models for {group_name}...")
        combined_model = None
        
        # Sort: Point first, then quantiles numerically
        def sort_key(n):
            if 'Point' in n: return -1.0
            if '_q' in n: return float(n.split('_q')[1])
            return 0.0
            
        model_names.sort(key=sort_key)
        
        for name in model_names:
            model_info = trainer.models[name]
            model = model_info['model']
            
            try:
                # Convert LightGBM model to ONNX
                initial_type = [('float_input', FloatTensorType([None, len(feature_names)]))]
                
                onnx_model = onnxmltools.convert_lightgbm(
                    model.booster_,
                    initial_types=initial_type,
                    target_opset=12
                )
                
                # Rename the output to match the model name (e.g., Price_Point, Price_q5)
                # LightGBM converter output is usually 'variable'
                old_output = onnx_model.graph.output[0]
                old_output_name = old_output.name
                
                # Update all nodes referencing this output
                for node in onnx_model.graph.node:
                    for i, output in enumerate(node.output):
                        if output == old_output_name:
                            node.output[i] = name
                
                # Update the graph output definition
                old_output.name = name
                
                if combined_model is None:
                    combined_model = onnx_model
                else:
                    # Merge Strategy for Shared Input:
                    # 1. Prefix the new model to avoid collision.
                    # 2. Merge disjointly.
                    # 3. Rewire the prefixed input to the main 'float_input'.
                    
                    # 1. Prefix
                    # add_prefix will rename inputs too, e.g. 'float_input' -> 'Price_q5_float_input'
                    prefixed_model = add_prefix(onnx_model, prefix=f"{name}_")
                    
                    # 2. Merge
                    combined_model = merge_models(
                        combined_model,
                        prefixed_model,
                        io_map=[] 
                    )
                    
                    # 3. Rewire Input
                    # The combined model now has 'float_input' (from first model) AND 'Price_q5_float_input' (from second).
                    # We want to delete 'Price_q5_float_input' and point its consumers to 'float_input'.
                    
                    redundant_input_name = f"{name}_float_input"
                    
                    # Find nodes using the redundant input
                    for node in combined_model.graph.node:
                        for i, input_name in enumerate(node.input):
                            if input_name == redundant_input_name:
                                node.input[i] = 'float_input'
                                
                    # Remove the redundant input from graph inputs
                    # Filter out the input that matches redundant_input_name
                    new_inputs = [inp for inp in combined_model.graph.input if inp.name != redundant_input_name]
                    
                    # Clear and re-add inputs
                    del combined_model.graph.input[:]
                    combined_model.graph.input.extend(new_inputs)
                    
            except Exception as e:
                print(f"Error converting/merging {name}: {e}")
                # Important: If one quantile fails, we continue, but the combined model might be partial.

        if combined_model:
            onnx_filename = os.path.join(model_dir, f"{group_name}_Model.onnx")
            save_model(combined_model, onnx_filename)
            print(f"Saved Combined ONNX model: {onnx_filename}")
    
    print(f"Models exported to '{model_dir}/'.")

if __name__ == "__main__":
    run_analysis()
