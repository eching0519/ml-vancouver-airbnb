"use client";

import { NeighbourhoodGeoJSON, getNeighbourhoodCentroid } from "@/lib/geoUtils";
import { PredictionFormData, PredictionResult } from "@/lib/inference";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import { BarChart2, ChevronDown, ChevronUp } from "lucide-react";
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
    <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">
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
        <p className="text-xs text-slate-400 mb-2 text-left">
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
                  val < 0 ? "opacity-30 bg-red-500" : "opacity-60"
                } group-hover:opacity-100 transition-all cursor-pointer`}
                style={{ height: `${heightPercent}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-slate-950 text-white text-xs p-2 rounded shadow-xl z-20 pointer-events-none border border-slate-700">
                <p className="font-bold text-slate-200">
                  Top {topPercent}% Performer
                </p>
                <p
                  className={`text-sm ${
                    val < 0 ? "text-red-400" : "text-white"
                  }`}
                >
                  ${val.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
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
      name: "",
      description: "",
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
        // Only update if significantly different to avoid loops (though check won't hurt)
        // Actually, we just enforce the centroid when neighbourhood changes.
        // But we need to be careful not to overwrite user input if they had a way to input custom lat/long.
        // Since we removed the inputs, we can just overwrite.
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
        // Call the API for prediction
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentFormValues as PredictionFormData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Prediction failed");
        }

        const prediction: PredictionResult = await response.json();
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

                {/* Map Section */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <Label className="mb-2 block">Location</Label>
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
                    <p className="text-xs text-slate-500">
                      Select a neighbourhood on the map or use the dropdown.
                    </p>
                    <div className="text-xs text-slate-400">
                      Lat: {watch("latitude").toFixed(4)}, Lng:{" "}
                      {watch("longitude").toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighbourhood">Neighbourhood</Label>
                  <Controller
                    name="neighbourhood_cleansed"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onValueChange={(val) => {
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
                              onCheckedChange={(checked) => {
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
                            onCheckedChange={field.onChange}
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
                            onCheckedChange={field.onChange}
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
                            onCheckedChange={field.onChange}
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

      {/* Sticky Collapsible Results Panel at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <Collapsible
          open={isResultsPanelOpen}
          onOpenChange={setIsResultsPanelOpen}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 text-white shadow-2xl border-t-2 border-slate-700"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-3 hover:bg-slate-800 rounded-none"
              >
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-sm font-semibold">
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
                        <span className="text-blue-400 font-medium">
                          Price:
                        </span>
                        <span className="font-bold">${result.price.point}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-medium">
                          Revenue:
                        </span>
                        <span className="font-bold">
                          ${result.revenue.point.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {isResultsPanelOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className="max-h-[40vh] md:max-h-[60vh] overflow-y-auto">
                <div className="max-w-6xl mx-auto p-3 md:p-6">
                  {!result && !loading && !error && (
                    <Alert className="bg-slate-800 border-slate-700 text-slate-200">
                      <AlertTitle className="text-lg md:text-2xl font-bold mb-1 md:mb-2">
                        Ready to Predict
                      </AlertTitle>
                      <AlertDescription className="text-xs md:text-base text-slate-400">
                        Adjust the property details above to see your estimated
                        revenue and price.
                      </AlertDescription>
                    </Alert>
                  )}
                  {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                      <Card className="bg-slate-800 border-slate-700 text-center min-h-[140px] md:min-h-[180px]">
                        <CardContent className="p-3 md:p-6 h-full flex items-center justify-center">
                          <div className="animate-pulse space-y-3 w-full">
                            <div className="h-4 bg-slate-700 rounded w-3/4 mx-auto"></div>
                            <div className="h-12 bg-slate-700 rounded w-1/2 mx-auto"></div>
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-4 bg-slate-700 rounded flex-1"></div>
                              <div className="h-8 w-8 bg-slate-700 rounded shrink-0"></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-800 border-slate-700 text-center min-h-[140px] md:min-h-[180px]">
                        <CardContent className="p-3 md:p-6 h-full flex items-center justify-center">
                          <div className="animate-pulse space-y-3 w-full">
                            <div className="h-4 bg-slate-700 rounded w-3/4 mx-auto"></div>
                            <div className="h-12 bg-slate-700 rounded w-1/2 mx-auto"></div>
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-4 bg-slate-700 rounded flex-1"></div>
                              <div className="h-8 w-8 bg-slate-700 rounded shrink-0"></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  {error && (
                    <Alert
                      variant="destructive"
                      className="bg-slate-800 border-red-500/50"
                    >
                      <AlertTitle className="text-red-400">Error</AlertTitle>
                      <AlertDescription className="text-red-400 text-sm md:text-lg">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                  {result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                      <Card className="bg-slate-800 border-slate-700 text-center min-h-[140px] md:min-h-[180px]">
                        <CardContent className="p-3 md:p-6">
                          <p className="text-blue-400 font-medium mb-1 md:mb-2 text-xs md:text-base">
                            Suggested Nightly Price
                          </p>
                          <p className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">
                            ${result.price.point}
                          </p>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <p className="text-slate-400 text-xs md:text-sm">
                              Range: ${result.price.lower} - $
                              {result.price.upper}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setActiveChart("price")}
                              className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-slate-700"
                              title="View Distribution"
                            >
                              <BarChart2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-800 border-slate-700 text-center min-h-[140px] md:min-h-[180px]">
                        <CardContent className="p-3 md:p-6">
                          <p className="text-green-400 font-medium mb-1 md:mb-2 text-xs md:text-base">
                            Est. Annual Revenue
                          </p>
                          <p className="text-2xl md:text-5xl font-bold mb-1 md:mb-2">
                            ${result.revenue.point.toLocaleString()}
                          </p>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <p className="text-slate-400 text-xs md:text-sm">
                              Range: ${result.revenue.lower.toLocaleString()} -
                              ${result.revenue.upper.toLocaleString()}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setActiveChart("revenue")}
                              className="h-8 w-8 text-slate-400 hover:text-green-400 hover:bg-slate-700"
                              title="View Distribution"
                            >
                              <BarChart2 className="h-4 w-4" />
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
        onOpenChange={(open) => !open && setActiveChart(null)}
      >
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              {activeChart === "price"
                ? "Price Distribution"
                : "Revenue Distribution"}
            </DialogTitle>
          </DialogHeader>
          {result && activeChart === "price" && (
            <DistributionChart
              data={result.price.distribution}
              colorClass="bg-blue-500"
              label="Price"
              hideLabel
            />
          )}
          {result && activeChart === "revenue" && (
            <DistributionChart
              data={result.revenue.distribution}
              colorClass="bg-green-500"
              label="Revenue"
              hideLabel
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
