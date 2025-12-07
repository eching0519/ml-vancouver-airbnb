import re
import numpy as np
import pandas as pd
from nltk.sentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import CountVectorizer

# ---------------------------------------------------------
# CONFIG: filenames & sampling
# ---------------------------------------------------------
REVIEWS_CSV = "C:/Users/Dilsha/Desktop/Data Analytics/Capstone Project/Datasets/reviews-complete.csv"
LISTINGS_XLSX = "C:/Users/Dilsha/Desktop/Data Analytics/Capstone Project/Datasets/listings-complete.xlsx"
AMENITIES_SHEET = "Amenities_cleaned"   # sheet inside listings-complete.xlsx
MAX_REVIEWS = 50000                     # set None for full dataset
import re
import ast
import numpy as np
import pandas as pd
from nltk.sentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import CountVectorizer

# ---------------------------------------------------------
# 1. Setup VADER
# ---------------------------------------------------------
print("Step 1: loading VADER...")
sia = SentimentIntensityAnalyzer()
print("VADER loaded.\n")

# ---------------------------------------------------------
# 2. Load your data
# ---------------------------------------------------------
print("Step 2: loading review CSV and listings Excel...")

# Reviews
reviews = pd.read_csv(REVIEWS_CSV)

# Listings from first sheet
listings = pd.read_excel(LISTINGS_XLSX, sheet_name=0)

# Cleaned amenities sheet
amenities_clean = pd.read_excel(LISTINGS_XLSX, sheet_name=AMENITIES_SHEET)

print(f"Loaded {len(reviews)} reviews, {len(listings)} listings, {len(amenities_clean)} cleaned amenities rows.")

# Optional: sample reviews to speed up while testing
if MAX_REVIEWS is not None and len(reviews) > MAX_REVIEWS:
    reviews = reviews.sample(n=MAX_REVIEWS, random_state=0)
    print(f"Subsampled reviews to {len(reviews)} rows for speed.\n")

# Convert review dates if present
if "date" in reviews.columns:
    reviews["date"] = pd.to_datetime(reviews["date"], errors="coerce")

# ---------------------------------------------------------
# 3. Clean review text
# ---------------------------------------------------------
print("Step 3: cleaning review text...")

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        text = "" if pd.isna(text) else str(text)
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)   # remove URLs
    text = re.sub(r"[^a-z\s]", " ", text)           # keep only letters/spaces
    text = re.sub(r"\s+", " ", text).strip()        # collapse spaces
    return text

reviews["clean_text"] = reviews["comments"].astype(str).apply(clean_text)

print("Text cleaning done.\n")

# ---------------------------------------------------------
# 4. Sentiment with VADER
# ---------------------------------------------------------
print("Step 4: computing sentiment scores...")

def vader_sentiment_score(text: str) -> float:
    if not isinstance(text, str):
        text = "" if pd.isna(text) else str(text)
    return sia.polarity_scores(text)["compound"]

def label_sentiment(score: float) -> str:
    if score > 0.05:
        return "positive"
    elif score < -0.05:
        return "negative"
    else:
        return "neutral"

reviews["sentiment_score"] = reviews["comments"].astype(str).apply(vader_sentiment_score)
reviews["sentiment_label"] = reviews["sentiment_score"].apply(label_sentiment)

print("Sentiment computation done.\n")

# ---------------------------------------------------------
# 5. Keywords: positive vs negative
# ---------------------------------------------------------
print("Step 5: extracting keywords with CountVectorizer...")

vectorizer = CountVectorizer(
    max_features=1000,   # tweak as you like
    min_df=10            # ignore very rare words
)
X = vectorizer.fit_transform(reviews["clean_text"])
vocab = vectorizer.get_feature_names_out()

# sentiment masks
pos_mask = reviews["sentiment_label"] == "positive"
neg_mask = reviews["sentiment_label"] == "negative"

# convert to integer row indices for sparse matrix
pos_idx = np.where(pos_mask.to_numpy())[0]
neg_idx = np.where(neg_mask.to_numpy())[0]

pos_counts = X[pos_idx].sum(axis=0).A1
neg_counts = X[neg_idx].sum(axis=0).A1

keyword_df = pd.DataFrame({
    "keyword": vocab,
    "positive_count": pos_counts,
    "negative_count": neg_counts,
})
keyword_df["total"] = keyword_df["positive_count"] + keyword_df["negative_count"]
keyword_df = keyword_df.sort_values("total", ascending=False)

print("Top 30 keywords by total mentions (positive + negative):")
print(keyword_df.head(30))
print("\nKeyword step done.\n")

# ---------------------------------------------------------
# 6. Price → numeric, occupancy & revenue
# ---------------------------------------------------------
print("Step 6: computing occupancy and estimated revenue...")

def parse_price(x):
    if pd.isna(x):
        return np.nan
    s = str(x).replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return np.nan

# expects 'price' and 'availability_365' columns in listings
listings["price_num"] = listings["price"].apply(parse_price)

if "availability_365" in listings.columns:
    listings["booked_nights"] = 365 - listings["availability_365"]
    listings["occupancy_rate"] = listings["booked_nights"] / 365.0
