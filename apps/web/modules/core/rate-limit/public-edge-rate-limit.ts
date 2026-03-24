import { EDGE_RATE_LIMIT_PROVIDER } from "@/lib/constants";
import { applyIPRateLimit } from "./helpers";
import { TRateLimitConfig } from "./types/rate-limit";

export const publicEdgeRateLimitPolicies = {
  authLogin: "auth.login",
  authVerifyEmail: "auth.verify_email",
  v1ClientDefault: "client.v1.default",
  v1ClientStorageUpload: "client.storage.upload.v1",
  v2ClientResponses: "client.responses.v2",
  v2ClientDisplays: "client.displays.v2",
  v2ClientStorageUpload: "client.storage.upload.v2",
} as const;

export type TPublicEdgeRateLimitPolicyId =
  (typeof publicEdgeRateLimitPolicies)[keyof typeof publicEdgeRateLimitPolicies];

export type TEdgeRateLimitProvider = "none" | "cloudflare" | "cloudarmor" | "envoy";

const managedPublicEdgePolicies = Object.values(
  publicEdgeRateLimitPolicies
) as TPublicEdgeRateLimitPolicyId[];

const managedPublicEdgePoliciesByProvider: Record<
  TEdgeRateLimitProvider,
  readonly TPublicEdgeRateLimitPolicyId[]
> = {
  none: [],
  cloudflare: managedPublicEdgePolicies,
  cloudarmor: managedPublicEdgePolicies,
  envoy: [],
};

const normalizeEdgeRateLimitProvider = (provider: string | undefined): TEdgeRateLimitProvider => {
  switch (provider) {
    case "cloudflare":
    case "cloudarmor":
    case "envoy":
      return provider;
    default:
      return "none";
  }
};

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

export const getEdgeRateLimitProvider = (
  provider: string | undefined = EDGE_RATE_LIMIT_PROVIDER
): TEdgeRateLimitProvider => normalizeEdgeRateLimitProvider(provider);

export const getPublicEdgeRateLimitPolicyId = (
  pathname: string,
  method: string
): TPublicEdgeRateLimitPolicyId | null => {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "POST" && normalizedPathname === "/api/auth/callback/credentials") {
    return publicEdgeRateLimitPolicies.authLogin;
  }

  if (normalizedMethod === "POST" && normalizedPathname === "/api/auth/callback/token") {
    return publicEdgeRateLimitPolicies.authVerifyEmail;
  }

  if (/^\/api\/v1\/client\/og(?:\/.*)?$/.test(normalizedPathname)) {
    return null;
  }

  if (/^\/api\/v1\/client\/[^/]+\/storage$/.test(normalizedPathname) && normalizedMethod === "POST") {
    return publicEdgeRateLimitPolicies.v1ClientStorageUpload;
  }

  if (/^\/api\/v2\/client\/[^/]+\/storage$/.test(normalizedPathname) && normalizedMethod === "POST") {
    return publicEdgeRateLimitPolicies.v2ClientStorageUpload;
  }

  if (
    /^\/api\/v2\/client\/[^/]+\/responses(?:\/[^/]+)?$/.test(normalizedPathname) &&
    (normalizedMethod === "POST" || normalizedMethod === "PUT")
  ) {
    return publicEdgeRateLimitPolicies.v2ClientResponses;
  }

  if (/^\/api\/v2\/client\/[^/]+\/displays$/.test(normalizedPathname) && normalizedMethod === "POST") {
    return publicEdgeRateLimitPolicies.v2ClientDisplays;
  }

  if (normalizedPathname.startsWith("/api/v1/client/")) {
    return publicEdgeRateLimitPolicies.v1ClientDefault;
  }

  return null;
};

export const isPublicEdgeRateLimitManaged = (
  policyId: TPublicEdgeRateLimitPolicyId,
  provider: string | undefined = EDGE_RATE_LIMIT_PROVIDER
): boolean => managedPublicEdgePoliciesByProvider[getEdgeRateLimitProvider(provider)].includes(policyId);

export const applyPublicIpRateLimit = async (
  policyId: TPublicEdgeRateLimitPolicyId,
  config: TRateLimitConfig,
  provider: string | undefined = EDGE_RATE_LIMIT_PROVIDER
): Promise<"app" | "edge"> => {
  if (isPublicEdgeRateLimitManaged(policyId, provider)) {
    return "edge";
  }

  await applyIPRateLimit(config);

  return "app";
};

export const applyPublicIpRateLimitForRoute = async (
  pathname: string,
  method: string,
  config: TRateLimitConfig,
  provider: string | undefined = EDGE_RATE_LIMIT_PROVIDER
): Promise<"app" | "edge"> => {
  const policyId = getPublicEdgeRateLimitPolicyId(pathname, method);

  if (!policyId) {
    await applyIPRateLimit(config);
    return "app";
  }

  return await applyPublicIpRateLimit(policyId, config, provider);
};
