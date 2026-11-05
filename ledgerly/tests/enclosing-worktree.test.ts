import { describe, expect, it } from "vitest";
import { requirePrimaryCheckout } from "@/scripts/enclosing-worktree";

describe("requirePrimaryCheckout", () => {
  it("allows a subdirectory of the main checkout and refuses a linked worktree", () => {
    const primary = { path: "/repo" };
    const linked = { path: "/worktrees/demo" };
    const nested = { path: "/repo/ledgerly" };

    expect(requirePrimaryCheckout("/repo", [primary]).path).toBe("/repo");
    expect(requirePrimaryCheckout("/repo/ledgerly", [primary]).path).toBe("/repo");

    expect(() => requirePrimaryCheckout("/worktrees/demo", [primary, linked])).toThrow(/linked worktree/);
    expect(() => requirePrimaryCheckout("/repo/ledgerly", [primary, nested])).toThrow(/linked worktree/);
    expect(() => requirePrimaryCheckout("/repo", [])).toThrow(/without a worktree/);
  });
});
