"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type {
  CheckPriceResponse,
  CreatePlanRequest,
  IspPool,
  PlanDuration,
  ProductType,
} from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── product categories ───────────────────────────────────────────────────────
// Derived directly from the API spec's CreatePlanRequest description.

// Always bandwidth-billed: require bandwidth_gb
const BANDWIDTH_PRODUCTS = [
  "residential-lite",
  "residential",
  "mobile",
  "mobile_usa",
  "pool1",
  "pool2",
  "pool3",
  "pool4",
  "pool5",
] as const;

// Hybrid: require billing_type ("bandwidth" → bandwidth_gb, "time" → duration + mbps)
const HYBRID_PRODUCTS = [
  "datacenter",
  "shared_isp",
  "ipv6-residential",
  "ipv6-datacenter",
] as const;

// unlimited_residential: trial → just duration:"trial"; full → duration + bandwidth_mbps
// dedicated_isp: quantity + pool (from GET /proxies/pools)

const BANDWIDTH_SET = new Set<string>(BANDWIDTH_PRODUCTS);
const HYBRID_SET = new Set<string>(HYBRID_PRODUCTS);
// Only these products expose an optional location field
const LOCATION_SET = new Set<string>(["datacenter", "shared_isp"]);

const ALL_PRODUCTS = [
  ...BANDWIDTH_PRODUCTS,
  ...HYBRID_PRODUCTS,
  "unlimited_residential",
  "dedicated_isp",
] as readonly [ProductType, ...ProductType[]];

const PRODUCT_LABELS: Record<string, string> = {
  "residential-lite": "Residential Lite",
  residential: "Residential",
  mobile: "Mobile",
  mobile_usa: "Mobile USA",
  datacenter: "Datacenter",
  shared_isp: "Shared ISP",
  "ipv6-residential": "IPv6 Residential",
  "ipv6-datacenter": "IPv6 Datacenter",
  unlimited_residential: "Unlimited Residential",
  dedicated_isp: "Dedicated ISP",
  pool1: "Residential Pool 1",
  pool2: "Residential Pool 2",
  pool3: "Residential Pool 3",
  pool4: "Residential Pool 4",
  pool5: "Residential Pool 5",
};

const PRODUCT_GROUPS = [
  {
    label: "Residential",
    products: ["residential-lite", "residential", "mobile", "mobile_usa", "unlimited_residential"],
  },
  {
    label: "Datacenter / ISP",
    products: ["datacenter", "shared_isp", "ipv6-residential", "ipv6-datacenter", "dedicated_isp"],
  },
  {
    label: "Residential Pools",
    products: ["pool1", "pool2", "pool3", "pool4", "pool5"],
  },
];

// "trial" is only valid for unlimited_residential
// "1_hour" is only valid for hybrid (datacenter, shared_isp, ipv6-*)
const HYBRID_DURATION_OPTIONS: { value: PlanDuration; label: string }[] = [
  { value: "1_hour", label: "1 Hour" },
  { value: "1_day", label: "1 Day" },
  { value: "7_days", label: "7 Days" },
  { value: "14_days", label: "14 Days" },
  { value: "30_days", label: "30 Days" },
  { value: "60_days", label: "60 Days" },
  { value: "90_days", label: "90 Days" },
];

const UNLIMITED_DURATION_OPTIONS: { value: PlanDuration; label: string }[] = [
  { value: "trial", label: "Trial (1 hour, 200 Mbps)" },
  { value: "1_day", label: "1 Day" },
  { value: "7_days", label: "7 Days" },
  { value: "14_days", label: "14 Days" },
  { value: "30_days", label: "30 Days" },
  { value: "60_days", label: "60 Days" },
  { value: "90_days", label: "90 Days" },
];

const DURATION_ENUM = [
  "trial",
  "1_hour",
  "1_day",
  "7_days",
  "14_days",
  "30_days",
  "60_days",
  "90_days",
] as const;

// ─── form schema ──────────────────────────────────────────────────────────────

