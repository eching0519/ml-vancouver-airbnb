from collections import Counter
from itertools import combinations

import pandas as pd


def run_basket_analysis(full_df):
    """
    Performs comparative basket analysis: Top 10% vs The Rest.
    """
    print("\n[Amenity Basket Analysis] Comparative: Top 10% vs Rest")
    
    # Define Tiers
    threshold = full_df['estimated_revenue_l365d'].quantile(0.90)
    top_df = full_df[full_df['estimated_revenue_l365d'] >= threshold].copy()
    rest_df = full_df[full_df['estimated_revenue_l365d'] < threshold].copy()
    
    print(f"Top Tier (> ${threshold:,.0f}): {len(top_df)} listings")
    print(f"Base Tier (< ${threshold:,.0f}): {len(rest_df)} listings")
    
    # Identify Amenity Columns
    amenity_cols = [col for col in full_df.columns if col.startswith('has_') and col != 'has_availability']
    
    if not amenity_cols:
        print("No amenity columns found.")
        return

    # Helper: Get Support for a list of transactions
    def get_support_map(df, amenity_columns):
        count_map = {}
        total = len(df)
        for col in amenity_columns:
            count = df[col].sum()
            clean_name = col.replace('has_', '').replace('_', ' ').title()
            count_map[clean_name] = count / total
        return count_map

    top_support = get_support_map(top_df, amenity_cols)
    rest_support = get_support_map(rest_df, amenity_cols)
    
    # 2. Calculate Differentiators (Gap Analysis)
    diffs = []
    for amenity, top_sup in top_support.items():
        rest_sup = rest_support.get(amenity, 0)
        gap = top_sup - rest_sup
        # Relative Lift = Top / Rest (Handle div/0)
        lift = top_sup / rest_sup if rest_sup > 0.01 else 0
        
        diffs.append({
            'Amenity': amenity,
            'Top_Support': top_sup,
            'Rest_Support': rest_sup,
            'Gap': gap,
            'Rel_Lift': lift
        })
        
    diff_df = pd.DataFrame(diffs)
    
    # Print Top Differentiators
    print("\n[Top Differentiators by Lift]")
    print(f"{'Amenity':<30} | {'Top% (Support)':<16} | {'Rest%':<8} | {'Lift (x)':<6}")
    print("-" * 70)
    
    # Filter for meaningful presence (>10% in top)
    meaningful_diffs = diff_df[diff_df['Top_Support'] > 0.10].sort_values('Rel_Lift', ascending=False)
    
    for _, row in meaningful_diffs.head(15).iterrows():
        print(f"{row['Amenity']:<30} | {row['Top_Support']:<16.1%} | {row['Rest_Support']:<8.1%} | {row['Rel_Lift']:<6.2f}")

    return
