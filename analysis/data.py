import json
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.model_selection import KFold, train_test_split
from sklearn.preprocessing import LabelEncoder

# Suppress FutureWarnings from pandas
warnings.simplefilter(action='ignore', category=FutureWarning)
pd.set_option('future.no_silent_downcasting', True)


def load_data_raw():
    """Loads raw data from the data directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Look for data in ../data/ relative to analysis/
    data_path = os.path.join(current_dir, '..', 'data', 'listings-detail.csv')
    
    if not os.path.exists(data_path):
        data_path = 'data/listings-detail.csv'
        
    print(f"Loading data from: {data_path}")
    return pd.read_csv(data_path)

def basic_cleaning(df):
    """Performs initial cleaning: boolean conversion, price parsing, and IQR outlier removal."""
    # Boolean Conversion
    boolean_columns = [
        'host_is_superhost', 'host_identity_verified',
        'has_availability', 'instant_bookable'
    ]
    for col in boolean_columns:
        if col in df.columns:
            df[col] = df[col].map({'t': True, 'f': False})
            
    # Price Cleaning
    if 'price' in df.columns:
        df['price'] = df['price'].astype(str).str.replace('$', '').str.replace(',', '')
        df['price'] = pd.to_numeric(df['price'], errors='coerce')
        
    # Filter Missing Targets
    df = df.dropna(subset=['price', 'estimated_revenue_l365d'])
    
    # IQR Outlier Filtering
    Q1_price = df['price'].quantile(0.25)
    Q3_price = df['price'].quantile(0.75)
    IQR_price = Q3_price - Q1_price
    lower_price = Q1_price - 1.5 * IQR_price
    upper_price = Q3_price + 1.5 * IQR_price
    
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
    print(f"Data Cleaning: Removed {initial_len - len(df)} outliers.")
    
    # Amenities Parsing
    def parse_amenities(amenities_str):
        if pd.isna(amenities_str) or amenities_str == '':
            return []
        try:
            amenities_str = amenities_str.replace('""', '"')
            return json.loads(amenities_str)
        except:
            return []

    df['amenities_list'] = df['amenities'].apply(parse_amenities)
    
    # Flexible Amenity Matching
    amenity_mapping = {
        'Wifi': ['wifi'],
        'Kitchen': ['kitchen', 'kitchenette'],
        'Heating': ['heating', 'indoor fireplace'],
        'Washer': ['washer'],
        'Dryer': ['dryer'],
        'Air conditioning': ['air conditioning', 'central air conditioning'],
        'Free parking': ['free parking', 'free driveway parking', 'free street parking', 'free residential garage'],
        'Hot tub': ['hot tub', 'sauna'],
        'Pool': ['pool'],
        'Gym': ['gym', 'exercise equipment'],
        'Pet-friendly': ['pets allowed', 'cat(s)', 'dog(s)'],
        'Self check-in': ['self check-in', 'keypad', 'smart lock'],
        'Lockbox': ['lockbox'],
        'Elevator': ['elevator'],
        'Balcony': ['balcony', 'patio', 'terrace'],
        'Garden': ['garden', 'backyard'],
        'BBQ grill': ['bbq', 'barbecue', 'grill'],
        'Workspace': ['workspace', 'desk']
    }
    
    for label, keywords in amenity_mapping.items():
        col_name = f'has_{label.lower().replace(" ", "_").replace("-", "_")}'
        # Check if ANY keyword appears in ANY amenity string for that listing
        df[col_name] = df['amenities_list'].apply(
            lambda amenities: 1 if any(
                any(k.lower() in a.lower() for k in keywords) 
                for a in amenities
            ) else 0
        )
        
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

    # 7. Handle specific logical NaNs (before dropping actual missing data)
    if 'reviews_per_month' in df.columns:
        df['reviews_per_month'] = df['reviews_per_month'].fillna(0)
    
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
        df (Full cleaned DataFrame for comparative analysis)
        metadata (Dictionary with stats/mappings for frontend inference)
    """
    metadata = {}

    # 1. Load & Clean
    df = load_data_raw()
    df = basic_cleaning(df)

    # Text / NLP Features
    print("Extracting Text Features...")
    
    # Fill text NaNs
    df['name'] = df['name'].fillna('')
    df['description'] = df['description'].fillna('')
    
    # Length features
    df['name_len'] = df['name'].apply(len)
    df['desc_len'] = df['description'].apply(len)
    
    # Keywords (Binary Features)
    keywords = ['view', 'luxury', 'ocean', 'downtown', 'renovated', 'private', 'quiet', 'garden', 'spacious']
    for word in keywords:
        # Case insensitive search
        df[f'txt_{word}'] = (
            df['name'].str.contains(word, case=False) | 
            df['description'].str.contains(word, case=False)
        ).astype(int)
    
    text_features = ['name_len', 'desc_len'] + [f'txt_{w}' for w in keywords]
    
    # One-Hot Encoding for Neighborhoods
    nbhd_dummies = pd.get_dummies(df['neighbourhood_cleansed'], prefix='nbhd', dtype=int)
    df = pd.concat([df, nbhd_dummies], axis=1)
    
    # Split
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    
    # Compute Stats (Train Only)
    stats = get_neighborhood_stats(train_df)
    
    # Save stats to metadata (convert to dict of dicts)
    metadata['neighborhood_stats'] = stats.to_dict(orient='index')

    # Merge Stats
    train_df = train_df.merge(stats, on='neighbourhood_cleansed', how='left')
    test_df = test_df.merge(stats, on='neighbourhood_cleansed', how='left')
    
    # 5. Define Features
    common_features = [
        'accommodates', 'bedrooms', 'bathrooms', 'beds', 'total_beds',
        'host_experience_years', 'host_response_rate_clean', 'host_acceptance_rate_clean',
        'is_superhost', 'identity_verified', 'instant_bookable',
        'calculated_host_listings_count',
        # Location Features
        'latitude', 'longitude',
        # New Quality Features
        'reviews_per_month', 'review_scores_rating', 'review_scores_location',
        'review_scores_cleanliness', 'review_scores_value', 'availability_365',
        # Safe Neighborhood Stats
        'neighborhood_price_mean', 'neighborhood_price_median', 'neighborhood_price_std',
        'neighborhood_estimated_occupancy_l365d_mean',
        # Categoricals to encode
        'room_type', 'property_type'
    ]
    
    amenity_features = [col for col in train_df.columns if col.startswith('has_')]
    nbhd_features = [col for col in train_df.columns if col.startswith('nbhd_')]
    
    # Combined features list
    candidates = common_features + amenity_features + nbhd_features
    features = [c for c in candidates if c in train_df.columns]
    
    # 6. Handle Missing Values (Smart Imputation instead of Drop)
    # Strategy: Impute missing reviews with median, but add a flag indicating it was missing
    review_cols = [
        'reviews_per_month', 'review_scores_rating', 'review_scores_location',
        'review_scores_cleanliness', 'review_scores_value'
    ]
    
    metadata['medians'] = {}
    for col in review_cols:
        if col in train_df.columns:
            # Create indicator flag
            train_df[f'{col}_missing'] = train_df[col].isna().astype(int)
            test_df[f'{col}_missing'] = test_df[col].isna().astype(int)
            
            # Fill with median
            median_val = train_df[col].median()
            # Save median to metadata
            metadata['medians'][col] = float(median_val)

            train_df[col] = train_df[col].fillna(median_val)
            test_df[col] = test_df[col].fillna(median_val)
            
    # Update features list to include new flags
    features.extend([f'{c}_missing' for c in review_cols if f'{c}_missing' in train_df.columns])

    # 7. Text / NLP Features (Simple Keyword Extraction)
    # Already processed before split, just adding to features list
    features.extend([f for f in text_features if f not in features])

    # 8. Distance Features (Geography)
    # Vancouver City Center coordinates approx: 49.2819, -123.1187
    downtown_lat, downtown_lon = 49.2819, -123.1187
    
    # Haversine formula approximation (simplified for speed)
    train_df['dist_to_downtown'] = np.sqrt(
        ((train_df['latitude'] - downtown_lat) * 111)**2 + 
        ((train_df['longitude'] - downtown_lon) * 78)**2
    )
    test_df['dist_to_downtown'] = np.sqrt(
        ((test_df['latitude'] - downtown_lat) * 111)**2 + 
        ((test_df['longitude'] - downtown_lon) * 78)**2
    )
    features.append('dist_to_downtown')

    # 9. Interaction Features (Domain Knowledge)
    # Quality * Popularity
    train_df['quality_popularity'] = train_df['review_scores_rating'] * train_df['reviews_per_month']
    test_df['quality_popularity'] = test_df['review_scores_rating'] * test_df['reviews_per_month']
    features.append('quality_popularity')
        
    # Space per person (crowdedness) - Handle division by zero or NaN safely
    for df_curr in [train_df, test_df]:
        df_curr['people_per_bedroom'] = df_curr['accommodates'] / (df_curr['bedrooms'].replace(0, 1))
        df_curr['people_per_bath'] = df_curr['accommodates'] / (df_curr['bathrooms'].replace(0, 1))
    
    features.append('people_per_bedroom')
    features.append('people_per_bath')

    # Target Encoding
    print("Applying K-Fold Target Encoding...")
    
    target_encode_cols = ['neighbourhood_cleansed', 'property_type']
    
    # We need to target encode for BOTH Price and Revenue
    targets = {
        'price': train_df['price'], 
        'rev': train_df['estimated_revenue_l365d']
    }
    
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    metadata['target_encoding'] = {}

    for col in target_encode_cols:
        if col not in train_df.columns:
            continue
            
        metadata['target_encoding'][col] = {}

        for target_name, target_vals in targets.items():
            new_col_name = f'TE_{target_name}_{col}'
            
            # Initialize with NaN
            train_df[new_col_name] = np.nan
            
            # Train Set: K-Fold to prevent leakage
            for tr_ind, val_ind in kf.split(train_df):
                X_tr, X_val = train_df.iloc[tr_ind], train_df.iloc[val_ind]
                y_tr = target_vals.iloc[tr_ind]
                
                # Calculate means on training fold
                means = pd.DataFrame({'cat': X_tr[col], 'target': y_tr}).groupby('cat')['target'].mean()
                
                # Map to validation fold
                train_df.loc[train_df.index[val_ind], new_col_name] = X_val[col].map(means)
            
            # Fill NaNs in Train with global mean
            global_mean = target_vals.mean()
            train_df[new_col_name] = train_df[new_col_name].fillna(global_mean)
            
            # Test Set: Map using full training set means
            full_means = pd.DataFrame({'cat': train_df[col], 'target': target_vals}).groupby('cat')['target'].mean()
            test_df[new_col_name] = test_df[col].map(full_means)
            test_df[new_col_name] = test_df[new_col_name].fillna(global_mean)
            
            features.append(new_col_name)

            # Save mappings to metadata
            # full_means is a Series, convert to dict
            metadata['target_encoding'][col][target_name] = {
                'map': full_means.to_dict(),
                'global_mean': float(global_mean)
            }

    # Encode Categoricals
    # One-Hot Encode room_type
    if 'room_type' in train_df.columns:
        rt_dummies_train = pd.get_dummies(train_df['room_type'], prefix='rt', dtype=int)
        rt_dummies_test = pd.get_dummies(test_df['room_type'], prefix='rt', dtype=int)
        
        # Align columns
        rt_dummies_test = rt_dummies_test.reindex(columns=rt_dummies_train.columns, fill_value=0)
        
        train_df = pd.concat([train_df, rt_dummies_train], axis=1)
        test_df = pd.concat([test_df, rt_dummies_test], axis=1)
        
        features.extend(rt_dummies_train.columns.tolist())
        if 'room_type' in features:
            features.remove('room_type')

    # Label Encode remaining categoricals
    categorical_cols = train_df[features].select_dtypes(include=['object']).columns
    metadata['label_encoding'] = {}

    for col in categorical_cols:
        le = LabelEncoder()
        all_cats = pd.concat([train_df[col], test_df[col]]).astype(str).unique()
        le.fit(all_cats)
        train_df[col] = le.transform(train_df[col].astype(str))
        test_df[col] = le.transform(test_df[col].astype(str))
        
        # Save classes to metadata
        # We need a mapping: string -> int
        metadata['label_encoding'][col] = {label: int(i) for i, label in enumerate(le.classes_)}
        
    print(f"Final Training Set Shape: {train_df[features].shape}")
        
    return (
        train_df[features], test_df[features],
        train_df['price'], test_df['price'],
        train_df['estimated_revenue_l365d'], test_df['estimated_revenue_l365d'],
        test_df, features,
        df,
        metadata
    )
