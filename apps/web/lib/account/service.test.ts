import { beforeEach, describe, expect, test, vi } from "vitest";
import { upsertAccount } from "./service";

const { mockUpsert } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    account: {
      upsert: mockUpsert,
    },
  },
}));

describe("account service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("upsertAccount keeps user ownership immutable on update", async () => {
    const accountData = {
      userId: "user-1",
      type: "oauth",
      provider: "google",
      providerAccountId: "provider-1",
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_at: 123,
      scope: "openid email",
      token_type: "Bearer",
      id_token: "id-token",
    };

    mockUpsert.mockResolvedValue({
      id: "account-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...accountData,
    });

    await upsertAccount(accountData);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "provider-1",
        },
      },
      create: accountData,
      update: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 123,
        scope: "openid email",
        token_type: "Bearer",
        id_token: "id-token",
      },
    });
  });
});
