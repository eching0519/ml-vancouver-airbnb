import json
import os

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


def load_data_raw():
    """
    Loads raw data from the data directory.
    """
    # Assuming the script is run from project root or analysis/ folder
    # Adjust path to find data relative to this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Look for data in ../data/ relative to analysis/
    data_path = os.path.join(current_dir, '..', 'data', 'listings-detail.csv')
    
    if not os.path.exists(data_path):
        # Fallback if running from root
        data_path = 'data/listings-detail.csv'
        
    print(f"Loading data from: {data_path}")
    df = pd.read_csv(data_path)
    return df

def basic_cleaning(df):
    """
    Performs initial cleaning: boolean conversion, price parsing, and IQR outlier removal.
    """
    # 1. Boolean Conversion
    boolean_columns = [
        'host_is_superhost', 'host_identity_verified',
        'has_availability', 'instant_bookable'
    ]
    for col in boolean_columns:
        if col in df.columns:
            df[col] = df[col].map({'t': True, 'f': False})
            
    # 2. Price Cleaning
    if 'price' in df.columns:
        df['price'] = df['price'].astype(str).str.replace('$', '').str.replace(',', '')
        df['price'] = pd.to_numeric(df['price'], errors='coerce')
        
    # 3. Filter Missing Targets
    df = df.dropna(subset=['price', 'estimated_revenue_l365d'])
    
    # 4. IQR Outlier Filtering
    # Price
    Q1_price = df['price'].quantile(0.25)
    Q3_price = df['price'].quantile(0.75)
    IQR_price = Q3_price - Q1_price
    lower_price = Q1_price - 1.5 * IQR_price
    upper_price = Q3_price + 1.5 * IQR_price
    
    # Revenue
    Q1_rev = df['estimated_revenue_l365d'].quantile(0.25)
    Q3_rev = df['estimated_revenue_l365d'].quantile(0.75)
    IQR_rev = Q3_rev - Q1_rev
    lower_rev = Q1_rev - 1.5 * IQR_rev
    upper_rev = Q3_rev + 1.5 * IQR_rev
    
    initial_len = len(df)
    df = df[
        (df['price'] >= lower_price) & (df['price'] <= upper_price) &
        (df['estimated_revenue_l365d'] >= lower_rev) & (df['estimated_revenue_l365d'] <= upper_rev)
    ]
    print(f"Data Cleaning: Removed {initial_len - len(df)} outliers based on IQR rules.")
    
    # 5. Amenities Parsing
    def parse_amenities(amenities_str):
        if pd.isna(amenities_str) or amenities_str == '':
            return []
        try:
            amenities_str = amenities_str.replace('""', '"')
            return json.loads(amenities_str)
        except:
            return []

    df['amenities_list'] = df['amenities'].apply(parse_amenities)
    
    top_amenities = [
        'Wifi', 'Kitchen', 'Heating', 'Washer', 'Dryer', 'Air conditioning',
        'Free parking on premises', 'Free street parking', 'Paid parking off premises',
        'Hot tub', 'Pool', 'Gym', 'Pet-friendly', 'Business travel ready',
        'Self check-in', 'Lockbox', 'Elevator', 'Balcony', 'Garden', 'BBQ grill'
    ]
    
    for amenity in top_amenities:
        col_name = f'has_{amenity.lower().replace(" ", "_").replace("-", "_")}'
        df[col_name] = df['amenities_list'].apply(lambda x: 1 if amenity in x else 0)
        
    # 6. Feature Engineering (Host & Dates)
    df['host_since'] = pd.to_datetime(df['host_since'], errors='coerce')
    df['host_experience_days'] = (pd.Timestamp.now() - df['host_since']).dt.days
    df['host_experience_years'] = df['host_experience_days'] / 365.25
    df['host_response_rate_clean'] = df['host_response_rate'].str.replace('%', '').astype(float)
    df['host_acceptance_rate_clean'] = df['host_acceptance_rate'].str.replace('%', '').astype(float)
    df['is_superhost'] = df['host_is_superhost'].fillna(False).astype(int)
    df['identity_verified'] = df['host_identity_verified'].fillna(False).astype(int)
    df['instant_bookable'] = df['instant_bookable'].fillna(False).astype(int)
    df['total_beds'] = df['beds'].fillna(0)
    
    return df

