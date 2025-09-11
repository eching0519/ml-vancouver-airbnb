# Vancouver Airbnb ML Analysis Guide

This guide provides comprehensive instructions for implementing machine learning analysis on Vancouver Airbnb data. Each analysis corresponds to a specific Jupyter notebook in this directory.

## 📁 Project Structure

```
ml/
├── README.md                           # This guide
├── price-revenue-prediction.ipynb      # Price & revenue prediction models
├── neighborhood-clustering.ipynb       # Market segmentation analysis
├── market-saturation.ipynb             # Competitive landscape analysis
├── guest-preference.ipynb              # Amenity basket analysis
└── emerging-hotspots-identification.ipynb # Growth opportunity identification
```

## 🚀 Getting Started

### Prerequisites
- Python 3.13+
- Jupyter Notebook
- Required packages: pandas, numpy, scikit-learn, matplotlib, seaborn, plotly, xgboost, lightgbm

### Data Setup
1. Ensure data files are in the `../data/` directory
2. Main datasets: `listings-detail.csv`, `calendar.csv`, `reviews-detail.csv`
3. Reference: `../data/README.md` for complete data documentation

---

## 📊 Analysis Modules

### 1. Price & Revenue Prediction (`price-revenue-prediction.ipynb`)

**Objective**: Predict nightly prices and annual revenue for properties

**Key Features**:
- Property characteristics (bedrooms, bathrooms, amenities)
- Location factors (neighborhood, coordinates)
- Host characteristics (superhost status, response rate)

**Models to Implement**:
- Linear Regression (baseline)
- Random Forest Regressor
- XGBoost Regressor
- LightGBM Regressor

**Target Variables**:
- `price` (nightly rate)
- `estimated_revenue_l365d` (annual revenue)

**Evaluation Metrics**:
- RMSE, MAE, R² for regression models
- Cross-validation with 5-fold CV

**Implementation Steps**:
1. Load and explore `listings-detail.csv`
2. Feature engineering (amenity encoding, location features)
3. Handle missing values and outliers
4. Train multiple regression models
5. Compare performance and select best model
6. Generate predictions for new properties

---

### 2. Neighborhood Clustering (`neighborhood-clustering.ipynb`)

**Objective**: Segment neighborhoods into market clusters based on pricing and demand patterns

**Clustering Features**:
- Average price by neighborhood
- Occupancy rates (`estimated_occupancy_l365d`)
- Revenue metrics (`estimated_revenue_l365d`)
- Property type distribution
- Amenity density

**Models to Implement**:
- K-Means Clustering
- DBSCAN Clustering
- Hierarchical Clustering

**Clustering Metrics**:
- Silhouette Score
- Davies-Bouldin Index
- Elbow Method for optimal K

**Implementation Steps**:
1. Aggregate neighborhood-level statistics
2. Standardize features for clustering
3. Determine optimal number of clusters
4. Apply clustering algorithms
5. Visualize clusters on map using `neighbourhoods.geojson`
6. Interpret cluster characteristics

---

### 3. Market Saturation Analysis (`market-saturation.ipynb`)

**Objective**: Analyze competitive landscape and identify successful listing characteristics

**Analysis Components**:
- Market saturation by neighborhood
- Top performer classification
- Feature importance analysis
- Competitive positioning

**Models to Implement**:
- Random Forest Classifier (top 20% revenue)
- Logistic Regression
- Feature importance analysis
- Market concentration metrics

**Target Variable**:
- Binary classification: Top 20% revenue performers

**Implementation Steps**:
1. Calculate revenue percentiles
2. Create binary classification target
3. Train classification models
4. Analyze feature importance
5. Calculate market saturation metrics
6. Identify differentiation factors

---

### 4. Guest Preference Analysis (`guest-preference.ipynb`)

**Objective**: Identify amenity combinations that drive high revenue

**Analysis Methods**:
- Market Basket Analysis (Apriori algorithm)
- Association rule mining
- Amenity correlation analysis
- Revenue impact assessment

**Key Amenities to Analyze**:
- WiFi, Parking, Kitchen, Laundry
- Air conditioning, Heating
- Pool, Gym, Pet-friendly
- Business travel ready

**Implementation Steps**:
1. Parse amenity JSON data
2. Create binary amenity features
3. Apply Apriori algorithm
4. Generate association rules
5. Analyze rules with high revenue correlation
6. Create amenity recommendation system

---

## 🔧 Common Implementation Patterns

### Data Preprocessing
```python
# Standard preprocessing steps for all notebooks
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split

# Load data
df = pd.read_csv('../data/listings-detail.csv')

# Handle missing values
df = df.fillna(df.median())

# Encode categorical variables
    le = LabelEncoder()
    df['room_type_encoded'] = le.fit_transform(df['room_type'])

# Scale numerical features
scaler = StandardScaler()
numerical_features = ['bedrooms', 'bathrooms', 'accommodates']
df[numerical_features] = scaler.fit_transform(df[numerical_features])
```

### Model Evaluation Framework
```python
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score
from sklearn.model_selection import cross_val_score

def evaluate_regression_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    return {'MSE': mse, 'R2': r2}

def evaluate_classification_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    return {'Accuracy': accuracy}
```

### Visualization Standards
```python
import matplotlib.pyplot as plt
import seaborn as sns

# Set consistent plotting style
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

# Standard plot sizes
plt.figure(figsize=(12, 8))
```

---

## 📈 Expected Deliverables

Each notebook should produce:

1. **Data Exploration**: EDA with visualizations
2. **Model Training**: Multiple algorithms with comparison
3. **Model Evaluation**: Performance metrics and validation
4. **Results Interpretation**: Business insights and recommendations
5. **Predictions**: Sample predictions for new properties
6. **Visualizations**: Maps, charts, and interactive plots

---

## 🎯 Business Value

This ML analysis provides:

- **Investment Decision Support**: Price predictions and ROI estimates
- **Market Intelligence**: Neighborhood segmentation and trends
- **Risk Management**: Compliance and regulatory risk assessment
- **Competitive Advantage**: Understanding successful listing factors
- **Growth Opportunities**: Identifying emerging markets

---

## 📝 Implementation Notes

- Start with `price-revenue-prediction.ipynb` as it provides the foundation for other analyses
- Use consistent feature engineering across notebooks
- Save trained models for reuse in other analyses
- Document all assumptions and limitations
- Include business interpretation for all technical results

---

## 🔍 Data Quality Considerations

- Handle missing values appropriately for each analysis
- Address outliers in price and revenue data
- Validate amenity data parsing
- Check for data consistency across time periods
- Consider seasonal effects in time series analysis

---

## 📚 Additional Resources

- [Scikit-learn Documentation](https://scikit-learn.org/)
- [Pandas Documentation](https://pandas.pydata.org/)
- [Plotly Documentation](https://plotly.com/python/)
- [Inside Airbnb Data Guide](http://insideairbnb.com/get-the-data.html)

---

*Last Updated: December 2024*
*Data Source: Vancouver Airbnb Data (August 2025)*