else:
    listings["booked_nights"] = np.nan
    listings["occupancy_rate"] = np.nan

listings["estimated_revenue"] = listings["price_num"] * listings["booked_nights"]

print("Occupancy and revenue computed.\n")

# ---------------------------------------------------------
# 7. Use Amenities_cleaned sheet as allowed list
# ---------------------------------------------------------
print("Step 7: using Amenities_cleaned sheet as allowed amenities...")

print("Columns in Amenities_cleaned sheet:", list(amenities_clean.columns))

# auto-detect amenity column (amenity / amenities, case-insensitive)
amenity_col_candidates = [
    c for c in amenities_clean.columns
    if c.strip().lower() in ("amenity", "amenities")
]

if not amenity_col_candidates:
    raise ValueError(
        "Could not find an amenity column in Amenities_cleaned sheet. "
        f"Found columns: {list(amenities_clean.columns)}. "
        "Rename the column to 'amenities' or 'amenity'."
    )

amenity_col = amenity_col_candidates[0]

amenities_clean["amenity"] = (
    amenities_clean[amenity_col]
    .astype(str)
    .str.strip()
    .str.lower()
)

allowed_amenities = set(amenities_clean["amenity"].unique())
print(f"Number of unique allowed amenities: {len(allowed_amenities)}\n")

# ---------------------------------------------------------
# 8. Aggregate sentiment per listing
# ---------------------------------------------------------
print("Step 8: aggregating sentiment by listing...")

if "listing_id" not in reviews.columns:
    raise ValueError("reviews-complete.csv must contain a 'listing_id' column matching listings 'id'.")

listing_sentiment = (
    reviews
    .groupby("listing_id")["sentiment_score"]
    .mean()
    .reset_index()
    .rename(columns={"sentiment_score": "mean_review_sentiment"})
)

if "id" not in listings.columns:
    raise ValueError("listings-complete.xlsx main sheet must contain an 'id' column.")

listing_merged = (
    listings
    .merge(
        listing_sentiment,
        left_on="id",
        right_on="listing_id",
        how="left"
    )
)

print("Listing-level sentiment merged.\n")

# ---------------------------------------------------------
# 9. Parse raw amenities from listings & filter by allowed list
# ---------------------------------------------------------
print("Step 9: parsing raw amenities from listings and filtering by cleaned list...")

def parse_amenities_cell(s):
    """
    listings['amenities'] is usually a string like:
    ["Freezer", "Heating", "Toaster", ...]
    We safely convert it to a Python list and clean.
    """
    if pd.isna(s):
        return []
    try:
        items = ast.literal_eval(s)
        return [str(a).strip().lower() for a in items]
    except Exception:
        return []

if "amenities" not in listing_merged.columns:
    raise ValueError("listings sheet must have a column named 'amenities' (raw amenities).")

# parse per listing
listing_merged["amenity_list"] = listing_merged["amenities"].astype(str).apply(parse_amenities_cell)

# explode to one row per (listing, amenity)
amenity_df = (
    listing_merged[["id", "amenity_list", "occupancy_rate",
                    "estimated_revenue", "mean_review_sentiment"]]
    .explode("amenity_list")
    .rename(columns={"amenity_list": "amenity"})
)

# drop empty amenity values
amenity_df = amenity_df[
    amenity_df["amenity"].notna() &
    (amenity_df["amenity"].str.strip() != "")
]

# keep only amenities that are in your cleaned list
amenity_df = amenity_df[amenity_df["amenity"].isin(allowed_amenities)]

# drop any duplicate (listing, amenity) pairs
amenity_df = amenity_df.drop_duplicates(subset=["id", "amenity"])

print(f"Rows after filtering & deduplicating listing–amenity pairs: {len(amenity_df)}\n")

# ---------------------------------------------------------
# 10. Amenity-level stats (no duplicate amenity rows)
# ---------------------------------------------------------
print("Step 10: computing amenity-level stats...")

amenity_stats = (
    amenity_df
    .groupby("amenity")
    .agg(
        n_listings=("id", "nunique"),
        avg_occupancy=("occupancy_rate", "mean"),
        avg_estimated_revenue=("estimated_revenue", "mean"),
        avg_review_sentiment=("mean_review_sentiment", "mean")
    )
    .reset_index()
)

# keep only amenities with enough listings
amenity_stats = amenity_stats[amenity_stats["n_listings"] >= 10]

# each amenity appears ONLY ONCE here
top_by_occupancy = amenity_stats.sort_values("avg_occupancy", ascending=False).head(30)
top_by_revenue = amenity_stats.sort_values("avg_estimated_revenue", ascending=False).head(30)
low_sentiment = amenity_stats.sort_values("avg_review_sentiment", ascending=True).head(30)

print("\nAmenities with highest average occupancy (unique amenities):")
print(top_by_occupancy[["amenity", "n_listings", "avg_occupancy"]])

print("\nAmenities with highest estimated revenue (unique amenities):")
print(top_by_revenue[["amenity", "n_listings", "avg_estimated_revenue"]])

print("\nAmenities with lowest (most negative) average review sentiment (unique amenities):")
print(low_sentiment[["amenity", "n_listings", "avg_review_sentiment"]])

print("\nAll done ✅")
