import numpy as np
import pandas as pd


def run_strategy_simulations(rev_model, X_test):
    print("\n[Strategy Analysis] Business Simulations")
    
    # Superhost Simulation
    if 'is_superhost' in X_test.columns:
        # Find non-superhosts in test set
        non_sh_idx = X_test[X_test['is_superhost'] == 0].index
        
        if len(non_sh_idx) > 0:
            print(f"Simulating Superhost impact for {len(non_sh_idx)} listings...")
            
            X_sim = X_test.loc[non_sh_idx].copy()
            curr_rev = rev_model.predict(X_sim)
            
            # Simulate becoming Superhost
            X_sim['is_superhost'] = 1
            new_rev = rev_model.predict(X_sim)
            
            lift = new_rev - curr_rev
            avg_lift = np.mean(lift)
            
            print(f"Average Annual Revenue Lift from becoming Superhost: ${avg_lift:.2f}")
            
            # Identify top opportunities
            results = pd.DataFrame({
                'Current_Rev': curr_rev,
                'Potential_Rev': new_rev,
                'Lift': lift
            }, index=non_sh_idx)
            
            print("Top 3 Listings with Highest Potential Gain:")
            print(results.sort_values('Lift', ascending=False).head(3).to_string())
            
    else:
        print("Warning: 'is_superhost' feature not found. Skipping simulation.")