def get_neighborhood_stats(df_train):
    """
    Calculates neighborhood statistics from training data.
    """
    neighborhood_stats = df_train.groupby('neighbourhood_cleansed').agg({
        'price': ['mean', 'median', 'std'],
        'estimated_revenue_l365d': ['mean', 'median'],
        'estimated_occupancy_l365d': ['mean']
    }).round(2)
    neighborhood_stats.columns = ['neighborhood_' + '_'.join(col).strip() for col in neighborhood_stats.columns]
    return neighborhood_stats

def prepare_data_pipeline():
    """
    Splits data and applies feature engineering to prevent leakage.
    Returns:
        X_train, X_test (DataFrames with features)
        y_train_price, y_test_price
        y_train_rev, y_test_rev
        test_df (Original test dataframe with metadata)
        features (List of feature names used)
    """
    # 1. Load & Clean
    df = load_data_raw()
    df = basic_cleaning(df)
    
    # 2. Split
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    
    # 3. Compute Stats (Train Only)
    stats = get_neighborhood_stats(train_df)
    
    # 4. Merge Stats
    train_df = train_df.merge(stats, on='neighbourhood_cleansed', how='left')
    test_df = test_df.merge(stats, on='neighbourhood_cleansed', how='left')
    
    # 5. Impute Missing Values
    numerical_features = [
        'accommodates', 'bedrooms', 'bathrooms', 'beds',
        'host_experience_years', 'host_response_rate_clean', 'host_acceptance_rate_clean',
        'total_beds'
    ]
    numerical_features.extend(stats.columns.tolist())
    
    fill_values = train_df[numerical_features].median(numeric_only=True)
    
    for col in numerical_features:
        if col in train_df.columns:
            train_df[col] = train_df[col].fillna(fill_values.get(col, 0))
        if col in test_df.columns:
            test_df[col] = test_df[col].fillna(fill_values.get(col, 0))
            
    categorical_features = ['room_type', 'property_type', 'neighbourhood_cleansed']
    for feature in categorical_features:
        mode_val = train_df[feature].mode()[0]
        train_df[feature] = train_df[feature].fillna(mode_val)
        test_df[feature] = test_df[feature].fillna(mode_val)
        
    # 6. Select Features
    common_features = [
        'accommodates', 'bedrooms', 'bathrooms', 'beds', 'total_beds',
        'host_experience_years', 'host_response_rate_clean', 'host_acceptance_rate_clean',
        'is_superhost', 'identity_verified', 'instant_bookable',
        'calculated_host_listings_count',
        # Safe Neighborhood Stats
        'neighborhood_price_mean', 'neighborhood_price_median', 'neighborhood_price_std',
        'neighborhood_estimated_occupancy_l365d_mean'
    ]
    amenity_features = [col for col in train_df.columns if col.startswith('has_')]
    features = [c for c in common_features + amenity_features if c in train_df.columns]
    
    # 7. Encode Categoricals
    categorical_cols = train_df[features].select_dtypes(include=['object']).columns
    for col in categorical_cols:
        le = LabelEncoder()
        all_cats = pd.concat([train_df[col], test_df[col]]).astype(str).unique()
        le.fit(all_cats)
        train_df[col] = le.transform(train_df[col].astype(str))
        test_df[col] = le.transform(test_df[col].astype(str))
        
    return (
        train_df[features], test_df[features],
        train_df['price'], test_df['price'],
        train_df['estimated_revenue_l365d'], test_df['estimated_revenue_l365d'],
        test_df, features
    )