// Base object defined separately so FormValues can be typed before superRefine helpers
const baseFormSchema = z.object({
  product: z.enum(ALL_PRODUCTS, { error: "Select a product." }),
  bandwidth_gb: z
    .number({ error: "Enter a whole number." })
    .int("Must be a whole number.")
    .min(1, "At least 1 GB.")
    .optional(),
  billing_type: z.enum(["bandwidth", "time"]).optional(),
  duration: z.enum(DURATION_ENUM).optional(),
  mbps: z
    .number({ error: "Enter Mbps." })
    .int("Must be a whole number.")
    .min(10, "Minimum 10 Mbps.")
    .max(10000, "Maximum 10,000 Mbps.")
    .optional(),
  bandwidth_mbps: z
    .number({ error: "Enter Mbps." })
    .int("Must be a whole number.")
    .min(200, "Minimum 200 Mbps.")
    .max(3000, "Maximum 3,000 Mbps.")
    .optional(),
  quantity: z
    .number({ error: "Enter a quantity." })
    .int("Must be a whole number.")
    .min(1, "At least 1.")
    .optional(),
  pool: z.string().optional(),
  location: z.enum(["NL", "UK"]).optional(),
});

type FormValues = z.infer<typeof baseFormSchema>;
type AddIssueFn = (path: string, message: string) => void;

function validateHybrid(data: FormValues, addIssue: AddIssueFn) {
  if (!data.billing_type) {
    addIssue("billing_type", "Select a billing type.");
    return;
  }
  if (data.billing_type === "bandwidth") {
    if (data.bandwidth_gb == null) addIssue("bandwidth_gb", "Required.");
    return;
  }
  if (!data.duration) addIssue("duration", "Select a duration.");
  if (data.mbps == null) addIssue("mbps", "Required.");
}

function validateUnlimited(data: FormValues, addIssue: AddIssueFn) {
  if (!data.duration) {
    addIssue("duration", "Select a duration.");
    return;
  }
  if (data.duration !== "trial" && data.bandwidth_mbps == null)
    addIssue("bandwidth_mbps", "Required.");
}

function validateDedicated(data: FormValues, addIssue: AddIssueFn) {
  if (data.quantity == null) addIssue("quantity", "Required.");
  if (!data.pool) addIssue("pool", "Select a pool.");
}

