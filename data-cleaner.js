// ── Datalyst Data Cleaner ───────────────────────────────────────────────────
// Comprehensive noisy data cleaning engine.
// Runs entirely in the browser. All operations are reversible via undo stack.

(function () {
  "use strict";

  // ── State ────────────────────────────────────────────────────────────────

  var undoStack = [];
  var redoStack = [];
  var log = [];

  function snapshot(rows) {
    return JSON.parse(JSON.stringify(rows));
  }

  function pushUndo(rows, action, detail) {
    undoStack.push({ rows: snapshot(rows), action: action, detail: detail, time: new Date() });
    redoStack = [];
    log.unshift({ action: action, detail: detail, time: new Date() });
    if (undoStack.length > 50) undoStack.shift();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function nv(value) {
    if (typeof value === "number") return value;
    var s = String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$,%\s]/g, "");
    var n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function isBlank(v) {
    return v == null || String(v).trim() === "";
  }

  function columnValues(rows, key) {
    return rows.map(function (r) { return r[key]; });
  }

  function numericValues(rows, key) {
    return rows.map(function (r) { return nv(r[key]); }).filter(function (v) { return v !== null; });
  }

  function mode(arr) {
    var freq = {};
    arr.forEach(function (v) {
      var k = String(v);
      freq[k] = (freq[k] || 0) + 1;
    });
    var best = null, bestCount = 0;
    Object.keys(freq).forEach(function (k) {
      if (freq[k] > bestCount) { best = k; bestCount = freq[k]; }
    });
    return best;
  }

  function median(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function mean(arr) {
    return arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : 0;
  }

  function stdDev(arr) {
    var m = mean(arr);
    return Math.sqrt(arr.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / arr.length);
  }

  function iqrBounds(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var q1 = median(s.slice(0, Math.floor(s.length * 0.25)));
    var q3 = median(s.slice(Math.floor(s.length * 0.75)));
    var iqr = q3 - q1;
    return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
  }

  function editDistance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    var m = a.length, n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i++) { dp[i] = [i]; }
    for (var j = 0; j <= n; j++) { dp[0][j] = j; }
    for (var i = 1; i <= m; i++) {
      for (var j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function similarity(a, b) {
    var maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - editDistance(a, b) / maxLen;
  }

  // ── Field Detection ──────────────────────────────────────────────────────

  function detectFields(rows) {
    if (!rows.length) return {};
    var keys = Object.keys(rows[0]);
    var result = {};

    keys.forEach(function (key) {
      var vals = columnValues(rows, key).filter(function (v) { return !isBlank(v); });
      var numCount = vals.filter(function (v) { return nv(v) !== null; }).length;
      var dateCount = vals.filter(function (v) { return !Number.isNaN(Date.parse(String(v))); }).length;
      var numRatio = vals.length ? numCount / vals.length : 0;
      var dateRatio = vals.length ? dateCount / vals.length : 0;

      if (numRatio >= 0.8) result[key] = "numeric";
      else if (dateRatio >= 0.8) result[key] = "date";
      else result[key] = "text";
    });

    return result;
  }

  // ── Cleaning Operations ──────────────────────────────────────────────────

  function removeExactDuplicates(rows) {
    var before = rows.length;
    var seen = new Map();
    var result = [];
    rows.forEach(function (r) {
      var key = JSON.stringify(r);
      if (!seen.has(key)) {
        seen.set(key, true);
        result.push(r);
      }
    });
    return { rows: result, removed: before - result.length };
  }

  function removeFuzzyDuplicates(rows, threshold) {
    threshold = threshold || 0.92;
    var keys = rows.length ? Object.keys(rows[0]) : [];
    var before = rows.length;
    var keep = [];
    var removed = 0;

    rows.forEach(function (row) {
      var dominated = false;
      for (var i = 0; i < keep.length; i++) {
        var matchCount = 0;
        var totalFields = keys.length;
        keys.forEach(function (k) {
          var a = String(row[k] ?? "").trim().toLowerCase();
          var b = String(keep[i][k] ?? "").trim().toLowerCase();
          if (a === b || similarity(a, b) >= threshold) matchCount++;
        });
        if (matchCount / totalFields >= threshold) {
          dominated = true;
          break;
        }
      }
      if (!dominated) keep.push(row);
      else removed++;
    });

    return { rows: keep, removed: removed };
  }

  function trimWhitespace(rows) {
    var trimmed = 0;
    var result = rows.map(function (r) {
      var newRow = {};
      Object.keys(r).forEach(function (k) {
        var v = r[k];
        if (typeof v === "string") {
          var t = v.trim();
          if (t !== v) trimmed++;
          newRow[k] = t;
        } else {
          newRow[k] = v;
        }
      });
      return newRow;
    });
    return { rows: result, trimmed: trimmed };
  }

  function normalizeStrings(rows, options) {
    options = options || {};
    var fields = options.fields || Object.keys(rows[0] || {});
    var changes = 0;
    var result = rows.map(function (r) {
      var newRow = Object.assign({}, r);
      fields.forEach(function (k) {
        var v = newRow[k];
        if (typeof v !== "string") return;
        var orig = v;
        if (options.lowercase !== false) v = v.toLowerCase();
        if (options.stripSpecial) v = v.replace(/[^a-z0-9\s\-\.\,\@]/gi, "");
        if (options.collapseSpaces) v = v.replace(/\s+/g, " ").trim();
        if (options !== orig) changes++;
        newRow[k] = v;
      });
      return newRow;
    });
    return { rows: result, changes: changes };
  }

  function inferAndFixTypes(rows) {
    var keys = rows.length ? Object.keys(rows[0]) : [];
    var fixes = {};
    var result = rows.map(function (r) {
      var newRow = Object.assign({}, r);
      keys.forEach(function (k) {
        var v = newRow[k];
        if (typeof v !== "string") return;
        var trimmed = v.trim();
        if (isBlank(trimmed)) { newRow[k] = trimmed; return; }
        // Try numeric
        var cleaned = trimmed.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
        var num = Number(cleaned);
        if (Number.isFinite(num)) {
          newRow[k] = num;
          fixes[k] = (fixes[k] || 0) + 1;
          return;
        }
        // Try boolean
        if (/^(true|false|yes|no|y|n)$/i.test(trimmed)) {
          newRow[k] = /^(true|yes|y)$/i.test(trimmed);
          fixes[k] = (fixes[k] || 0) + 1;
          return;
        }
      });
      return newRow;
    });
    return { rows: result, fixes: fixes };
  }

  function imputeMissing(rows, strategy, options) {
    strategy = strategy || "median";
    options = options || {};
    var keys = rows.length ? Object.keys(rows[0]) : {};
    var types = detectFields(rows);
    var filled = 0;
    var fillValues = {};

    // Compute fill values per column first
    keys.forEach(function (k) {
      if (types[k] === "numeric") {
        var vals = numericValues(rows, k);
        if (strategy === "mean") fillValues[k] = mean(vals);
        else if (strategy === "median") fillValues[k] = median(vals);
        else if (strategy === "mode") fillValues[k] = mode(vals);
        else if (strategy === "zero") fillValues[k] = 0;
        else if (strategy === "constant") fillValues[k] = options.constantValue || 0;
        else if (strategy === "forward") fillValues[k] = null; // handled per-row
        else fillValues[k] = median(vals);
      } else {
        var textVals = columnValues(rows, k).filter(function (v) { return !isBlank(v); });
        if (strategy === "mode" || strategy === "median" || strategy === "mean") fillValues[k] = mode(textVals);
        else if (strategy === "constant") fillValues[k] = options.constantValue || "Unknown";
        else if (strategy === "forward") fillValues[k] = null;
        else fillValues[k] = mode(textVals) || "Unknown";
      }
    });

    var lastValues = {};
    var result = rows.map(function (r) {
      var newRow = Object.assign({}, r);
      keys.forEach(function (k) {
        if (!isBlank(newRow[k])) {
          lastValues[k] = newRow[k];
          return;
        }
        var fill;
        if (strategy === "forward") {
          fill = lastValues[k] != null ? lastValues[k] : fillValues[k];
        } else {
          fill = fillValues[k];
        }
        if (fill != null) {
          newRow[k] = fill;
          filled++;
        }
      });
      return newRow;
    });

    return { rows: result, filled: filled };
  }

  function removeHighNullColumns(rows, threshold) {
    threshold = threshold || 0.5;
    var keys = rows.length ? Object.keys(rows[0]) : [];
    var drop = [];
    var keep = [];

    keys.forEach(function (k) {
      var nullCount = rows.filter(function (r) { return isBlank(r[k]); }).length;
      if (nullCount / rows.length >= threshold) drop.push(k);
      else keep.push(k);
    });

    if (drop.length === 0) return { rows: rows, dropped: [] };

    var result = rows.map(function (r) {
      var newRow = {};
      keep.forEach(function (k) { newRow[k] = r[k]; });
      return newRow;
    });

    return { rows: result, dropped: drop };
  }

  function removeLowVarianceColumns(rows, threshold) {
    threshold = threshold || 0.01;
    var keys = rows.length ? Object.keys(rows[0]) : [];
    var types = detectFields(rows);
    var drop = [];
    var keep = [];

    keys.forEach(function (k) {
      if (types[k] !== "numeric") { keep.push(k); return; }
      var vals = numericValues(rows, k);
      if (vals.length < 2) { keep.push(k); return; }
      var m = mean(vals);
      var variance = vals.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / vals.length;
      var cv = m !== 0 ? Math.sqrt(variance) / Math.abs(m) : 0;
      if (cv < threshold) drop.push(k);
      else keep.push(k);
    });

    if (drop.length === 0) return { rows: rows, dropped: [] };

    var result = rows.map(function (r) {
      var newRow = {};
      keep.forEach(function (k) { newRow[k] = r[k]; });
      return newRow;
    });

    return { rows: result, dropped: drop };
  }

  function capOutliers(rows, method) {
    method = method || "iqr";
    var keys = rows.length ? Object.keys(rows[0]) : {};
    var types = detectFields(rows);
    var capped = 0;

    var bounds = {};
    keys.forEach(function (k) {
      if (types[k] !== "numeric") return;
      var vals = numericValues(rows, k);
      if (vals.length < 8) return;
      if (method === "iqr") bounds[k] = iqrBounds(vals);
      else {
        var m = mean(vals), sd = stdDev(vals);
        bounds[k] = { lower: m - 3 * sd, upper: m + 3 * sd };
      }
    });

    var result = rows.map(function (r) {
      var newRow = Object.assign({}, r);
      keys.forEach(function (k) {
        if (!bounds[k]) return;
        var v = nv(newRow[k]);
        if (v === null) return;
        if (v < bounds[k].lower) { newRow[k] = bounds[k].lower; capped++; }
        else if (v > bounds[k].upper) { newRow[k] = bounds[k].upper; capped++; }
      });
      return newRow;
    });

    return { rows: result, capped: capped, bounds: bounds };
  }

  function removeOutlierRows(rows, method) {
    method = method || "iqr";
    var keys = rows.length ? Object.keys(rows[0]) : {};
    var types = detectFields(rows);
    var before = rows.length;

    var bounds = {};
    keys.forEach(function (k) {
      if (types[k] !== "numeric") return;
      var vals = numericValues(rows, k);
      if (vals.length < 8) return;
      if (method === "iqr") bounds[k] = iqrBounds(vals);
      else {
        var m = mean(vals), sd = stdDev(vals);
        bounds[k] = { lower: m - 3 * sd, upper: m + 3 * sd };
      }
    });

    var result = rows.filter(function (r) {
      return keys.every(function (k) {
        if (!bounds[k]) return true;
        var v = nv(r[k]);
        return v === null || (v >= bounds[k].lower && v <= bounds[k].upper);
      });
    });

    return { rows: result, removed: before - result.length };
  }

  function smoothTimeSeries(rows, metricKey, windowSize) {
    windowSize = windowSize || 3;
    var vals = rows.map(function (r) { return nv(r[metricKey]); });
    var smoothed = 0;

    var result = rows.map(function (r, i) {
      var newRow = Object.assign({}, r);
      var v = vals[i];
      if (v === null) return newRow;
      var start = Math.max(0, i - Math.floor(windowSize / 2));
      var end = Math.min(rows.length, i + Math.ceil(windowSize / 2));
      var window = vals.slice(start, end).filter(function (x) { return x !== null; });
      if (window.length >= 2) {
        var med = median(window);
        if (med !== v) { smoothed++; newRow[metricKey] = med; }
      }
      return newRow;
    });

    return { rows: result, smoothed: smoothed };
  }

  // ── Auto-Clean Pipeline ──────────────────────────────────────────────────

  function autoClean(rows, options) {
    options = options || {};
    var steps = [];
    var current = snapshot(rows);

    // 1. Trim whitespace
    var trimResult = trimWhitespace(current);
    current = trimResult.rows;
    if (trimResult.trimmed > 0) steps.push({ action: "Trim whitespace", detail: trimResult.trimmed + " values cleaned" });

    // 2. Infer and fix types
    var typeResult = inferAndFixTypes(current);
    current = typeResult.rows;
    var typeFixCount = Object.values(typeResult.fixes).reduce(function (s, v) { return s + v; }, 0);
    if (typeFixCount > 0) steps.push({ action: "Fixed data types", detail: typeFixCount + " values coerced to proper types" });

    // 3. Remove high-null columns
    if (options.pruneColumns !== false) {
      var pruneResult = removeHighNullColumns(current, options.nullThreshold || 0.5);
      if (pruneResult.dropped.length) steps.push({ action: "Pruned columns", detail: pruneResult.dropped.join(", ") + " (>50% null)" });
      current = pruneResult.rows;
    }

    // 4. Impute missing values
    var impResult = imputeMissing(current, options.imputeStrategy || "median");
    current = impResult.rows;
    if (impResult.filled > 0) steps.push({ action: "Imputed missing values", detail: impResult.filled + " cells filled (" + (options.imputeStrategy || "median") + ")" });

    // 5. Cap outliers
    if (options.capOutliers !== false) {
      var capResult = capOutliers(current, options.outlierMethod || "iqr");
      current = capResult.rows;
      if (capResult.capped > 0) steps.push({ action: "Capped outliers", detail: capResult.capped + " values capped (IQR method)" });
    }

    // 6. Remove exact duplicates
    var dedupResult = removeExactDuplicates(current);
    current = dedupResult.rows;
    if (dedupResult.removed > 0) steps.push({ action: "Removed duplicates", detail: dedupResult.removed + " exact duplicate rows removed" });

    return { rows: current, steps: steps };
  }

  // ── Quality Report ───────────────────────────────────────────────────────

  function qualityReport(rows) {
    if (!rows || !rows.length) return null;
    var keys = Object.keys(rows[0]);
    var types = detectFields(rows);
    var issues = [];

    // Missing values per column
    keys.forEach(function (k) {
      var nullCount = rows.filter(function (r) { return isBlank(r[k]); }).length;
      var pct = (nullCount / rows.length * 100);
      if (pct > 0) {
        issues.push({
          column: k,
          type: "missing",
          severity: pct > 30 ? "high" : pct > 10 ? "medium" : "low",
          detail: nullCount + " missing (" + pct.toFixed(1) + "%)",
          fixable: true
        });
      }
    });

    // Exact duplicates
    var unique = new Set(rows.map(function (r) { return JSON.stringify(r); })).size;
    var dupes = rows.length - unique;
    if (dupes > 0) {
      issues.push({
        column: "_all",
        type: "duplicates",
        severity: dupes / rows.length > 0.1 ? "high" : "medium",
        detail: dupes + " exact duplicate rows (" + (dupes / rows.length * 100).toFixed(1) + "%)",
        fixable: true
      });
    }

    // Type mismatches (numeric fields stored as strings)
    keys.forEach(function (k) {
      if (types[k] !== "numeric") return;
      var strCount = rows.filter(function (r) {
        return typeof r[k] === "string" && !isBlank(r[k]) && nv(r[k]) !== null;
      }).length;
      if (strCount > 0) {
        issues.push({
          column: k,
          type: "type_mismatch",
          severity: "medium",
          detail: strCount + " numeric values stored as strings",
          fixable: true
        });
      }
    });

    // Whitespace issues
    keys.forEach(function (k) {
      var wsCount = rows.filter(function (r) {
        return typeof r[k] === "string" && r[k] !== r[k].trim();
      }).length;
      if (wsCount > 0) {
        issues.push({
          column: k,
          type: "whitespace",
          severity: "low",
          detail: wsCount + " values with leading/trailing whitespace",
          fixable: true
        });
      }
    });

    // Outliers
    keys.forEach(function (k) {
      if (types[k] !== "numeric") return;
      var vals = numericValues(rows, k);
      if (vals.length < 8) return;
      var bounds = iqrBounds(vals);
      var outliers = vals.filter(function (v) { return v < bounds.lower || v > bounds.upper; }).length;
      if (outliers > 0) {
        issues.push({
          column: k,
          type: "outliers",
          severity: outliers / vals.length > 0.05 ? "high" : "low",
          detail: outliers + " potential outliers detected (IQR method)",
          fixable: true
        });
      }
    });

    // Constant columns (zero variance)
    keys.forEach(function (k) {
      var uniqueVals = new Set(columnValues(rows, k).map(String));
      if (uniqueVals.size <= 1) {
        issues.push({
          column: k,
          type: "constant",
          severity: "low",
          detail: "Only " + uniqueVals.size + " unique value — low/no variance",
          fixable: true
        });
      }
    });

    // Fuzzy duplicates
    if (rows.length <= 5000) {
      var sampleForFuzzy = rows.slice(0, 1000);
      var fuzzyPairs = 0;
      for (var i = 0; i < sampleForFuzzy.length; i++) {
        for (var j = i + 1; j < sampleForFuzzy.length; j++) {
          var matchCount = 0;
          keys.forEach(function (k) {
            var a = String(sampleForFuzzy[i][k] ?? "").toLowerCase();
            var b = String(sampleForFuzzy[j][k] ?? "").toLowerCase();
            if (a === b || similarity(a, b) >= 0.92) matchCount++;
          });
          if (matchCount / keys.length >= 0.85 && matchCount / keys.length < 1) fuzzyPairs++;
        }
      }
      if (fuzzyPairs > 0) {
        issues.push({
          column: "_all",
          type: "fuzzy_duplicates",
          severity: "medium",
          detail: fuzzyPairs + " near-duplicate row pairs detected (similarity ≥85%)",
          fixable: true
        });
      }
    }

    return {
      rows: rows.length,
      columns: keys.length,
      issues: issues,
      totalIssues: issues.length,
      highSeverity: issues.filter(function (i) { return i.severity === "high"; }).length,
      mediumSeverity: issues.filter(function (i) { return i.severity === "medium"; }).length,
      lowSeverity: issues.filter(function (i) { return i.severity === "low"; }).length
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.DataCleaner = {
    // Core operations
    removeExactDuplicates: removeExactDuplicates,
    removeFuzzyDuplicates: removeFuzzyDuplicates,
    trimWhitespace: trimWhitespace,
    normalizeStrings: normalizeStrings,
    inferAndFixTypes: inferAndFixTypes,
    imputeMissing: imputeMissing,
    removeHighNullColumns: removeHighNullColumns,
    removeLowVarianceColumns: removeLowVarianceColumns,
    capOutliers: capOutliers,
    removeOutlierRows: removeOutlierRows,
    smoothTimeSeries: smoothTimeSeries,

    // Pipeline
    autoClean: autoClean,
    qualityReport: qualityReport,
    detectFields: detectFields,

    // Undo/redo
    pushUndo: pushUndo,
    undo: function () {
      if (!undoStack.length) return null;
      var state = undoStack.pop();
      redoStack.push(state);
      return state;
    },
    redo: function () {
      if (!redoStack.length) return null;
      var state = redoStack.pop();
      undoStack.push(state);
      return state;
    },
    canUndo: function () { return undoStack.length > 0; },
    canRedo: function () { return redoStack.length > 0; },

    // Log
    getLog: function () { return log.slice(); },
    clearLog: function () { log = []; undoStack = []; redoStack = []; }
  };

})();
