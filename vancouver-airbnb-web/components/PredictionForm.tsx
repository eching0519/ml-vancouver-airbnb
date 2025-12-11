"use client";

import {
  inferenceEngine,
  PredictionFormData,
  PredictionResult,
} from "@/lib/inference";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Controller, Resolver, useForm } from "react-hook-form";
import * as yup from "yup";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input, Label } from "./ui/form-elements";
import { Select } from "./ui/select";

// --- Constants & Data ---

const NEIGHBOURHOODS = [
  "Arbutus Ridge",
  "Downtown",
  "Downtown Eastside",
  "Dunbar Southlands",
  "Fairview",
  "Grandview-Woodland",
  "Hastings-Sunrise",
  "Kensington-Cedar Cottage",
  "Kerrisdale",
  "Killarney",
  "Kitsilano",
  "Marpole",
  "Mount Pleasant",
  "Oakridge",
  "Renfrew-Collingwood",
  "Riley Park",
  "Shaughnessy",
  "South Cambie",
  "Strathcona",
  "Sunset",
  "Victoria-Fraserview",
  "West End",
  "West Point Grey",
].sort();

const ROOM_TYPES = [
  "Entire home/apt",
  "Private room",
  "Shared room",
  "Hotel room",
];

const PROPERTY_TYPES = [
  "Entire guest suite",
  "Entire condo",
  "Entire home",
  "Private room in condo",
  "Private room in home",
  "Entire rental unit",
  "Entire loft",
  "Private room in rental unit",
  "Entire serviced apartment",
  "Entire guesthouse",
  "Room in boutique hotel",
  "Entire townhouse",
  "Other",
].sort();

const AMENITIES_LIST = [
  "Wifi",
  "Kitchen",
  "Heating",
  "Washer",
  "Dryer",
  "Air conditioning",
  "Free parking",
  "Hot tub",
  "Pool",
  "Gym",
  "Pet-friendly",
  "Self check-in",
  "Lockbox",
  "Elevator",
  "Balcony",
  "Garden",
  "BBQ grill",
  "Workspace",
];

// --- Schema ---

const schema = yup.object({
  // Common
  neighbourhood_cleansed: yup.string().required("Neighbourhood is required"),
  room_type: yup.string().required("Room type is required"),
  property_type: yup.string().required("Property type is required"),
  accommodates: yup.number().min(1).required().typeError("Must be a number"),
  bedrooms: yup.number().min(0).required().typeError("Must be a number"),
  bathrooms: yup.number().min(0).required().typeError("Must be a number"),
  beds: yup.number().min(0).required().typeError("Must be a number"),
  latitude: yup.number().required().typeError("Must be a number"),
  longitude: yup.number().required().typeError("Must be a number"),
  amenities: yup.array().of(yup.string()).required(),

  // Text Features
  name: yup.string().notRequired(),
  description: yup.string().notRequired(),

  // Price Strategy Inputs
  instant_bookable: yup.boolean().required(),
  host_is_superhost: yup.boolean().required(),
  host_identity_verified: yup.boolean().required(),
  host_experience_years: yup
    .number()
    .min(0)
    .typeError("Must be a number")
    .required(),

  // Revenue Prediction Inputs
  availability_365: yup
    .number()
    .min(0)
    .max(365)
    .required()
    .typeError("Must be a number"),
  reviews_per_month: yup
    .number()
    .min(0)
    .required()
    .typeError("Must be a number"),
  review_scores_rating: yup
    .number()
    .min(0)
    .max(5)
    .required()
    .typeError("Must be a number"),
});

// Use PredictionFormData as the base type to ensure compatibility
type FormData = PredictionFormData;

