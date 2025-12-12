/* eslint-disable @typescript-eslint/no-explicit-any */
import metadata from "./models_metadata.json";

// Configure ONNX Runtime to look for wasm files in public folder
// Moved to init to ensure proper loading

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

export interface PredictionFormData {
  neighbourhood_cleansed: string;
  room_type: string;
  property_type: string;
  accommodates: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  latitude: number;
  longitude: number;
  amenities: string[];

  // Optional Text Fields (will default to empty if not provided)
  name?: string;
  description?: string;

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
  };
  revenue: {
    point: number;
    lower: number;
    upper: number;
  };
}

export class InferenceEngine {
  private ort: any = null;
  private sessions: Record<string, any> = {};
  private initialized = false;

  async init() {
    if (this.initialized) return;

    try {
      // Load ONNX runtime via dynamic import for better compatibility across hosting platforms
      this.ort = await import("onnxruntime-web");
      console.log("Loaded ONNX runtime via dynamic import");

      if (!this.ort) {
        throw new Error("ONNX Runtime could not be loaded");
      }

      // Configure ONNX Runtime for production deployment
      this.ort.env.wasm.numThreads = 1;
      this.ort.env.wasm.proxy = false;
      this.ort.env.logLevel = "error";

      // Configure WASM paths for deployment compatibility
      // Try multiple approaches for better compatibility across hosting platforms
      try {
        this.ort.env.wasm.wasmPaths = {
          "ort-wasm.wasm": "/ort-wasm.wasm",
          "ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
          "ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
          "ort-wasm-simd-threaded.wasm": "/ort-wasm-simd-threaded.wasm",
        };
      } catch (wasmPathError) {
        console.warn("Failed to set custom WASM paths, using defaults:", wasmPathError);
      }

      const modelNames = [
        "Price_Point",
        "Price_Lower_q5",
        "Price_Upper_q95",
        "Revenue_Point",
        "Revenue_Lower_q5",
        "Revenue_Upper_q95",
      ];

      const promises = modelNames.map(async (name) => {
        try {
          const url = `/models/${name}.onnx`;
          console.log(`Loading model: ${url}`);

          const session = await this.ort.InferenceSession.create(url, {
            executionProviders: ["wasm"],
            logSeverityLevel: 3,
            graphOptimizationLevel: "all", // Optimize for production
          });

          this.sessions[name] = session;
          console.log(`Successfully loaded model: ${name}`);
        } catch (modelError) {
          console.error(`Failed to load model ${name}:`, modelError);
          throw new Error(`Failed to load model ${name}: ${modelError instanceof Error ? modelError.message : String(modelError)}`);
        }
      });

      await Promise.all(promises);
      this.initialized = true;
      console.log("ONNX inference engine initialized successfully");
    } catch (e) {
      console.error("Failed to initialize ONNX sessions:", e);
      throw new Error(`Inference engine initialization failed: ${e instanceof Error ? e.message : String(e)}`);
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
    // Form values: 'Entire home/apt', etc.
    setF(`rt_${data.room_type}`, 1);

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
    const name = data.name || "";
    const desc = data.description || "";

    setF("name_len", name.length || medians["name_len"] || 20); // Fallback
    setF("desc_len", desc.length || medians["desc_len"] || 100);

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
      const hasKw =
        this.getKeywordFeature(name, k) || this.getKeywordFeature(desc, k);
      setF(`txt_${k}`, hasKw);
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
      const [pPoint, pLower, pUpper] = await Promise.all([
        this.sessions["Price_Point"].run(feeds),
        this.sessions["Price_Lower_q5"].run(feeds),
        this.sessions["Price_Upper_q95"].run(feeds),
      ]);

      // Revenue
      const [rPoint, rLower, rUpper] = await Promise.all([
        this.sessions["Revenue_Point"].run(feeds),
        this.sessions["Revenue_Lower_q5"].run(feeds),
        this.sessions["Revenue_Upper_q95"].run(feeds),
      ]);

      // Extract values (output name is usually 'variable' or similar, check map or index 0)
      // LightGBM ONNX export usually outputs 'label' or 'variable'.
      // Let's check the result object keys or just use values().next().value
      const getVal = (res: Record<string, any>) => {
        const val = res[Object.keys(res)[0]].data as Float32Array;
        return val[0];
      };

      const result = {
        price: {
          point: Math.round(Math.expm1(getVal(pPoint))),
          lower: Math.round(getVal(pLower)),
          upper: Math.round(getVal(pUpper)),
        },
        revenue: {
          point: Math.round(getVal(rPoint)),
          lower: Math.round(getVal(rLower)),
          upper: Math.round(getVal(rUpper)),
        },
      };

      console.log("Prediction completed successfully:", result);
      return result;

    } catch (e) {
      console.error("Prediction failed:", e);
      throw new Error(`Prediction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Test initialization method for debugging
  async testInit(): Promise<boolean> {
    try {
      await this.init();
      return true;
    } catch (e) {
      console.error("Initialization test failed:", e);
      return false;
    }
  }
}

export const inferenceEngine = new InferenceEngine();
