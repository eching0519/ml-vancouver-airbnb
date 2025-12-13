import { NextRequest, NextResponse } from "next/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
import metadata from "../../../lib/models_metadata.json";

interface NeighborhoodStats {
  neighborhood_price_mean: number;
  neighborhood_price_median: number;
  neighborhood_price_std: number;
  neighborhood_estimated_revenue_l365d_mean?: number;
  neighborhood_estimated_revenue_l365d_median?: number;
  neighborhood_estimated_occupancy_l365d_mean: number;
}

interface TargetEncodingMap {
  map: Record<string, number>;
  global_mean: number;
}

interface TargetEncoding {
  price: TargetEncodingMap;
  rev: TargetEncodingMap;
}

interface ModelsMetadata {
  feature_names: string[];
  medians: Record<string, number>;
  neighborhood_stats: Record<string, NeighborhoodStats>;
  target_encoding: Record<string, TargetEncoding>;
  label_encoding: Record<string, Record<string, number>>;
}

const typedMetadata = metadata as ModelsMetadata;

// Property type to room type mapping
const PROPERTY_TYPE_TO_ROOM_TYPE: Record<string, string> = {
  "Camper/RV": "Entire home/apt",
  Cave: "Entire home/apt",
  "Earthen home": "Entire home/apt",
  "Entire bungalow": "Entire home/apt",
  "Entire condo": "Entire home/apt",
  "Entire cottage": "Entire home/apt",
  "Entire guest suite": "Entire home/apt",
  "Entire guesthouse": "Entire home/apt",
  "Entire home": "Entire home/apt",
  "Entire loft": "Entire home/apt",
  "Entire place": "Entire home/apt",
  "Entire rental unit": "Entire home/apt",
  "Entire serviced apartment": "Entire home/apt",
  "Entire townhouse": "Entire home/apt",
  "Entire vacation home": "Entire home/apt",
  "Entire villa": "Entire home/apt",
  Houseboat: "Entire home/apt",
  "Private room in bed and breakfast": "Private room",
  "Private room in boat": "Private room",
  "Private room in bungalow": "Private room",
  "Private room in camper/rv": "Private room",
  "Private room in condo": "Private room",
  "Private room in guest suite": "Private room",
  "Private room in guesthouse": "Private room",
  "Private room in home": "Private room",
  "Private room in hostel": "Private room",
  "Private room in loft": "Private room",
  "Private room in rental unit": "Private room",
  "Private room in resort": "Private room",
  "Private room in serviced apartment": "Private room",
  "Private room in tiny home": "Private room",
  "Private room in tower": "Private room",
  "Private room in townhouse": "Private room",
  "Private room in villa": "Private room",
  Riad: "Entire home/apt",
  "Room in aparthotel": "Entire home/apt",
  "Room in bed and breakfast": "Hotel room",
  "Room in boutique hotel": "Private room",
  "Room in hotel": "Private room",
  "Shared room in barn": "Shared room",
  "Shared room in condo": "Shared room",
  "Shared room in home": "Shared room",
  "Shared room in hostel": "Shared room",
  "Shared room in hotel": "Shared room",
  "Shared room in loft": "Shared room",
  "Shared room in rental unit": "Shared room",
  "Shared room in tiny home": "Shared room",
  "Tiny home": "Entire home/apt",
  Tower: "Entire home/apt",
};

export interface PredictionFormData {
  neighbourhood_cleansed: string;
  room_type?: string; // Optional - will be derived from property_type if not provided
  property_type: string;
  accommodates: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  latitude: number;
  longitude: number;
  amenities: string[];

  // Optional Text Fields (character counts - will default to 0 if not provided)
  name?: number;
  description?: number;

  // Price Strategy Inputs
  instant_bookable: boolean;
  host_is_superhost: boolean;
  host_identity_verified: boolean;
  host_experience_years: number;

  // Revenue Prediction Inputs
  availability_365: number;
  reviews_per_month: number;
  review_scores_rating: number;
}

export interface PredictionResult {
  price: {
    point: number;
    lower: number;
    upper: number;
    distribution: Record<string, number>;
  };
  revenue: {
    point: number;
    lower: number;
    upper: number;
    distribution: Record<string, number>;
  };
}

// Global flag to ensure only one initialization across requests
let globalInferenceInitialized = false;
let globalInitPromise: Promise<void> | null = null;

class InferenceEngine {
  private ort: any = null;
  private sessions: Record<string, any> = {};
  private initialized = false;

