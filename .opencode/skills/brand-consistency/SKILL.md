---
name: brand-consistency
description: Use when standardizing branding across a multi-file project. Finds all references to an old brand name and replaces with the new one, updating UI text, config variables, localStorage keys, export filenames, and documentation. Trigger on keywords like "rename brand", "rebrand", "consistent naming", "brand standardization".
---

# Brand Consistency

Standardizes naming/branding across all project files.

## Steps

1. **Audit current references**
   - Search for old brand name in all file types: `grep -r "OldName" --include="*.{js,ts,tsx,html,md,json}"`
   - Categorize references:
     - **UI text** (HTML content, toast messages) — safe to change
     - **Config variables** (`window.OLDNAME_CONFIG`) — change both set and get
     - **localStorage keys** — change but note existing users lose data
     - **Service identifiers** (Auth0 audience, API names) — DO NOT change
     - **Export filenames** — change to match new brand
     - **Documentation** — update README and guides

2. **Apply changes systematically**
   - UI text: direct string replacement
   - Config variables: replace `window.OLDNAME_CONFIG` with `window.NEWNAME_CONFIG` in all files that set or read it
   - localStorage: replace `oldname.key` with `newname.key`
   - Export filenames: update `a.download=` values
   - Documentation: update headings and references

3. **Preserve service identifiers**
   - Auth0 API audience (e.g., `trueanalyzer-api`) — this is a service contract
   - Database table names — these are schema-level
   - API endpoint paths — these are interface contracts
   - Only change these if the service itself is being renamed

4. **Verify**
   - Search again for old brand name to catch missed references
   - Check that config variable reads and writes match
   - Confirm no broken references in test files

## Notes
- Service identifiers (Auth0 audience, API names) should NOT be changed without updating the corresponding service configuration
- localStorage key changes will cause existing users to lose their stored state
- Always update both the setter (runtime-config.js) and getter (remote-demo.js, api-client.ts)
- Test files may reference old config variable names and need updating too
