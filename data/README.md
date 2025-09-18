# Vancouver Airbnb Dataset

This dataset contains comprehensive Airbnb data for Vancouver scraped on 10 Augest, 2025 (source: https://insideairbnb.com/get-the-data/), including listing information, calendar data, reviews, and geographic data. This README provides complete documentation of all data files and their columns, eliminating the need to repeatedly access the raw_data folder.

## Dataset Overview

The dataset consists of 7 main files containing different aspects of Airbnb data:

1. **listings.csv** - Basic listing information (5,577 records, 19 fields)
2. **listings-detail.csv** - Complete detailed listing information (8,713 records, 79 fields)
3. **calendar.csv** - Calendar availability and pricing data (2,025,745 records, 6 fields)
4. **reviews.csv** - Basic review information (297,612 records, 2 fields)
5. **reviews-detail.csv** - Complete detailed review information (305,523 records, 6 fields)
6. **neighbourhoods.csv** - Neighbourhood basic information (22 records, 2 fields)
7. **neighbourhoods.geojson** - Geographic boundaries for neighbourhoods

---

## 1. listings.csv (Basic Listing Information)

**File Size**: 1.2 MB  
**Records**: 5,577 listings  
**Fields**: 19 fields

### Complete Field Descriptions:

| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `id` | integer | No | Airbnb's unique identifier for the listing |
| `name` | string | No | Name of the listing |
| `host_id` | integer | No | Airbnb's unique identifier for the host/user |
| `host_name` | string | No | Name of the host (usually just first name(s)) |
| `neighbourhood_group` | text | Yes | The neighbourhood group as geocoded using latitude and longitude against neighborhoods as defined by open or public digital shapefiles |
| `neighbourhood` | text | Yes | The neighbourhood as geocoded using latitude and longitude against neighborhoods as defined by open or public digital shapefiles |
| `latitude` | numeric | No | Uses the World Geodetic System (WGS84) projection for latitude |
| `longitude` | numeric | No | Uses the World Geodetic System (WGS84) projection for longitude |
| `room_type` | string | No | Room type classification (Entire home/apt, Private room, Shared room) |
| `price` | currency | No | Daily price in local currency. Note: $ sign may be used despite locale |
| `minimum_nights` | integer | No | Minimum number of nights stay for the listing (calendar rules may be different) |
| `number_of_reviews` | integer | No | The number of reviews the listing has |
| `last_review` | date | Yes | The date of the last/newest review |
| `reviews_per_month` | numeric | Yes | The average number of reviews per month the listing has over the lifetime of the listing |
| `calculated_host_listings_count` | integer | Yes | The number of listings the host has in the current scrape, in the city/region geography |
| `availability_365` | integer | Yes | The availability of the listing 365 days in the future as determined by the calendar. Note: a listing may not be available because it has been booked by a guest or blocked by the host |
| `number_of_reviews_ltm` | integer | Yes | The number of reviews the listing has (in the last 12 months) |
| `license` | string | No | The licence/permit/registration number |

---

## 2. listings-detail.csv (Complete Detailed Listing Information)

**File Size**: 14.0 MB  
**Records**: 8,713 listings  
**Fields**: 79 fields

### Complete Field Descriptions:

#### Basic Information
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `id` | integer | No | Airbnb's unique identifier for the listing |
| `listing_url` | text | Yes | URL to the listing |
| `scrape_id` | bigint | Yes | Inside Airbnb "Scrape" this was part of |
| `last_scraped` | datetime | Yes | UTC. The date and time this listing was "scraped" |
| `source` | text | No | One of "neighbourhood search" or "previous scrape". "neighbourhood search" means the listing was found by searching the city, while "previous scrape" means the listing was seen in another scrape performed in the last 65 days |
| `name` | text | No | Name of the listing |
| `description` | text | No | Detailed description of the listing |
| `neighborhood_overview` | text | No | Host's description of the neighbourhood |
| `picture_url` | text | No | URL to the Airbnb hosted regular sized image for the listing |

#### Host Information
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `host_id` | integer | No | Airbnb's unique identifier for the host/user |
| `host_url` | text | Yes | The Airbnb page for the host |
| `host_name` | text | No | Name of the host (usually just first name(s)) |
| `host_since` | date | No | The date the host/user was created. For hosts that are Airbnb guests this could be the date they registered as a guest |
| `host_location` | text | No | The host's self reported location |
| `host_about` | text | No | Description about the host |
| `host_response_time` | text | No | Host response time |
| `host_response_rate` | text | No | Host response rate |
| `host_acceptance_rate` | text | No | The rate at which a host accepts booking requests |
| `host_is_superhost` | boolean | No | Whether host is a superhost (t=true; f=false) |
| `host_thumbnail_url` | text | No | URL to host's thumbnail image |
| `host_picture_url` | text | No | URL to host's profile picture |
| `host_neighbourhood` | text | No | Host's neighbourhood |
| `host_listings_count` | text | No | The number of listings the host has (per Airbnb unknown calculations) |
| `host_total_listings_count` | text | No | The number of listings the host has (per Airbnb unknown calculations) |
| `host_verifications` | text | No | Host verification information |
| `host_has_profile_pic` | boolean | No | Whether host has profile picture (t=true; f=false) |
| `host_identity_verified` | boolean | No | Whether host identity is verified (t=true; f=false) |

#### Location Information
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `neighbourhood` | text | No | Neighbourhood name |
| `neighbourhood_cleansed` | text | Yes | The neighbourhood as geocoded using latitude and longitude against neighborhoods as defined by open or public digital shapefiles |
| `neighbourhood_group_cleansed` | text | Yes | The neighbourhood group as geocoded using latitude and longitude against neighborhoods as defined by open or public digital shapefiles |
| `latitude` | numeric | No | Uses the World Geodetic System (WGS84) projection for latitude |
| `longitude` | numeric | No | Uses the World Geodetic System (WGS84) projection for longitude |

#### Property Details
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `property_type` | text | No | Self selected property type. Hotels and Bed and Breakfasts are described as such by their hosts in this field |
| `room_type` | text | No | Room type classification (Entire home/apt, Private room, Shared room, Hotel) |
| `accommodates` | integer | No | The maximum capacity of the listing |
| `bathrooms` | numeric | No | The number of bathrooms in the listing |
| `bathrooms_text` | string | No | The number of bathrooms in the listing. On the Airbnb web-site, the bathrooms field has evolved from a number to a textual description. For older scrapes, bathrooms is used |
| `bedrooms` | integer | No | The number of bedrooms |
| `beds` | integer | No | The number of bed(s) |
| `amenities` | json | No | List of amenities (JSON format) |

#### Pricing and Availability
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `price` | currency | No | Daily price in local currency. NOTE: the $ sign is a technical artifact of the export, please ignore it |
| `minimum_nights` | integer | No | Minimum number of nights stay for the listing (calendar rules may be different) |
| `maximum_nights` | integer | No | Maximum number of nights stay for the listing (calendar rules may be different) |
| `minimum_minimum_nights` | integer | Yes | The smallest minimum_night value from the calendar (looking 365 nights in the future) |
| `maximum_minimum_nights` | integer | Yes | The largest minimum_night value from the calendar (looking 365 nights in the future) |
| `minimum_maximum_nights` | integer | Yes | The smallest maximum_night value from the calendar (looking 365 nights in the future) |
| `maximum_maximum_nights` | integer | Yes | The largest maximum_night value from the calendar (looking 365 nights in the future) |
| `minimum_nights_avg_ntm` | numeric | Yes | The average minimum_night value from the calendar (looking 365 nights in the future) |
| `maximum_nights_avg_ntm` | numeric | Yes | The average maximum_night value from the calendar (looking 365 nights in the future) |
| `calendar_updated` | date | No | Date when calendar was last updated |
| `has_availability` | boolean | No | Whether listing has availability (t=true; f=false) |
| `availability_30` | integer | Yes | The availability of the listing 30 days in the future as determined by the calendar |
| `availability_60` | integer | Yes | The availability of the listing 60 days in the future as determined by the calendar |
| `availability_90` | integer | Yes | The availability of the listing 90 days in the future as determined by the calendar |
| `availability_365` | integer | Yes | The availability of the listing 365 days in the future as determined by the calendar |
| `calendar_last_scraped` | date | No | Date when calendar was last scraped |

#### Review Information
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `number_of_reviews` | integer | No | The number of reviews the listing has |
| `number_of_reviews_ltm` | integer | Yes | The number of reviews the listing has (in the last 12 months) |
| `number_of_reviews_l30d` | integer | Yes | The number of reviews the listing has (in the last 30 days) |
| `availability_eoy` | integer | Yes | Availability at end of year (calculated field) |
| `number_of_reviews_ly` | integer | Yes | Number of reviews last year (calculated field) |
| `estimated_occupancy_l365d` | numeric | Yes | Estimated occupancy rate over last 365 days (calculated field) |
| `estimated_revenue_l365d` | numeric | Yes | Estimated revenue over last 365 days (calculated field) |
| `first_review` | date | Yes | The date of the first/oldest review |
| `last_review` | date | Yes | The date of the last/newest review |
| `review_scores_rating` | numeric | No | Overall rating score |
| `review_scores_accuracy` | numeric | No | Accuracy rating score |
| `review_scores_cleanliness` | numeric | No | Cleanliness rating score |
| `review_scores_checkin` | numeric | No | Check-in rating score |
| `review_scores_communication` | numeric | No | Communication rating score |
| `review_scores_location` | numeric | No | Location rating score |
| `review_scores_value` | numeric | No | Value rating score |

#### Additional Information
| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `license` | text | No | The licence/permit/registration number |
| `instant_bookable` | boolean | No | Whether the guest can automatically book the listing without the host requiring to accept their booking request. An indicator of a commercial listing (t=true; f=false) |
| `calculated_host_listings_count` | integer | Yes | The number of listings the host has in the current scrape, in the city/region geography |
| `calculated_host_listings_count_entire_homes` | integer | Yes | The number of Entire home/apt listings the host has in the current scrape, in the city/region geography |
| `calculated_host_listings_count_private_rooms` | integer | Yes | The number of Private room listings the host has in the current scrape, in the city/region geography |
| `calculated_host_listings_count_shared_rooms` | integer | Yes | The number of Shared room listings the host has in the current scrape, in the city/region geography |
| `reviews_per_month` | numeric | Yes | The average number of reviews per month the listing has over the lifetime of the listing |

---

## 3. calendar.csv (Calendar Data)

**File Size**: 76.0 MB  
**Records**: 2,025,745 records  
**Fields**: 6 fields
**Data Range**: 10 August 2025 to 09 Augest 2026

### Complete Field Descriptions:

| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `listing_id` | integer | No | Listing ID (corresponds to listings id) |
| `date` | datetime | No | The date in the listing's calendar |
| `available` | boolean | No | Whether the date is available for a booking |
| `price` | currency | No | The price listed for the day |
| `adjusted_price` | currency | No | Adjusted price for the day |
| `minimum_nights` | integer | No | Minimum nights for a booking made on this day |
| `maximum_nights` | integer | No | Maximum nights for a booking made on this day |

---

## 4. reviews.csv (Basic Review Information)

**File Size**: 7.0 MB  
**Records**: 297,612 reviews  
**Fields**: 2 fields
**Data Range**: 21 February 2010 to 10 August 2025

### Complete Field Descriptions:

| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `listing_id` | integer | No | Listing ID |
| `date` | date | No | Review date |

---

## 5. reviews-detail.csv (Complete Detailed Review Information)

**File Size**: 89.0 MB  
**Records**: 305,523 reviews  
**Fields**: 6 fields
**Data Range**: 21 February 2010 to 10 August 2025

### Complete Field Descriptions:

| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `listing_id` | integer | No | Listing ID |
| `id` | integer | No | Unique identifier for the review |
| `date` | date | No | Review date |
| `reviewer_id` | integer | No | Reviewer's unique identifier |
| `reviewer_name` | text | No | Reviewer's name |
| `comments` | text | No | Review content (text) |

---

## 6. neighbourhoods.csv (Neighbourhood Basic Information)

**File Size**: 368 bytes  
**Records**: 22 neighbourhoods  
**Fields**: 2 fields

### Complete Field Descriptions:

| Field | Type | Calculated | Description |
|-------|------|------------|-------------|
| `neighbourhood_group` | text | No | Neighbourhood group (mostly empty values) |
| `neighbourhood` | text | No | Neighbourhood name |

### Included Neighbourhoods:
Arbutus Ridge, Downtown, Downtown Eastside, Dunbar Southlands, Fairview, Grandview-Woodland, Hastings-Sunrise, Kensington-Cedar Cottage, Kerrisdale, Killarney, Kitsilano, Marpole, Mount Pleasant, Oakridge, Renfrew-Collingwood, Riley Park, Shaughnessy, South Cambie, Strathcona, Sunset, West End, West Point Grey

---

## 7. neighbourhoods.geojson (Geographic Boundaries)

**File Size**: 563 KB  
**Format**: GeoJSON FeatureCollection  
**Content**: Contains geographic boundary coordinates for all neighbourhoods  
**Purpose**: Used for map visualization and geographic analysis  
**Structure**: MultiPolygon geometry containing latitude and longitude coordinates

---

## Data Relationships

- **listings.csv** and **listings-detail.csv**: Basic and complete versions of listing information
- **calendar.csv**: Links to listings via `listing_id`
- **reviews.csv** and **reviews-detail.csv**: Link to listings via `listing_id`
- **neighbourhoods.csv** and **neighbourhoods.geojson**: Neighbourhood names and geographic boundaries

---

## Room Type Definitions

- **Entire home/apt**: Best for those seeking a home away from home. You'll have the whole space to yourself, including bedroom, bathroom, kitchen, and separate entrance.
- **Private room**: Great for privacy while maintaining local connection. You'll have your own private room for sleeping and may share some spaces with others.
- **Shared room**: For flexible travelers who don't mind sharing space with others. You'll be sleeping in a space shared with other people.

---

## Data Quality Notes

1. **Price Data**: Some price fields may contain empty values
2. **Date Format**: All dates are in YYYY-MM-DD format
3. **Amenities Data**: `amenities` field is in JSON format string array
4. **Geographic Coordinates**: Uses WGS84 coordinate system (longitude, latitude)
5. **Review Content**: Contains HTML tags that need cleaning before use
6. **Calculated Fields**: Many fields are marked as calculated (y) and derived from other data
7. **Boolean Values**: Boolean fields use 't' for true and 'f' for false
8. **Currency**: Price fields may contain $ sign regardless of locale

---

## Recommended Usage

- **Basic Analysis**: Use `listings.csv` for basic listing statistics
- **Detailed Analysis**: Use `listings-detail.csv` for comprehensive analysis
- **Time Series Analysis**: Combine `calendar.csv` to analyze price and availability trends
- **Review Analysis**: Use `reviews-detail.csv` for sentiment analysis and text mining
- **Geographic Visualization**: Use `neighbourhoods.geojson` to create maps
- **Host Analysis**: Use calculated host fields to analyze host behavior and patterns

---

## Data Update Information

- **Last Updated**: August 30, 2025
- **Data Source**: Airbnb public data via Inside Airbnb
- **Scrape Information**: Data includes scrape IDs and timestamps for tracking data collection

---

## Technical Notes

- **Calculated Fields**: Fields marked as "Calculated: Yes" are derived from other data sources or computed during the scraping process
- **Data Dictionary Limitations**: The provided data dictionary CSV files may not include all columns present in the actual data files. This README has been updated to reflect all actual columns found in the raw data files.
- **Data Types**: 
  - `integer`: Whole numbers
  - `numeric`: Decimal numbers
  - `text`: String data
  - `boolean`: True/false values (represented as 't'/'f')
  - `date`: Date values in YYYY-MM-DD format
  - `datetime`: Date and time values
  - `currency`: Monetary values
  - `json`: JSON formatted data
- **Missing Values**: Empty cells indicate missing or unavailable data
- **Encoding**: Files are UTF-8 encoded