  async init() {
    // Check global flag first (persists across requests)
    if (globalInferenceInitialized) {
      this.initialized = true;
      return;
    }

    // If global initialization is in progress, wait for it
    if (globalInitPromise) {
      await globalInitPromise;
      this.initialized = true;
      return;
    }

    // If already initialized locally, return
    if (this.initialized) return;

    // Start global initialization
    globalInitPromise = this._doInit();

    try {
      await globalInitPromise;
      globalInferenceInitialized = true;
      this.initialized = true;
    } catch (e) {
      // Clear global promise on failure to allow retry
      globalInitPromise = null;
      throw e;
    }
  }

  private async _doInit(): Promise<void> {
    try {
      // Load ONNX runtime via dynamic import for better compatibility across hosting platforms
      this.ort = await import("onnxruntime-node");
      console.log("Loaded ONNX runtime via dynamic import");

      if (!this.ort) {
        throw new Error("ONNX Runtime could not be loaded");
      }

      // Configure ONNX Runtime for server-side
      this.ort.env.logLevel = "error";

      const modelNames = ["Price_Model", "Revenue_Model"];

      const promises = modelNames.map(async (name) => {
        try {
          const modelPath = path.join(
            process.cwd(),
            "server",
            "models",
            `${name}.onnx`
          );
          console.log(`Loading model: ${modelPath}`);

          const session = await this.ort.InferenceSession.create(modelPath, {
            executionProviders: ["cpu"], // Use CPU for server-side
            logSeverityLevel: 3,
            graphOptimizationLevel: "all", // Optimize for production
          });

          this.sessions[name] = session;
          console.log(`Successfully loaded model: ${name}`);
        } catch (modelError) {
          console.error(`Failed to load model ${name}:`, modelError);
          throw new Error(
            `Failed to load model ${name}: ${
              modelError instanceof Error
                ? modelError.message
                : String(modelError)
            }`
          );
        }
      });

      await Promise.all(promises);
      this.initialized = true;
      console.log("ONNX inference engine initialized successfully");
    } catch (e) {
      console.error("Failed to initialize ONNX sessions:", e);
      throw new Error(
        `Inference engine initialization failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  private getKeywordFeature(text: string, keyword: string): number {
    return text.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0;
  }

  prepareFeatures(data: PredictionFormData): Float32Array {
    const featureNames = typedMetadata.feature_names;
    const feats = new Float32Array(featureNames.length);
    const featureMap = new Map<string, number>();

    // Helper to set feature
    const setF = (name: string, val: number) => featureMap.set(name, val);

    // Derive room_type from property_type if not provided
    const room_type =
      data.room_type ||
      PROPERTY_TYPE_TO_ROOM_TYPE[data.property_type] ||
      "Entire home/apt";

    // 1. Basic numeric inputs
    setF("accommodates", data.accommodates);
    setF("bedrooms", data.bedrooms);
    setF("bathrooms", data.bathrooms);
    setF("beds", data.beds);
    setF("total_beds", data.beds); // Assuming beds = total_beds
    setF("host_experience_years", data.host_experience_years);
    setF("latitude", data.latitude);
    setF("longitude", data.longitude);
    setF("reviews_per_month", data.reviews_per_month);
    setF("review_scores_rating", data.review_scores_rating);
    setF("availability_365", data.availability_365);

    // Booleans -> 0/1
    setF("instant_bookable", data.instant_bookable ? 1 : 0);
    setF("is_superhost", data.host_is_superhost ? 1 : 0);
    setF("identity_verified", data.host_identity_verified ? 1 : 0);

    // Missing Flags & Defaults for other scores
    // We use medians from metadata for scores not provided in form (though form asks for rating)
    // The form only asks for review_scores_rating. Others are missing.
    const reviewCols = [
      "review_scores_location",
      "review_scores_cleanliness",
      "review_scores_value",
    ];

    // We assume the user inputs are valid. For the ones NOT in form, use median.
    // Also host metrics not in form.
    const otherCols = [
      "host_response_rate_clean",
      "host_acceptance_rate_clean",
      "calculated_host_listings_count",
    ];

    // Fill Medians
    const medians = typedMetadata.medians || {};

    // Review scores (location/cleanliness/value) are not in form -> use median
    reviewCols.forEach((col) => {
      setF(col, medians[col] || 0);
      setF(`${col}_missing`, 1); // We are imputing them
    });

    // Host metrics missing -> median
    otherCols.forEach((col) => {
      setF(col, medians[col] || 0);
    });

    // Handle form inputs missing flags (if 0, is it missing? We assume 0 is real 0 for now)
    setF("reviews_per_month_missing", 0);
    setF("review_scores_rating_missing", 0);

    // 2. Neighborhood Stats
    const nbhdStats =
      typedMetadata.neighborhood_stats[data.neighbourhood_cleansed] || {};
    setF("neighborhood_price_mean", nbhdStats.neighborhood_price_mean || 0);
    setF("neighborhood_price_median", nbhdStats.neighborhood_price_median || 0);
    setF("neighborhood_price_std", nbhdStats.neighborhood_price_std || 0);
    setF(
      "neighborhood_estimated_occupancy_l365d_mean",
      nbhdStats.neighborhood_estimated_occupancy_l365d_mean || 0
    );

    // 3. Amenities
    // All `has_X` features
    const amenityMapping: Record<string, string[]> = {
      has_wifi: ["wifi"],
      has_kitchen: ["kitchen"],
      has_heating: ["heating"],
      has_washer: ["washer"],
      has_dryer: ["dryer"],
      has_air_conditioning: ["air conditioning"],
      has_free_parking: ["free parking"],
      has_hot_tub: ["hot tub"],
      has_pool: ["pool"],
      has_gym: ["gym"],
      has_pet_friendly: ["pet"],
      has_self_check_in: ["self check-in"],
      has_lockbox: ["lockbox"],
      has_elevator: ["elevator"],
      has_balcony: ["balcony"],
      has_garden: ["garden"],
      has_bbq_grill: ["bbq"],
      has_workspace: ["workspace"],
    };

    const userAmenities = new Set(data.amenities.map((a) => a.toLowerCase()));

    // Check match for each feature
    // Note: The form returns "Wifi", "Kitchen". We map roughly.
    // Actually the form values match the keys in AMENITIES_LIST in form.
    // We should map form values to the keys expected by model.
    // Model keys are `has_wifi`, etc.
    // Form values: 'Wifi', 'Kitchen', etc.

    Object.entries(amenityMapping).forEach(([featName, keywords]) => {
      // Simple check: does any form amenity contain the keyword?
      // Form amenities are selected from fixed list.
      // Let's just normalize form amenities to lower case and check inclusion.
      const hasIt = keywords.some((k) =>
        Array.from(userAmenities).some((ua) => ua.includes(k))
      );
      setF(featName, hasIt ? 1 : 0);
    });

    // has_availability -> 1 (assumed)
    setF("has_availability", 1);

    // 4. Categoricals: One-Hot
    // nbhd_X
    setF(`nbhd_${data.neighbourhood_cleansed}`, 1);

    // rt_X (Room Type)
    // Model feature names: rt_Entire home/apt, etc.
    // Room type is derived from property_type if not provided
    setF(`rt_${room_type}`, 1);

    // 5. Categoricals: Label Encoding
    // property_type
    const ptEncoder = typedMetadata.label_encoding["property_type"];
    if (ptEncoder && ptEncoder[data.property_type] !== undefined) {
      setF("property_type", ptEncoder[data.property_type]);
    } else {
      // Fallback or "Other"
      // Try to find "Other" or mode
      setF("property_type", 0); // Risky but handled
    }

    // 6. Target Encoding
    // TE_price_neighbourhood_cleansed
    // TE_rev_neighbourhood_cleansed
    // TE_price_property_type
    // TE_rev_property_type
    const teMeta = typedMetadata.target_encoding;
    if (teMeta) {
      ["neighbourhood_cleansed", "property_type"].forEach((col) => {
        const val = data[col as keyof PredictionFormData] as string;

        // For Price
        const priceMap = teMeta[col]?.price?.map;
        const priceGlobal = teMeta[col]?.price?.global_mean;
        setF(`TE_price_${col}`, priceMap?.[val] ?? priceGlobal);

        // For Revenue
        const revMap = teMeta[col]?.rev?.map;
        const revGlobal = teMeta[col]?.rev?.global_mean;
        setF(`TE_rev_${col}`, revMap?.[val] ?? revGlobal);
      });
    }

    // 7. Text Features
    // name and description are now character counts (numbers)
    const nameLen = data.name ?? medians["name_len"] ?? 20;
    const descLen = data.description ?? medians["desc_len"] ?? 100;

    setF("name_len", nameLen);
    setF("desc_len", descLen);

    // Keyword features are set to 0 since we only have character counts, not actual text
    const keywords = [
      "view",
      "luxury",
      "ocean",
      "downtown",
      "renovated",
      "private",
      "quiet",
      "garden",
      "spacious",
    ];
    keywords.forEach((k) => {
      setF(`txt_${k}`, 0);
    });

    // 8. Computed Features
    // Distance
    const downtown_lat = 49.2819;
    const downtown_lon = -123.1187;
    const dist = Math.sqrt(
      Math.pow((data.latitude - downtown_lat) * 111, 2) +
        Math.pow((data.longitude - downtown_lon) * 78, 2)
    );
    setF("dist_to_downtown", dist);

    // Interactions
    setF(
      "quality_popularity",
      data.review_scores_rating * data.reviews_per_month
    );

    const beds = Math.max(data.bedrooms, 1);
    const baths = Math.max(data.bathrooms, 1);
    setF("people_per_bedroom", data.accommodates / beds);
    setF("people_per_bath", data.accommodates / baths);

    // FILL ARRAY
    for (let i = 0; i < featureNames.length; i++) {
      const name = featureNames[i];
      const val = featureMap.get(name);
      feats[i] = val !== undefined ? val : 0;
    }

    return feats;
  }

  async predict(data: PredictionFormData): Promise<PredictionResult> {
    try {
      if (!this.initialized) {
        console.log("Initializing inference engine...");
        await this.init();
      }

      console.log("Preparing features...");
      const feats = this.prepareFeatures(data);

      // Create Tensor
      const tensor = new this.ort.Tensor("float32", feats, [1, feats.length]);
      const feeds = { float_input: tensor }; // 'float_input' is the name defined in main.py export

      console.log("Running inference...");

      // Run Inference
      // Price
      const priceResults = await this.sessions["Price_Model"].run(feeds);

      // Revenue
      const revenueResults = await this.sessions["Revenue_Model"].run(feeds);

      // Helper to extract value from tensor
      const getVal = (tensor: any) => {
        const val = tensor.data as Float32Array;
        return val[0];
      };

      const processResults = (
        results: Record<string, any>,
        prefix: string,
        isLogPoint: boolean
      ) => {
        const distribution: Record<string, number> = {};
        let point = 0;
        let lower = 0;
        let upper = 0;

        // 1. Extract raw values
        const quantiles: { p: number; val: number }[] = [];

        Object.keys(results).forEach((key) => {
          if (!key.includes(prefix)) return;

          const rawVal = getVal(results[key]);
          let finalVal = rawVal;

          // Apply inverse transform ONLY for Point if isLogPoint is true.
          // Quantile models were trained on linear target, so no transform needed.
          if (key.includes("Point") && isLogPoint) {
            finalVal = Math.expm1(rawVal);
          }

          finalVal = Math.round(finalVal);

          if (key.includes("Point")) {
            // Point estimate
            // Handle duplicates if any (last one wins)
            distribution["Point"] = finalVal;
            point = finalVal;
          } else {
            // Quantiles
            const match = key.match(/q(\d+)/);
            if (match) {
              const p = parseInt(match[1]);
              // Store for sorting/smoothing later
              // We might have duplicates (e.g. Price_Lower_q5 vs Price_q5).
              // We'll push all and dedup by p later or just let sort handle it?
              // Better to use a map to dedup first.
            }
          }
        });

        // 2. Dedup and Collect Quantiles
        const qMap = new Map<number, number>();
        Object.keys(results).forEach((key) => {
          if (!key.includes(prefix)) return;

          let val = getVal(results[key]);
          // Only Point is log-transformed in our training setup
          if (key.includes("Point")) {
            if (isLogPoint) val = Math.expm1(val);
            distribution["Point"] = Math.round(val);
            point = Math.round(val);
            return;
          }

          // Quantiles (linear)
          const match = key.match(/q(\d+)/);
          if (match) {
            const p = parseInt(match[1]);
            qMap.set(p, Math.round(val));
          }
        });

        // 3. Enforce Monotonicity (Fix crossing quantiles)
        // Extract p and val
        const sortedPs = Array.from(qMap.keys()).sort((a, b) => a - b);
        const values = sortedPs.map((p) => qMap.get(p)!);

        // Sort values to enforce q_low <= q_high (Rearrangement)
        values.sort((a, b) => a - b);

        // 4. Re-assign to distribution
        sortedPs.forEach((p, i) => {
          const val = values[i];
          distribution[`q${p}`] = val;
          if (p === 5) lower = val;
          if (p === 95) upper = val;
        });

        return { point, lower, upper, distribution };
      };

      const result = {
        price: processResults(priceResults, "Price", true), // Price Point is log-transformed
        revenue: processResults(revenueResults, "Revenue", false), // Revenue Point is linear
      };

      console.log("Prediction completed successfully:", result);
      return result;
    } catch (e) {
      console.error("Prediction failed:", e);
      throw new Error(
        `Prediction failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

const inferenceEngine = new InferenceEngine();

export async function POST(request: NextRequest) {
  try {
    const data: PredictionFormData = await request.json();

    // Validate required fields
    if (!data.neighbourhood_cleansed || !data.property_type) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: neighbourhood_cleansed and property_type are required",
        },
        { status: 400 }
      );
    }

    // Run prediction
    const result = await inferenceEngine.predict(data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("API prediction error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Prediction failed",
      },
      { status: 500 }
    );
  }
}
