---
name: code-formatting
description: Use when formatting minified or single-line JavaScript files into readable multi-line code. Scans for compressed JS files and reformats them with proper indentation, line breaks, and structure. Trigger on keywords like "format JS", "prettify", "readable code", "unminify", "code formatting".
---

# Code Formatting

Reformats minified/single-line JavaScript files into readable multi-line code.

## Steps

1. **Identify minified files**
   - Look for JS files where most lines exceed 200 characters
   - Check for files with very few lines but substantial content
   - Common targets: `*.js` in project root (not `node_modules/`)

2. **Format each file**
   - Break single-line functions into multi-line with proper indentation (2 spaces)
   - Separate chained method calls onto individual lines
   - Break template literals across lines for readability
   - Add blank lines between logical blocks/functions
   - Preserve ALL original logic and functionality
   - Use the Write tool (not Edit) for complete rewrites

3. **Formatting rules**
   - 2-space indentation
   - Opening braces on same line
   - Blank line between functions
   - Template literals: break across lines at logical points
   - Event chains: one handler per line
   - Ternary operators: break into if/else if complex

4. **Verify**
   - Ensure no logic changed (diff key functions before/after)
   - Check that all variable references are still valid
   - Confirm script loading order in index.html still works

## Notes
- Always read the file first before formatting
- Never change functionality, only formatting
- Keep the same variable names and function signatures
- For very large files, use the Task tool to parallelize formatting
