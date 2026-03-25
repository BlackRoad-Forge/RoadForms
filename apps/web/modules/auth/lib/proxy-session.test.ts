import { beforeEach, describe, expect, test, vi } from "vitest";
import { getProxySession, getSessionTokenFromRequest } from "./proxy-session";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    session: {
      findUnique: mockFindUnique,
    },
  },
}));

const createRequest = (cookies: Record<string, string> = {}) => ({
  cookies: {
    get: (name: string) => {
      const value = cookies[name];
      return value ? { value } : undefined;
    },
  },
});

describe("proxy-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("reads the secure session cookie when present", () => {
    const request = createRequest({
      "__Secure-next-auth.session-token": "secure-token",
    });

    expect(getSessionTokenFromRequest(request)).toBe("secure-token");
  });

  test("returns null when no session cookie is present", async () => {
    const request = createRequest();

    const session = await getProxySession(request);

    expect(session).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test("returns null when the session is expired", async () => {
    mockFindUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() - 60_000),
    });

    const request = createRequest({
      "next-auth.session-token": "expired-token",
    });

    const session = await getProxySession(request);

    expect(session).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        sessionToken: "expired-token",
      },
      select: {
        userId: true,
        expires: true,
      },
    });
  });

  test("returns the session when the cookie maps to a valid session", async () => {
    const validSession = {
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    };
    mockFindUnique.mockResolvedValue(validSession);

    const request = createRequest({
      "next-auth.session-token": "valid-token",
    });

    const session = await getProxySession(request);

    expect(session).toEqual(validSession);
  });
});