export default function PredictionForm() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema) as Resolver<FormData>,
    defaultValues: {
      amenities: [],
      accommodates: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: 1,
      latitude: 49.2827,
      longitude: -123.1207,
      host_experience_years: 0,
      availability_365: 180,
      reviews_per_month: 1,
      review_scores_rating: 4.8,
      instant_bookable: false,
      host_is_superhost: false,
      host_identity_verified: true,
      name: "",
      description: "",
      neighbourhood_cleansed: "Downtown",
      room_type: "Entire home/apt",
      property_type: "Entire condo",
    },
  });

  // Watch all form values
  const formValues = watch();

  // Update prediction on form change
  useEffect(() => {
    const updatePrediction = async () => {
      // Check if required fields are filled
      if (
        !formValues.neighbourhood_cleansed ||
        !formValues.room_type ||
        !formValues.property_type
      ) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Cast to PredictionFormData to ensure compatibility (optional text fields are handled)
        const prediction = await inferenceEngine.predict(
          formValues as PredictionFormData
        );
        setResult(prediction);
      } catch (e) {
        console.error(e);
        setError("Failed to run prediction. Please ensure models are loaded.");
      } finally {
        setLoading(false);
      }
    };

    // Debounce the prediction update
    const timeoutId = setTimeout(() => {
      updatePrediction();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formValues]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 pb-64 md:pb-96">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-8"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
            Vancouver Airbnb Strategy
          </h1>
          <p className="text-slate-500">
            Optimize your listing price and predict potential revenue.
          </p>
        </div>

        <form>
          {/* Common Fields Section */}
          <motion.div variants={itemVariants} className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Listing Title (Optional)</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Luxury Condo with Ocean View"
                      {...register("name")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="Describe the key features..."
                      {...register("description")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighbourhood">Neighbourhood</Label>
                  <Select
                    id="neighbourhood"
                    {...register("neighbourhood_cleansed")}
                  >
                    <option value="">Select Neighbourhood</option>
                    {NEIGHBOURHOODS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                  {errors.neighbourhood_cleansed && (
                    <p className="text-red-500 text-xs">
                      {errors.neighbourhood_cleansed.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="room_type">Room Type</Label>
                  <Select id="room_type" {...register("room_type")}>
                    <option value="">Select Room Type</option>
                    {ROOM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  {errors.room_type && (
                    <p className="text-red-500 text-xs">
                      {errors.room_type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="property_type">Property Type</Label>
                  <Select id="property_type" {...register("property_type")}>
                    <option value="">Select Property Type</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  {errors.property_type && (
                    <p className="text-red-500 text-xs">
                      {errors.property_type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accommodates">Accommodates</Label>
                  <Input
                    id="accommodates"
                    type="number"
                    {...register("accommodates")}
                  />
                  {errors.accommodates && (
                    <p className="text-red-500 text-xs">
                      {errors.accommodates.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    {...register("bedrooms")}
                  />
                  {errors.bedrooms && (
                    <p className="text-red-500 text-xs">
                      {errors.bedrooms.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    {...register("bathrooms")}
                  />
                  {errors.bathrooms && (
                    <p className="text-red-500 text-xs">
                      {errors.bathrooms.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="beds">Beds</Label>
                  <Input id="beds" type="number" {...register("beds")} />
                  {errors.beds && (
                    <p className="text-red-500 text-xs">
                      {errors.beds.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    {...register("latitude")}
                  />
                  {errors.latitude && (
                    <p className="text-red-500 text-xs">
                      {errors.latitude.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    {...register("longitude")}
                  />
                  {errors.longitude && (
                    <p className="text-red-500 text-xs">
                      {errors.longitude.message}
                    </p>
                  )}
                </div>
              </CardContent>

              <div className="px-6 pb-6">
                <Label className="mb-4 block">Amenities</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {AMENITIES_LIST.map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-2">
                      <Controller
                        name="amenities"
                        control={control}
                        render={({ field }) => {
                          return (
                            <Checkbox
                              id={`amenity-${amenity}`}
                              checked={field.value?.includes(amenity)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, amenity]);
                                } else {
                                  field.onChange(
                                    current.filter((v) => v !== amenity)
                                  );
                                }
                              }}
                            />
                          );
                        }}
                      />
                      <label
                        htmlFor={`amenity-${amenity}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {amenity}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Split Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Price Form */}
            <motion.div variants={itemVariants}>
              <Card className="h-full border-blue-100 shadow-blue-50/50">
                <CardHeader className="bg-blue-50/30 rounded-t-lg">
                  <CardTitle className="text-blue-900">
                    Price Strategy Inputs
                  </CardTitle>
                  <p className="text-sm text-blue-600/80">
                    Optimize for optimal nightly rate
                  </p>
                </CardHeader>
                <CardContent className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Instant Bookable</Label>
                        <p className="text-sm text-muted-foreground">
                          Allows guests to book without approval
                        </p>
                      </div>
                      <Controller
                        name="instant_bookable"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Superhost</Label>
                        <p className="text-sm text-muted-foreground">
                          Host has Superhost status
                        </p>
                      </div>
                      <Controller
                        name="host_is_superhost"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Identity Verified</Label>
                        <p className="text-sm text-muted-foreground">
                          Host identity is verified
                        </p>
                      </div>
                      <Controller
                        name="host_identity_verified"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Host Experience (Years)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        {...register("host_experience_years")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Revenue Form */}
            <motion.div variants={itemVariants}>
              <Card className="h-full border-green-100 shadow-green-50/50">
                <CardHeader className="bg-green-50/30 rounded-t-lg">
                  <CardTitle className="text-green-900">
                    Revenue Prediction Inputs
                  </CardTitle>
                  <p className="text-sm text-green-600/80">
                    Estimate annual revenue potential
                  </p>
                </CardHeader>
                <CardContent className="space-y-6 mt-6">
                  <div className="space-y-2">
                    <Label>Availability (Days per Year)</Label>
                    <Input type="number" {...register("availability_365")} />
                    <p className="text-xs text-muted-foreground">
                      How many days is the listing available?
                    </p>
                    {errors.availability_365 && (
                      <p className="text-red-500 text-xs">
                        {errors.availability_365.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Reviews per Month</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("reviews_per_month")}
                    />
                    {errors.reviews_per_month && (
                      <p className="text-red-500 text-xs">
                        {errors.reviews_per_month.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Review Rating (0-5)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      max="5"
                      {...register("review_scores_rating")}
                    />
                    {errors.review_scores_rating && (
                      <p className="text-red-500 text-xs">
                        {errors.review_scores_rating.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </form>
      </motion.div>

      {/* Fixed Results Panel at Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white shadow-2xl border-t-2 border-slate-700 z-50 max-h-[40vh] md:max-h-none overflow-y-auto"
      >
        <div className="max-w-6xl mx-auto p-3 md:p-6">
          {!result && !loading && !error && (
            <div className="text-center py-4 md:py-8">
              <h2 className="text-lg md:text-2xl font-bold mb-1 md:mb-2 text-slate-200">
                Ready to Predict
              </h2>
              <p className="text-xs md:text-base text-slate-400">
                Adjust the property details above to see your estimated revenue
                and price.
              </p>
            </div>
          )}
          {loading && (
            <div className="text-center py-4 md:py-8">
              <p className="text-sm md:text-lg">Analyzing...</p>
            </div>
          )}
          {error && (
            <div className="text-center py-4 md:py-8">
              <p className="text-red-400 text-sm md:text-lg">{error}</p>
            </div>
          )}
          {result && !loading && (
            <>
              <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-6 text-center">
                Prediction Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 text-center">
                <div className="p-3 md:p-6 bg-slate-800 rounded-lg">
                  <p className="text-blue-400 font-medium mb-1 md:mb-2 text-xs md:text-base">
                    Suggested Nightly Price
                  </p>
                  <p className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">
                    ${result.price.point}
                  </p>
                  <p className="text-slate-400 text-xs md:text-sm">
                    Range: ${result.price.lower} - ${result.price.upper}
                  </p>
                </div>
                <div className="p-3 md:p-6 bg-slate-800 rounded-lg">
                  <p className="text-green-400 font-medium mb-1 md:mb-2 text-xs md:text-base">
                    Est. Annual Revenue
                  </p>
                  <p className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">
                    ${result.revenue.point.toLocaleString()}
                  </p>
                  <p className="text-slate-400 text-xs md:text-sm">
                    Range: ${result.revenue.lower.toLocaleString()} - $
                    {result.revenue.upper.toLocaleString()}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
