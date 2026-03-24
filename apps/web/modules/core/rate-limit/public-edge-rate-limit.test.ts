import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyIPRateLimit } from "./helpers";
import {
  applyPublicIpRateLimit,
  applyPublicIpRateLimitForRoute,
  getEdgeRateLimitProvider,
  getPublicEdgeRateLimitPolicyId,
  isPublicEdgeRateLimitManaged,
  publicEdgeRateLimitPolicies,
} from "./public-edge-rate-limit";

vi.mock("./helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

const mockConfig = {
  interval: 60,
  allowedPerInterval: 100,
  namespace: "api:client",
};

describe("public-edge-rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEdgeRateLimitProvider", () => {
    test("falls back to none for unknown providers", () => {
      expect(getEdgeRateLimitProvider(undefined)).toBe("none");
      expect(getEdgeRateLimitProvider("unknown")).toBe("none");
    });

    test("accepts configured providers", () => {
      expect(getEdgeRateLimitProvider("cloudflare")).toBe("cloudflare");
      expect(getEdgeRateLimitProvider("cloudarmor")).toBe("cloudarmor");
      expect(getEdgeRateLimitProvider("envoy")).toBe("envoy");
    });
  });

  describe("getPublicEdgeRateLimitPolicyId", () => {
    test("classifies auth callback routes", () => {
      expect(getPublicEdgeRateLimitPolicyId("/api/auth/callback/credentials", "POST")).toBe(
        publicEdgeRateLimitPolicies.authLogin
      );
      expect(getPublicEdgeRateLimitPolicyId("/api/auth/callback/token", "POST")).toBe(
        publicEdgeRateLimitPolicies.authVerifyEmail
      );
    });

    test("classifies v1 client routes", () => {
      expect(getPublicEdgeRateLimitPolicyId("/api/v1/client/env_123/environment", "GET")).toBe(
        publicEdgeRateLimitPolicies.v1ClientDefault
      );
      expect(getPublicEdgeRateLimitPolicyId("/api/v1/client/env_123/storage", "POST")).toBe(
        publicEdgeRateLimitPolicies.v1ClientStorageUpload
      );
      expect(getPublicEdgeRateLimitPolicyId("/api/v1/client/og", "GET")).toBeNull();
      expect(getPublicEdgeRateLimitPolicyId("/api/v1/client/og/image", "GET")).toBeNull();
      expect(getPublicEdgeRateLimitPolicyId("/api/v1/client/og-image", "GET")).toBe(
        publicEdgeRateLimitPolicies.v1ClientDefault
      );
    });

    test("classifies v2 public write routes", () => {
      expect(getPublicEdgeRateLimitPolicyId("/api/v2/client/env_123/responses", "POST")).toBe(
        publicEdgeRateLimitPolicies.v2ClientResponses
      );
      expect(getPublicEdgeRateLimitPolicyId("/api/v2/client/env_123/responses/resp_123", "PUT")).toBe(
        publicEdgeRateLimitPolicies.v2ClientResponses
      );
      expect(getPublicEdgeRateLimitPolicyId("/api/v2/client/env_123/displays", "POST")).toBe(
        publicEdgeRateLimitPolicies.v2ClientDisplays
      );
      expect(getPublicEdgeRateLimitPolicyId("/api/v2/client/env_123/storage", "POST")).toBe(
        publicEdgeRateLimitPolicies.v2ClientStorageUpload
      );
    });
  });

  describe("isPublicEdgeRateLimitManaged", () => {
    test("manages public policies on cloudflare and cloudarmor only", () => {
      expect(isPublicEdgeRateLimitManaged(publicEdgeRateLimitPolicies.authLogin, "cloudflare")).toBe(true);
      expect(isPublicEdgeRateLimitManaged(publicEdgeRateLimitPolicies.authLogin, "cloudarmor")).toBe(true);
      expect(isPublicEdgeRateLimitManaged(publicEdgeRateLimitPolicies.authLogin, "none")).toBe(false);
      expect(isPublicEdgeRateLimitManaged(publicEdgeRateLimitPolicies.authLogin, "envoy")).toBe(false);
    });
  });

  describe("applyPublicIpRateLimit", () => {
    test("uses app rate limiting when no edge provider manages the policy", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });

      const source = await applyPublicIpRateLimit(
        publicEdgeRateLimitPolicies.v2ClientResponses,
        mockConfig,
        "none"
      );

      expect(source).toBe("app");
      expect(applyIPRateLimit).toHaveBeenCalledWith(mockConfig);
    });

    test("skips app rate limiting when the edge provider manages the policy", async () => {
      const source = await applyPublicIpRateLimit(
        publicEdgeRateLimitPolicies.v2ClientResponses,
        mockConfig,
        "cloudflare"
      );

      expect(source).toBe("edge");
      expect(applyIPRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("applyPublicIpRateLimitForRoute", () => {
    test("uses the route classifier for managed public routes", async () => {
      const source = await applyPublicIpRateLimitForRoute(
        "/api/v2/client/env_123/displays",
        "POST",
        mockConfig,
        "cloudarmor"
      );

      expect(source).toBe("edge");
      expect(applyIPRateLimit).not.toHaveBeenCalled();
    });

    test("falls back to app rate limiting for unmanaged routes", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });

      const source = await applyPublicIpRateLimitForRoute(
        "/api/v1/client/env_123/environment",
        "GET",
        mockConfig,
        "envoy"
      );

      expect(source).toBe("app");
      expect(applyIPRateLimit).toHaveBeenCalledWith(mockConfig);
    });
  });
});
