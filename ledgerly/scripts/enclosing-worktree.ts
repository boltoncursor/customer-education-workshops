import { isAbsolute, relative, resolve } from "node:path";

type WorktreePath = { path: string };

function enclosingWorktree(here: string, worktrees: WorktreePath[]): WorktreePath | undefined {
  const resolvedHere = resolve(here);
  return worktrees
    .filter((worktree) => {
      const worktreePath = resolve(worktree.path);
      if (resolvedHere === worktreePath) return true;
      const relativePath = relative(worktreePath, resolvedHere);
      return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
    })
    .sort((a, b) => resolve(b.path).length - resolve(a.path).length)[0];
}

export function requirePrimaryCheckout(here: string, worktrees: WorktreePath[]): WorktreePath {
  const primary = worktrees[0];
  if (!primary) throw new Error("Refusing to reset without a worktree.");
  const enclosing = enclosingWorktree(here, worktrees);
  if (!enclosing || resolve(enclosing.path) !== resolve(primary.path)) {
    throw new Error(
      `Refusing to reset from linked worktree ${enclosing?.path ?? resolve(here)}. Run npm run demo:reset from the main checkout at ${primary.path}.`,
    );
  }
  return primary;
}
