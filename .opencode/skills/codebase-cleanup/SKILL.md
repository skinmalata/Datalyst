---
name: codebase-cleanup
description: Use when cleaning up a JavaScript/TypeScript project repository. Removes tracked build artifacts (node_modules, .next, dist), updates .gitignore patterns, and cleans up stale directories. Trigger on keywords like "cleanup", "remove node_modules from git", "clean repo", "gitignore".
---

# Codebase Cleanup

Automates repository hygiene tasks for JavaScript/TypeScript projects.

## Steps

1. **Check git tracking status**
   - Run `git ls-files | findstr "node_modules .next dist __pycache__"` to find tracked build artifacts
   - If none found, skip to .gitignore validation

2. **Remove tracked artifacts from git**
   - Run `git rm -r --cached <path>` for each tracked artifact
   - Do NOT delete the actual files, only untrack them

3. **Update .gitignore**
   - Ensure these patterns exist (use `**/` prefix for nested coverage):
     ```
     **/node_modules/
     **/.next/
     server/dist/
     **/__pycache__/
     *.py[cod]
     *.log
     ```
   - Remove redundant entries (e.g., `server/node_modules/` is covered by `**/node_modules/`)

4. **Clean up empty/stale directories**
   - Check for `.agents/` or other empty leftover directories
   - Remove if they serve no purpose

5. **Verify**
   - Run `git status` to confirm artifacts are untracked
   - Confirm .gitignore patterns match

## Notes
- Never delete actual build output, only untrack from git
- The `**/` glob prefix ensures nested node_modules are caught
- Always verify with `git ls-files` before and after