const formSchema = baseFormSchema.superRefine((data, ctx) => {
  const addIssue: AddIssueFn = (path, message) =>
    ctx.addIssue({ code: "custom", path: [path], message });
  if (!data.product) return;
  if (BANDWIDTH_SET.has(data.product)) {
    if (data.bandwidth_gb == null) addIssue("bandwidth_gb", "Required.");
  } else if (HYBRID_SET.has(data.product)) {
    validateHybrid(data, addIssue);
  } else if (data.product === "unlimited_residential") {
    validateUnlimited(data, addIssue);
  } else if (data.product === "dedicated_isp") {
    validateDedicated(data, addIssue);
  }
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function bandwidthExtras(v: FormValues): Partial<CreatePlanRequest> {
  return v.bandwidth_gb == null ? {} : { bandwidth_gb: v.bandwidth_gb };
}

function hybridExtras(v: FormValues): Partial<CreatePlanRequest> {
  if (!v.billing_type) return {};
  if (v.billing_type === "bandwidth") {
    const gb = v.bandwidth_gb == null ? {} : { bandwidth_gb: v.bandwidth_gb };
    return { billing_type: "bandwidth", ...gb };
  }
  return {
    billing_type: "time",
    ...(v.duration ? { duration: v.duration } : {}),
    ...(v.mbps == null ? {} : { mbps: v.mbps }),
  };
}

function unlimitedExtras(v: FormValues): Partial<CreatePlanRequest> {
  const extras: Partial<CreatePlanRequest> = v.duration ? { duration: v.duration } : {};
  if (v.duration !== "trial" && v.bandwidth_mbps != null) extras.bandwidth_mbps = v.bandwidth_mbps;
  return extras;
}

function dedicatedExtras(v: FormValues): Partial<CreatePlanRequest> {
  const extras: Partial<CreatePlanRequest> = {};
  if (v.quantity != null) extras.quantity = v.quantity;
  if (v.pool) extras.pool = v.pool;
  return extras;
}

function pickExtras(values: FormValues): Partial<CreatePlanRequest> {
  if (BANDWIDTH_SET.has(values.product)) return bandwidthExtras(values);
  if (HYBRID_SET.has(values.product)) return hybridExtras(values);
  if (values.product === "unlimited_residential") return unlimitedExtras(values);
  if (values.product === "dedicated_isp") return dedicatedExtras(values);
  return {};
}

function confirmLabel(confirming: boolean, priceData: CheckPriceResponse | null): string {
  if (confirming) return "Creating…";
  if (priceData) return `Confirm — charge ${priceData.cost_usd}`;
  return "Confirm & create plan";
}

function buildRequestBody(values: FormValues): CreatePlanRequest {
  return {
    product: values.product,
    ...pickExtras(values),
    ...(values.location ? { location: values.location } : {}),
  };
}

// ─── review step ──────────────────────────────────────────────────────────────

interface ReviewStepProps {
  values: FormValues;
  priceData: CheckPriceResponse | null;
  confirming: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

function ReviewStep({
  values,
  priceData,
  confirming,
  onBack,
  onConfirm,
}: Readonly<ReviewStepProps>) {
  const durationLabel =
    [...HYBRID_DURATION_OPTIONS, ...UNLIMITED_DURATION_OPTIONS].find(
      (d) => d.value === values.duration,
    )?.label ?? values.duration;

  const billingLabel = values.billing_type === "bandwidth" ? "Bandwidth" : "Time-based";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Product</span>
            <span className="font-medium">{PRODUCT_LABELS[values.product] ?? values.product}</span>
          </div>
          {values.billing_type && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Billing</span>
              <span className="font-medium">{billingLabel}</span>
            </div>
          )}
          {values.bandwidth_gb != null && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Bandwidth</span>
              <span className="font-medium">{values.bandwidth_gb} GB</span>
            </div>
          )}
          {durationLabel && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{durationLabel}</span>
            </div>
          )}
          {values.mbps != null && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Speed</span>
              <span className="font-medium">{values.mbps} Mbps</span>
            </div>
          )}
          {values.bandwidth_mbps != null && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Bandwidth cap</span>
              <span className="font-medium">{values.bandwidth_mbps} Mbps</span>
            </div>
          )}
          {values.quantity != null && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">
                {values.quantity} IP{values.quantity === 1 ? "" : "s"}
              </span>
            </div>
          )}
          {values.pool && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Pool</span>
              <span className="font-mono font-medium">{values.pool}</span>
            </div>
          )}
          {values.location && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium">{values.location}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-3">
            <span className="font-medium">Total</span>
            {priceData ? (
              <span className="text-2xl font-bold tabular-nums">{priceData.cost_usd}</span>
            ) : (
              <span className="text-muted-foreground text-sm">
                Unavailable — charged at current rates
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trial discount banner */}
      {priceData?.trial_info?.price_applied === "discounted" && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
          Trial discount applied — {formatCents(priceData.trial_info.discounted_price_cents)}{" "}
          instead of {formatCents(priceData.trial_info.full_price_cents)}.
          {priceData.trial_info.discounted_trials_remaining > 0 &&
            ` ${priceData.trial_info.discounted_trials_remaining} discounted trial(s) remaining today.`}
        </div>
      )}

      {priceData?.mode === "allocation" && (
        <p className="text-muted-foreground text-sm">
          This plan uses bandwidth from your allocation.
          {priceData.allocation_available != null &&
            ` ${priceData.allocation_available} GB available.`}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={confirming}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={onConfirm} disabled={confirming}>
          {confirming && <Loader2 className="mr-1 size-4 animate-spin" />}
          {confirmLabel(confirming, priceData)}
        </Button>
      </div>
    </div>
  );
}

// ─── main form ────────────────────────────────────────────────────────────────

export function CreatePlanForm() {
  const router = useRouter();
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const [step, setStep] = useState<"configure" | "review">("configure");
  const [priceData, setPriceData] = useState<CheckPriceResponse | null>(null);
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // ISP pools for dedicated_isp — fetched once on demand
  const [pools, setPools] = useState<IspPool[] | null>(null);
  const [poolsLoading, setPoolsLoading] = useState(false);

  const {
    register,
    watch,
    setValue,
    getValues,
    formState: { isValid, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product: undefined,
      billing_type: undefined,
      duration: undefined,
      location: undefined,
      pool: undefined,
    },
    mode: "onChange",
  });

  const product = watch("product");
  const billingType = watch("billing_type");
  const duration = watch("duration");

  const isBandwidth = BANDWIDTH_SET.has(product ?? "");
  const isHybrid = HYBRID_SET.has(product ?? "");
  const isUnlimited = product === "unlimited_residential";
  const isDedicated = product === "dedicated_isp";
  const hasLocation = LOCATION_SET.has(product ?? "");

  const showBandwidthGb = isBandwidth || (isHybrid && billingType === "bandwidth");
  const showDuration = (isHybrid && billingType === "time") || isUnlimited;
  const showMbps = isHybrid && billingType === "time";
  const showBandwidthMbps = isUnlimited && !!duration && duration !== "trial";

  // Fetch dedicated_isp pools on demand
  useEffect(() => {
    if (!isDedicated || pools !== null || poolsLoading) return;
    setPoolsLoading(true);
    fetch("/api/proxy/proxies/pools")
      .then((r) => r.json())
      .then((raw) => {
        const data = (raw.data ?? raw) as { pools: IspPool[] };
        setPools(data.pools ?? []);
      })
      .catch(() => setPools([]))
      .finally(() => setPoolsLoading(false));
  }, [isDedicated, pools, poolsLoading]);

  function handleProductChange(value: string | null) {
    if (!value) return;
    setValue("product", value as ProductType, { shouldValidate: true });
    // Reset all product-specific fields when product changes
    setValue("billing_type", undefined);
    setValue("bandwidth_gb", undefined);
    setValue("duration", undefined);
    setValue("mbps", undefined);
    setValue("bandwidth_mbps", undefined);
    setValue("quantity", undefined);
    setValue("pool", undefined);
    setValue("location", undefined);
  }

  function handleBillingTypeChange(value: string | null) {
    if (!value) return;
    setValue("billing_type", value as "bandwidth" | "time", { shouldValidate: true });
    // Reset fields that belong to the other billing mode
    setValue("bandwidth_gb", undefined);
    setValue("duration", undefined);
    setValue("mbps", undefined);
  }

  async function handleCheckPrice() {
    setCheckingPrice(true);
    const body = buildRequestBody(getValues());

    // The check-price endpoint lives under /plans/check-price per the API spec
    const res = await fetch("/api/proxy/plans/check-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    setCheckingPrice(false);

    if (!res?.ok) {
      const json = (await res?.json().catch(() => ({}))) as Record<
        string,
        { message?: string; code?: string }
      >;
      const isNotFound = json?.error?.code === "NOT_FOUND" || res?.status === 404;
      toast.error(
        isNotFound
          ? "Price check is not available in this environment."
          : (json?.error?.message ?? "Failed to check price. Please try again."),
      );
      return;
    }

    const raw = (await res.json()) as Record<string, unknown>;
    setPriceData((raw.data ?? raw) as CheckPriceResponse);
    setStep("review");
  }

  function handleBack() {
    setStep("configure");
    setPriceData(null);
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  async function handleConfirm() {
    setConfirming(true);
    const body = buildRequestBody(getValues());

    const res = await fetch("/api/proxy/plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKeyRef.current,
      },
      body: JSON.stringify(body),
    }).catch(() => null);

    setConfirming(false);

    if (!res?.ok) {
      const json = (await res?.json().catch(() => ({}))) as Record<string, { message?: string }>;
      toast.error(json?.error?.message ?? "Failed to create plan. Please try again.");
      return;
    }

    const raw = (await res.json()) as Record<string, unknown>;
    const plan = (raw.data ?? raw) as { plan_id: string };
    toast.success("Plan created successfully!");
    router.push(`/plans/${plan.plan_id}`);
  }

  if (step === "review" && priceData) {
    return (
      <ReviewStep
        values={getValues()}
        priceData={priceData}
        confirming={confirming}
        onBack={handleBack}
        onConfirm={handleConfirm}
      />
    );
  }

  return (
    <div className="max-w-md space-y-6">
      {/* Product */}
      <div className="space-y-2">
        <Label>Product</Label>
        <Select value={product ?? ""} onValueChange={handleProductChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a product…" />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_GROUPS.map((group, i) => (
              <span key={group.label}>
                {i > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.products.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRODUCT_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </span>
            ))}
          </SelectContent>
        </Select>
        {errors.product && <p className="text-destructive text-xs">{errors.product.message}</p>}
      </div>

      {/* Billing type — hybrid products only */}
      {isHybrid && (
        <div className="space-y-2">
          <Label>Billing type</Label>
          <Select value={billingType ?? ""} onValueChange={handleBillingTypeChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select billing…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bandwidth">Bandwidth (per GB)</SelectItem>
              <SelectItem value="time">Time-based (per day)</SelectItem>
            </SelectContent>
          </Select>
          {errors.billing_type && (
            <p className="text-destructive text-xs">{errors.billing_type.message}</p>
          )}
        </div>
      )}

      {/* Bandwidth GB */}
      {showBandwidthGb && (
        <div className="space-y-2">
          <Label>Bandwidth (GB)</Label>
          <div className="flex items-center gap-2">
            <Input
              {...register("bandwidth_gb", { valueAsNumber: true })}
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 10"
              className="w-36"
              autoFocus={isBandwidth}
            />
            <span className="text-muted-foreground text-sm">GB</span>
          </div>
          {errors.bandwidth_gb && (
            <p className="text-destructive text-xs">{errors.bandwidth_gb.message}</p>
          )}
        </div>
      )}

      {/* Duration */}
      {showDuration && (
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select
            value={duration ?? ""}
            onValueChange={(v) => {
              if (v) setValue("duration", v as PlanDuration, { shouldValidate: true });
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select duration…" />
            </SelectTrigger>
            <SelectContent>
              {(isUnlimited ? UNLIMITED_DURATION_OPTIONS : HYBRID_DURATION_OPTIONS).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.duration && <p className="text-destructive text-xs">{errors.duration.message}</p>}
        </div>
      )}

      {/* Mbps — hybrid time mode */}
      {showMbps && (
        <div className="space-y-2">
          <Label>Speed (Mbps)</Label>
          <div className="flex items-center gap-2">
            <Input
              {...register("mbps", { valueAsNumber: true })}
              type="number"
              min={10}
              max={10000}
              step={1}
              placeholder="e.g. 100"
              className="w-36"
            />
            <span className="text-muted-foreground text-sm">Mbps</span>
          </div>
          {errors.mbps && <p className="text-destructive text-xs">{errors.mbps.message}</p>}
        </div>
      )}

      {/* Bandwidth cap — unlimited_residential non-trial */}
      {showBandwidthMbps && (
        <div className="space-y-2">
          <Label>Bandwidth cap (Mbps)</Label>
          <div className="flex items-center gap-2">
            <Input
              {...register("bandwidth_mbps", { valueAsNumber: true })}
              type="number"
              min={200}
              max={3000}
              step={1}
              placeholder="e.g. 500"
              className="w-36"
            />
            <span className="text-muted-foreground text-sm">Mbps (200–3000)</span>
          </div>
          {errors.bandwidth_mbps && (
            <p className="text-destructive text-xs">{errors.bandwidth_mbps.message}</p>
          )}
        </div>
      )}

      {/* Dedicated ISP: quantity + pool */}
      {isDedicated && (
        <>
          <div className="space-y-2">
            <Label>Number of IPs</Label>
            <Input
              {...register("quantity", { valueAsNumber: true })}
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 5"
              className="w-36"
              autoFocus
            />
            {errors.quantity && (
              <p className="text-destructive text-xs">{errors.quantity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Pool</Label>
            {poolsLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading pools…
              </div>
            ) : (
              <Select
                value={watch("pool") ?? ""}
                onValueChange={(v) => setValue("pool", v ?? undefined, { shouldValidate: true })}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a pool…" />
                </SelectTrigger>
                <SelectContent>
                  {pools?.length ? (
                    pools.map((p) => (
                      <SelectItem key={p.pool} value={p.pool} disabled={!p.inStock}>
                        {p.title}
                        {p.inStock ? ` — ${p.stock} avail.` : " (out of stock)"}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none" disabled>
                      No pools available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {errors.pool && <p className="text-destructive text-xs">{errors.pool.message}</p>}
          </div>
        </>
      )}

      {/* Location — datacenter / shared_isp only, optional */}
      {hasLocation && (
        <div className="space-y-2">
          <Label>
            Location <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </Label>
          <Select
            value={watch("location") ?? ""}
            onValueChange={(v) =>
              setValue("location", v ? (v as "NL" | "UK") : undefined, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Any location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any location</SelectItem>
              <SelectItem value="NL">Netherlands (NL)</SelectItem>
              <SelectItem value="UK">United Kingdom (UK)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Get price */}
      <Button
        type="button"
        onClick={handleCheckPrice}
        disabled={!isValid || !product || checkingPrice}
      >
        {checkingPrice && <Loader2 className="mr-1 size-4 animate-spin" />}
        {checkingPrice ? "Checking price…" : "Get price →"}
      </Button>
    </div>
  );
}
