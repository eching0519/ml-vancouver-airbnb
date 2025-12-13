"use client";

import { getNeighbourhoodCentroid, NeighbourhoodGeoJSON } from "@/lib/geoUtils";
import {
  inferenceEngine,
  PredictionFormData,
  PredictionResult,
} from "@/lib/inference";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import { ChartColumnBig, ChevronDown, ChevronUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, Resolver, useForm } from "react-hook-form";
import * as yup from "yup";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

// Dynamically import map to avoid SSR issues
const NeighbourhoodMap = dynamic(() => import("./NeighbourhoodMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center text-muted-foreground">
      Loading Map...
    </div>
  ),
});

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

// Property type to room type mapping (moved to backend)
// This list is used only for the property type dropdown
const PROPERTY_TYPES = [
  "Camper/RV",
  "Cave",
  "Earthen home",
  "Entire bungalow",
  "Entire condo",
  "Entire cottage",
  "Entire guest suite",
  "Entire guesthouse",
  "Entire home",
  "Entire loft",
  "Entire place",
  "Entire rental unit",
  "Entire serviced apartment",
  "Entire townhouse",
  "Entire vacation home",
  "Entire villa",
  "Houseboat",
  "Private room in bed and breakfast",
  "Private room in boat",
  "Private room in bungalow",
  "Private room in camper/rv",
  "Private room in condo",
  "Private room in guest suite",
  "Private room in guesthouse",
  "Private room in home",
  "Private room in hostel",
  "Private room in loft",
  "Private room in rental unit",
  "Private room in resort",
  "Private room in serviced apartment",
  "Private room in tiny home",
  "Private room in tower",
  "Private room in townhouse",
  "Private room in villa",
  "Riad",
  "Room in aparthotel",
  "Room in bed and breakfast",
  "Room in boutique hotel",
  "Room in hotel",
  "Shared room in barn",
  "Shared room in condo",
  "Shared room in home",
  "Shared room in hostel",
  "Shared room in hotel",
  "Shared room in loft",
  "Shared room in rental unit",
  "Shared room in tiny home",
  "Tiny home",
  "Tower",
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
  property_type: yup.string().required("Property type is required"),
  accommodates: yup.number().min(1).required().typeError("Must be a number"),
  bedrooms: yup.number().min(0).required().typeError("Must be a number"),
  bathrooms: yup.number().min(0).required().typeError("Must be a number"),
  beds: yup.number().min(0).required().typeError("Must be a number"),
  latitude: yup.number().required().typeError("Must be a number"),
  longitude: yup.number().required().typeError("Must be a number"),
  amenities: yup.array().of(yup.string()).required(),

  // Text Features (character counts)
  name: yup.number().min(0).notRequired().typeError("Must be a number"),
  description: yup.number().min(0).notRequired().typeError("Must be a number"),

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

// --- Helper Components ---

const DistributionChart = ({
  data,
  colorClass,
  label,
  hideLabel = false,
}: {
  data: Record<string, number>;
  colorClass: string;
  label: string;
  hideLabel?: boolean;
}) => {
  // Extract and sort percentiles
  const percentiles = Object.keys(data)
    .filter((k) => k.startsWith("q"))
    .map((k) => parseInt(k.substring(1)))
    .sort((a, b) => a - b);

  if (percentiles.length === 0) return null;

  const values = percentiles.map((p) => data[`q${p}`]);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values); // Could be negative for revenue

  return (
    <div className="mt-4">
      {!hideLabel && (
        <p className="text-xs text-muted-foreground mb-2 text-left">
          {label} Distribution
        </p>
      )}
      <div className="flex items-end space-x-1 h-32 w-full">
        {percentiles.map((p) => {
          const val = data[`q${p}`];
          // Top X% = 100 - p
          const topPercent = 100 - p;

          // Normalize height. If val is negative, we might want to show it differently,
          // but for simplicity let's just clamp to 0 for height and maybe use color to indicate?
          // Actually, let's just make it relative to max.
          // If val < 0, height = 0? Or maybe a small bar going down?
          // Let's assume mostly positive for Price. Revenue might be negative.

          const heightPercent = Math.max(
            5,
            (Math.abs(val) / Math.max(Math.abs(maxVal), Math.abs(minVal))) * 100
          );

          return (
            <div
              key={p}
              className="flex-1 group relative flex flex-col justify-end h-full"
            >
              <div
                className={`w-full rounded-t ${colorClass} ${
                  val < 0 ? "opacity-30 bg-destructive" : "opacity-60"
                } group-hover:opacity-100 transition-all cursor-pointer`}
                style={{ height: `${heightPercent}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-primary text-primary-foreground text-xs p-2 rounded shadow-xl z-20 pointer-events-none border border-primary/50">
                <p className="font-bold text-primary-foreground">
                  Top {topPercent}% Performer
                </p>
                <p
                  className={`text-sm ${
                    val < 0 ? "text-red-400" : "text-primary-foreground"
                  }`}
                >
                  ${val.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
        <span>Top 95%</span>
        <span>Top 5%</span>
      </div>
    </div>
  );
};

export default function PredictionForm() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<"price" | "revenue" | null>(
    null
  );
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(true);
  const [geoJsonData, setGeoJsonData] = useState<NeighbourhoodGeoJSON | null>(
    null
  );

  const {
    register,
    control,
    watch,
    setValue,
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
      name: 30,
      description: 300,
      neighbourhood_cleansed: "Downtown",
      property_type: "Entire condo",
    },
  });

  // Fetch GeoJSON on mount
  useEffect(() => {
    fetch("/neighbourhoods.geojson")
      .then((res) => res.json())
      .then((data) => {
        setGeoJsonData(data);
      })
      .catch((err) => console.error("Failed to load map data", err));
  }, []);

  // Watch all form values
  const formValues = watch();

  // Watch neighbourhood changes to update lat/long
  const selectedNeighbourhood = watch("neighbourhood_cleansed");

  useEffect(() => {
    if (selectedNeighbourhood && geoJsonData) {
      const centroid = getNeighbourhoodCentroid(
        geoJsonData,
        selectedNeighbourhood
      );
      if (centroid) {
        setValue("latitude", centroid.lat);
        setValue("longitude", centroid.lng);
      }
    }
  }, [selectedNeighbourhood, geoJsonData, setValue]);

  // Memoize form values to prevent unnecessary re-renders
  // Serialize to string for stable comparison
  const formValuesString = useMemo(() => {
    return JSON.stringify(formValues);
  }, [formValues]);

  // Track previous form values to prevent duplicate predictions
  const prevFormValuesRef = useRef<string>("");

  // Update prediction on form change
  useEffect(() => {
    // Skip if form values haven't actually changed
    if (formValuesString === prevFormValuesRef.current) {
      return;
    }

    // Update the ref
    prevFormValuesRef.current = formValuesString;

    // Capture current form values to avoid stale closure
    const currentFormValues = formValues;

    const updatePrediction = async () => {
      // Check if required fields are filled
      if (
        !currentFormValues.neighbourhood_cleansed ||
        !currentFormValues.property_type
      ) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Cast to PredictionFormData to ensure compatibility (optional text fields are handled)
        const prediction = await inferenceEngine.predict(
          currentFormValues as PredictionFormData
        );
        setResult(prediction);
        // Auto-expand panel when results arrive
        setIsResultsPanelOpen(true);
      } catch (e) {
        console.error("Prediction error:", e);
        setError(
          `Failed to run prediction: ${
            e instanceof Error ? e.message : "Please ensure models are loaded."
          }`
        );
      } finally {
        setLoading(false);
      }
    };

    // Debounce the prediction update
    const timeoutId = setTimeout(() => {
      updatePrediction();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValuesString]);

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
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
            Vancasa Airbnb Strategy
          </h1>
          <p className="text-muted-foreground">
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
                <div className="space-y-2">
                  <Label htmlFor="neighbourhood">Neighbourhood</Label>
                  <Controller
                    name="neighbourhood_cleansed"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onValueChange={(val: string) => {
                          field.onChange(val);
                          // Centroid update handled by useEffect
                        }}
                      >
                        <SelectTrigger id="neighbourhood">
                          <SelectValue placeholder="Select Neighbourhood" />
                        </SelectTrigger>
                        <SelectContent>
                          {NEIGHBOURHOODS.map((n) => (
                            <SelectItem key={n} value={n}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.neighbourhood_cleansed && (
                    <p className="text-red-500 text-xs">
                      {errors.neighbourhood_cleansed.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="property_type">Property Type</Label>
                  <Controller
                    name="property_type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="property_type">
                          <SelectValue placeholder="Select Property Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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

                {/* Map Section */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <NeighbourhoodMap
                    geoJsonData={geoJsonData}
                    selectedNeighbourhood={selectedNeighbourhood}
                    onSelectNeighbourhood={(name, lat, lng) => {
                      setValue("neighbourhood_cleansed", name);
                      setValue("latitude", lat);
                      setValue("longitude", lng);
                    }}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs text-muted-foreground/70">
                      Lat: {watch("latitude").toFixed(4)}, Lng:{" "}
                      {watch("longitude").toFixed(4)}
                    </div>
                  </div>
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

                {/* Hidden Lat/Long Fields */}
                <input type="hidden" {...register("latitude")} />
                <input type="hidden" {...register("longitude")} />
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
                              onCheckedChange={(checked: boolean) => {
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

          {/* Host & Booking Settings */}
          <motion.div variants={itemVariants} className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Host & Booking Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="name">Title Length</Label>
                  <Input
                    id="name"
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    {...register("name")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of characters in the listing title
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description Length</Label>
                  <Input
                    id="description"
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    {...register("description")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of characters in the listing description
                  </p>
                </div>
              </CardContent>
              <CardContent className="space-y-4">
                <Controller
                  name="instant_bookable"
                  control={control}
                  render={({ field }) => (
                    <div
                      className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={(e) => {
                        // Only toggle if clicking outside the checkbox
                        const target = e.target as HTMLElement;
                        if (
                          !target.closest('[role="checkbox"]') &&
                          !target.closest("button")
                        ) {
                          field.onChange(!field.value);
                        }
                      }}
                    >
                      <div className="space-y-0.5">
                        <Label className="text-base">Instant Bookable</Label>
                        <p className="text-sm text-muted-foreground">
                          Allows guests to book without approval
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked: boolean) => {
                            if (checked !== field.value) {
                              field.onChange(checked);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                />

                <Controller
                  name="host_is_superhost"
                  control={control}
                  render={({ field }) => (
                    <div
                      className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={(e) => {
                        // Only toggle if clicking outside the checkbox
                        const target = e.target as HTMLElement;
                        if (
                          !target.closest('[role="checkbox"]') &&
                          !target.closest("button")
                        ) {
                          field.onChange(!field.value);
                        }
                      }}
                    >
                      <div className="space-y-0.5">
                        <Label className="text-base">Superhost</Label>
                        <p className="text-sm text-muted-foreground">
                          Host has Superhost status
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked: boolean) => {
                            if (checked !== field.value) {
                              field.onChange(checked);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                />

                <Controller
                  name="host_identity_verified"
                  control={control}
                  render={({ field }) => (
                    <div
                      className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={(e) => {
                        // Only toggle if clicking outside the checkbox
                        const target = e.target as HTMLElement;
                        if (
                          !target.closest('[role="checkbox"]') &&
                          !target.closest("button")
                        ) {
                          field.onChange(!field.value);
                        }
                      }}
                    >
                      <div className="space-y-0.5">
                        <Label className="text-base">Identity Verified</Label>
                        <p className="text-sm text-muted-foreground">
                          Host identity is verified
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked: boolean) => {
                            if (checked !== field.value) {
                              field.onChange(checked);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                />

                <div className="space-y-2">
                  <Label>Host Experience (Years)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    {...register("host_experience_years")}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Listing Performance */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Listing Performance</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </form>
      </motion.div>

      {/* Sticky Collapsible Results Panel at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <Collapsible
          open={isResultsPanelOpen}
          onOpenChange={setIsResultsPanelOpen}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary text-primary-foreground shadow-2xl border-t-2 border-primary/50"
          >
            <CollapsibleTrigger asChild>
              <Button className="w-full flex items-center justify-between p-3 hover:bg-white/10 rounded-none text-primary-foreground bg-transparent">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-sm font-semibold text-primary-foreground">
                    {result && !loading
                      ? "Prediction Results"
                      : !result && !loading && !error
                      ? "Ready to Predict"
                      : loading
                      ? "Analyzing..."
                      : "Error"}
                  </span>
                  {!isResultsPanelOpen && result && !loading && (
                    <div className="flex items-center gap-6 text-xs md:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-primary-foreground/80 font-medium">
                          Price:
                        </span>
                        <span className="font-bold text-primary-foreground">
                          ${result.price.point}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-primary-foreground/80 font-medium">
                          Revenue:
                        </span>
                        <span className="font-bold text-primary-foreground">
                          ${result.revenue.point.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {isResultsPanelOpen ? (
                  <ChevronDown className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-primary-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className="max-h-[40vh] md:max-h-[60vh] overflow-y-auto">
                <div className="max-w-6xl mx-auto p-3 md:p-6">
                  {!result && !loading && !error && (
                    <Alert className="bg-card border-border text-card-foreground">
                      <AlertTitle className="text-lg md:text-2xl font-bold mb-1 md:mb-2 text-foreground">
                        Ready to Predict
                      </AlertTitle>
                      <AlertDescription className="text-xs md:text-base text-foreground/80">
                        Adjust the property details above to see your estimated
                        revenue and price.
                      </AlertDescription>
                    </Alert>
                  )}
                  {loading && (
                    <Alert className="bg-card border-border text-card-foreground">
                      <AlertDescription className="text-sm md:text-lg text-center">
                        Analyzing...
                      </AlertDescription>
                    </Alert>
                  )}
                  {error && (
                    <Alert
                      variant="destructive"
                      className="bg-destructive/10 border-destructive/50"
                    >
                      <AlertTitle className="text-destructive">
                        Error
                      </AlertTitle>
                      <AlertDescription className="text-destructive text-sm md:text-lg">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                  {result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                      <Card className="bg-card border-border text-center min-h-[140px] md:min-h-[180px]">
                        <CardContent className="p-3 md:p-6">
                          <p className="text-primary font-medium mb-1 md:mb-2 text-xs md:text-base">
                            Suggested Nightly Price
                          </p>
                          <p className="text-2xl md:text-5xl font-bold mb-1 md:mb-2 text-foreground">
                            ${result.price.point}
                          </p>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <p className="text-foreground/70 text-xs md:text-sm">
                              Range: ${result.price.lower} - $
                              {result.price.upper}
                            </p>
                            <Button
                              onClick={() => setActiveChart("price")}
                              className="h-8 w-8 text-foreground/70 hover:text-primary hover:bg-primary/20 hover:border hover:border-primary/30 bg-transparent"
                              title="View Distribution"
                            >
                              <ChartColumnBig className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border text-center min-h-[140px] md:min-h-[180px]">
                        <CardContent className="p-3 md:p-6">
                          <p className="text-secondary font-medium mb-1 md:mb-2 text-xs md:text-base">
                            Est. Annual Revenue
                          </p>
                          <p className="text-2xl md:text-5xl font-bold mb-1 md:mb-2 text-foreground">
                            ${result.revenue.point.toLocaleString()}
                          </p>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <p className="text-foreground/70 text-xs md:text-sm">
                              Range: ${result.revenue.lower.toLocaleString()} -
                              ${result.revenue.upper.toLocaleString()}
                            </p>
                            <Button
                              onClick={() => setActiveChart("revenue")}
                              className="h-8 w-8 text-foreground/70 hover:text-secondary hover:bg-secondary/20 hover:border hover:border-secondary/30 bg-transparent"
                              title="View Distribution"
                            >
                              <ChartColumnBig className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </motion.div>
        </Collapsible>
      </div>

      {/* Chart Dialog */}
      <Dialog
        open={!!activeChart}
        onOpenChange={(open: boolean) => !open && setActiveChart(null)}
      >
        <DialogContent className="bg-card border-border text-card-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-card-foreground">
              {activeChart === "price"
                ? "Price Distribution"
                : "Revenue Distribution"}
            </DialogTitle>
          </DialogHeader>
          {result && activeChart === "price" && (
            <DistributionChart
              data={result.price.distribution}
              colorClass="bg-accent"
              label="Price"
              hideLabel
            />
          )}
          {result && activeChart === "revenue" && (
            <DistributionChart
              data={result.revenue.distribution}
              colorClass="bg-secondary"
              label="Revenue"
              hideLabel
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
