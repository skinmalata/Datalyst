// ── Datalyst Report Engine ───────────────────────────────────────────────────
// Generates a professional multi-section analysis report from any dataset.
// Runs entirely in the browser — no API required.

(function () {
  "use strict";

  // ── Helpers ──────────────────────────────────────────────────────────────

  function nv(value) {
    if (typeof value === "number") return value;
    var s = String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$,%\s]/g, "");
    var n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(v) {
    if (v == null || !Number.isFinite(v)) return "—";
    var abs = Math.abs(v);
    if (abs >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v.toFixed(0);
  }

  function pct(v) { return (v * 100).toFixed(1) + "%"; }

  function median(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function stdDev(arr) {
    var mean = arr.reduce(function (s, v) { return s + v; }, 0) / arr.length;
    return Math.sqrt(arr.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / arr.length);
  }

  function detectField(rows, patterns) {
    var keys = rows.length ? Object.keys(rows[0]) : [];
    for (var i = 0; i < keys.length; i++) {
      for (var j = 0; j < patterns.length; j++) {
        if (patterns[j].test(keys[i])) return keys[i];
      }
    }
    return null;
  }

  function findNumericField(rows) {
    var keys = rows.length ? Object.keys(rows[0]) : [];
    var prefer = /^(total.?price|revenue|sales|amount|profit|value)$/i;
    for (var i = 0; i < keys.length; i++) {
      if (prefer.test(keys[i])) return keys[i];
    }
    for (var i = 0; i < keys.length; i++) {
      var count = 0;
      for (var j = 0; j < Math.min(rows.length, 20); j++) {
        if (nv(rows[j][keys[i]]) !== null) count++;
      }
      if (count / Math.min(rows.length, 20) >= 0.5) return keys[i];
    }
    return null;
  }

  function groupAgg(rows, metric, dim) {
    var groups = {};
    rows.forEach(function (row) {
      var v = nv(row[metric]);
      if (v === null) return;
      var key = String(row[dim] ?? "Unknown");
      if (!groups[key]) groups[key] = { total: 0, count: 0, values: [] };
      groups[key].total += v;
      groups[key].count++;
      groups[key].values.push(v);
    });
    return groups;
  }

  function sortedGroup(groups) {
    return Object.keys(groups).map(function (k) {
      return { label: k, total: groups[k].total, count: groups[k].count, values: groups[k].values };
    }).sort(function (a, b) { return b.total - a.total; });
  }

  function returnRate(rows, retField) {
    var flags = rows.map(function (r) { return nv(r[retField]); }).filter(function (v) { return v !== null; });
    if (!flags.length) return 0;
    return flags.filter(function (v) { return v > 0; }).length / flags.length;
  }

  function groupReturnRate(rows, retField, dim) {
    var groups = {};
    rows.forEach(function (row) {
      var r = nv(row[retField]);
      if (r === null) return;
      var key = String(row[dim] ?? "Unknown");
      if (!groups[key]) groups[key] = { returned: 0, total: 0 };
      groups[key].total++;
      if (r > 0) groups[key].returned++;
    });
    return Object.keys(groups).map(function (k) {
      return { label: k, rate: groups[k].total ? groups[k].returned / groups[k].total : 0, count: groups[k].total };
    }).sort(function (a, b) { return b.rate - a.rate; });
  }

  // ── Main Report Generator ────────────────────────────────────────────────

  function generateReport(rows) {
    if (!rows || !rows.length) return null;

    var columns = Object.keys(rows[0]);
    var metric = findNumericField(rows);
    var dateField = detectField(rows, [/date|order.?date|month|period|timestamp/i]);
    var regionField = detectField(rows, [/region|country|market|territory|area|zone/i]);
    var productField = detectField(rows, [/product|category|item|sku|line|type/i]);
    var returnField = detectField(rows, [/returned|return.?flag|is.?return/i]);
    var discountField = detectField(rows, [/discount/i]);
    var paymentField = detectField(rows, [/payment|pay.?method|tender/i]);
    var custTypeField = detectField(rows, [/customer.?type|segment|client/i]);
    var qtyField = detectField(rows, [/quantity|qty|units?/i]);
    var storeField = detectField(rows, [/store|location|shop|outlet|branch/i]);
    var spField = detectField(rows, [/salesperson|rep|agent|associate|employee|staff/i]);
    var shipField = detectField(rows, [/shipping|delivery.?cost|freight/i]);

    if (!metric) return { title: "Analysis Report", summary: "No numeric measure detected.", kpis: [], sections: [], tables: [], recommendations: [], warnings: ["No numeric measure detected."] };

    var values = rows.map(function (r) { return nv(r[metric]); }).filter(function (v) { return v !== null; });
    var total = values.reduce(function (s, v) { return s + v; }, 0);
    var avg = values.length ? total / values.length : 0;
    var med = median(values);

    var kpis = [
      { label: "TOTAL " + metric.toUpperCase(), value: fmt(total) },
      { label: "ORDERS", value: values.length.toLocaleString() },
      { label: "AVG ORDER VALUE", value: fmt(avg) },
      { label: "MEDIAN ORDER", value: fmt(med) }
    ];

    if (qtyField) {
      var qtySum = rows.reduce(function (s, r) { var v = nv(r[qtyField]); return s + (v || 0); }, 0);
      kpis.push({ label: "TOTAL " + qtyField.toUpperCase(), value: qtySum.toLocaleString() });
    }

    var sections = [];
    var tables = [];
    var recommendations = [];
    var warnings = [];

    sections.push({
      title: "Executive Summary",
      type: "text",
      content: "**" + fmt(total) + "** in " + metric + " across **" + values.length.toLocaleString() + "** records with an average order value of **" + fmt(avg) + "**."
    });

    // ── Regional Analysis ──────────────────────────────────────────────────

    if (regionField) {
      var rGroups = groupAgg(rows, metric, regionField);
      var rRanking = sortedGroup(rGroups);
      var rTotal = rRanking.reduce(function (s, r) { return s + r.total; }, 0);

      if (rRanking.length >= 2) {
        var rLeader = rRanking[0];
        var rWeakest = rRanking.at(-1);
        kpis.push({ label: "TOP " + regionField.toUpperCase(), value: rLeader.label, change: pct(rLeader.total / rTotal) + " share" });

        var rLeaderRR = "", rWeakestRR = "";
        if (returnField) {
          var rrData = groupReturnRate(rows, returnField, regionField);
          if (rrData.length) {
            rLeaderRR = " with " + pct(rrData.find(function (x) { return x.label === rLeader.label; })?.rate || 0) + " return rate";
            rWeakestRR = " with " + pct(rrData[0].rate) + " return rate";

            var worstRR = rrData[0];
            if (worstRR.rate > 0.2) {
              warnings.push(worstRR.label + " has a " + pct(worstRR.rate) + " return rate — investigate fulfillment and product quality.");
            }

            tables.push({
              title: "Return Rate by " + regionField,
              headers: [regionField, "Return Rate", "Orders"],
              rows: rrData.map(function (r) { return [r.label, pct(r.rate), r.count.toLocaleString()]; })
            });
          }
        }

        sections.push({
          title: "Regional Performance",
          type: "finding",
          content: "**" + rLeader.label + "** leads with **" + fmt(rLeader.total) + "** (" + pct(rLeader.total / rTotal) + " share)" + rLeaderRR + ". **" + rWeakest.label + "** trails at **" + fmt(rWeakest.total) + "** (" + pct(rWeakest.total / rTotal) + ")" + rWeakestRR + "."
        });

        tables.push({
          title: "Revenue by " + regionField,
          headers: [regionField, "Revenue", "Share", "Orders", "AOV"],
          rows: rRanking.map(function (r) {
            return [r.label, fmt(r.total), pct(r.total / rTotal), r.count.toLocaleString(), fmt(r.count ? r.total / r.count : 0)];
          })
        });

        // AOV comparison
        var aovs = rRanking.map(function (r) { return { label: r.label, aov: r.count ? r.total / r.count : 0 }; }).sort(function (a, b) { return b.aov - a.aov; });
        if (aovs.length >= 2 && aovs[0].aov > aovs.at(-1).aov * 1.2) {
          sections.push({
            title: "AOV Gap",
            type: "warning",
            content: "**" + aovs[0].label + "** has a " + fmt(aovs[0].aov) + " AOV — " + (aovs[0].aov / aovs.at(-1).aov).toFixed(1) + "x **" + aovs.at(-1).label + "**'s " + fmt(aovs.at(-1).aov) + ". Study what drives higher-value orders in " + aovs[0].label + "."
          });
        }

        recommendations.push("Replicate " + rLeader.label + "'s approach (highest AOV: " + fmt(rLeader.total / rLeader.count) + ") across underperforming " + regionField + "s.");
      }
    }

    // ── Product Analysis ───────────────────────────────────────────────────

    if (productField) {
      var pGroups = groupAgg(rows, metric, productField);
      var pRanking = sortedGroup(pGroups);
      var pTotal = pRanking.reduce(function (s, r) { return s + r.total; }, 0);

      if (pRanking.length >= 2) {
        var pLeader = pRanking[0];
        var pWeakest = pRanking.at(-1);

        sections.push({
          title: "Product Performance",
          type: "finding",
          content: "**" + pLeader.label + "** is the top product at **" + fmt(pLeader.total) + "** (" + pct(pLeader.total / pTotal) + "). **" + pWeakest.label + "** generates the least at **" + fmt(pWeakest.total) + "** (" + pct(pWeakest.total / pTotal) + ")."
        });

        tables.push({
          title: "Revenue by " + productField,
          headers: [productField, "Revenue", "Share", "Orders", "AOV"],
          rows: pRanking.map(function (r) {
            return [r.label, fmt(r.total), pct(r.total / pTotal), r.count.toLocaleString(), fmt(r.count ? r.total / r.count : 0)];
          })
        });

        if (returnField) {
          var prr = groupReturnRate(rows, returnField, productField);
          if (prr.length) {
            tables.push({
              title: "Return Rate by " + productField,
              headers: [productField, "Return Rate", "Orders"],
              rows: prr.map(function (r) { return [r.label, pct(r.rate), r.count.toLocaleString()]; })
            });
            var worstProduct = prr[0];
            if (worstProduct.rate > 0.2) {
              warnings.push(worstProduct.label + " has a " + pct(worstProduct.rate) + " return rate — check product quality or descriptions.");
              recommendations.push("Investigate root causes for " + worstProduct.label + " returns (quality, sizing, description accuracy).");
            }
          }
        }
      }
    }

    // ── Time Series / Trend ────────────────────────────────────────────────

    if (dateField) {
      var buckets = {};
      rows.forEach(function (row) {
        var d = new Date(String(row[dateField] ?? ""));
        var v = nv(row[metric]);
        if (Number.isNaN(d.getTime()) || v === null) return;
        var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
        buckets[key].total += v;
        buckets[key].count++;
      });

      var series = Object.keys(buckets).sort().map(function (k) {
        return { label: k, total: buckets[k].total, count: buckets[k].count };
      });

      if (series.length >= 3) {
        var revenues = series.map(function (s) { return s.total; });
        var changes = [];
        for (var i = 1; i < revenues.length; i++) changes.push(revenues[i] - revenues[i - 1]);
        var positive = changes.filter(function (c) { return c > 0; }).length;
        var consistency = (positive / changes.length) * 100;

        var firstHalf = revenues.slice(0, Math.floor(revenues.length / 2));
        var secondHalf = revenues.slice(Math.floor(revenues.length / 2));
        var firstAvg = firstHalf.reduce(function (s, v) { return s + v; }, 0) / firstHalf.length;
        var secondAvg = secondHalf.reduce(function (s, v) { return s + v; }, 0) / secondHalf.length;
        var halfChange = firstAvg > 0 ? ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100 : 0;

        var trendDesc;
        if (consistency >= 75) {
          trendDesc = "Strong upward momentum — " + consistency.toFixed(0) + "% of periods showed growth.";
          recommendations.push("Increase investment in this trajectory; set ambitious but achievable targets.");
        } else if (consistency <= 25) {
          trendDesc = "Persistent decline — " + (100 - consistency).toFixed(0) + "% of periods showed decrease.";
          warnings.push("Revenue trend is persistently declining. Investigate root causes.");
          recommendations.push("Conduct root-cause analysis on declining periods; identify what changed.");
        } else {
          trendDesc = "Mixed momentum — " + positive + " up periods and " + (changes.length - positive) + " down periods across " + revenues.length + " months.";
        }
        if (Math.abs(halfChange) >= 15) {
          trendDesc += " Second-half average is " + (halfChange > 0 ? "+" : "") + halfChange.toFixed(1) + "% vs first half.";
        }

        // Volatility
        var cv = stdDev(revenues) / (revenues.reduce(function (s, v) { return s + v; }, 0) / revenues.length) * 100;
        if (cv > 30) {
          trendDesc += " Month-to-month variation is high (" + cv.toFixed(0) + "% CV) — treat projections as directional.";
        }

        sections.push({ title: "Trend Analysis", type: "finding", content: trendDesc });

        tables.push({
          title: "Monthly " + metric,
          headers: ["Month", "Revenue", "Orders"],
          rows: series.slice(-12).map(function (s) { return [s.label, fmt(s.total), s.count.toLocaleString()]; })
        });

        // YoY
        var yearBuckets = {};
        rows.forEach(function (row) {
          var d = new Date(String(row[dateField] ?? ""));
          var v = nv(row[metric]);
          if (Number.isNaN(d.getTime()) || v === null) return;
          var y = d.getFullYear();
          yearBuckets[y] = (yearBuckets[y] || 0) + v;
        });
        var years = Object.keys(yearBuckets).sort().map(function (y) { return { year: y, total: yearBuckets[y] }; });
        if (years.length >= 2) {
          var yoy = ((years[years.length - 1].total - years[0].total) / years[0].total) * 100;
          kpis.push({ label: "YOY GROWTH", value: yoy.toFixed(1) + "%", positive: yoy > 0 });
        }
      }
    }

    // ── Discount Analysis ──────────────────────────────────────────────────

    if (discountField) {
      var discVals = rows.map(function (r) { return nv(r[discountField]); }).filter(function (v) { return v !== null; });
      if (discVals.length) {
        var avgDisc = discVals.reduce(function (s, v) { return s + v; }, 0) / discVals.length;
        var discounted = discVals.filter(function (v) { return v > 0; }).length;
        var discRate = discounted / discVals.length;

        kpis.push({ label: "AVG DISCOUNT", value: (avgDisc <= 1 ? avgDisc * 100 : avgDisc).toFixed(1) + "%" });

        if (discRate > 0.5) {
          warnings.push((discRate * 100).toFixed(0) + "% of orders have discounts. Verify discounts drive profitable growth, not just volume.");
          recommendations.push("Run controlled promotion tests; measure impact on net revenue and returns, not just order count.");
        }

        // Discount vs returns cross-tab
        if (returnField) {
          var discRetGroups = {};
          rows.forEach(function (row) {
            var d = nv(row[discountField]);
            var r = nv(row[returnField]);
            if (d === null || r === null) return;
            if (!discRetGroups[d]) discRetGroups[d] = { total: 0, returned: 0 };
            discRetGroups[d].total++;
            if (r > 0) discRetGroups[d].returned++;
          });
          var discRetTable = Object.keys(discRetGroups).sort().map(function (d) {
            var g = discRetGroups[d];
            return [(Number(d) * 100).toFixed(0) + "%", g.total.toLocaleString(), g.total ? pct(g.returned / g.total) : "0%"];
          });
          if (discRetTable.length > 1) {
            tables.push({ title: "Discount vs Return Rate", headers: ["Discount", "Orders", "Return Rate"], rows: discRetTable });
          }
        }
      }
    }

    // ── Return Analysis ────────────────────────────────────────────────────

    if (returnField) {
      var overallRR = returnRate(rows, returnField);
      kpis.push({ label: "RETURN RATE", value: pct(overallRR), positive: overallRR < 0.15 });

      if (overallRR > 0.2) {
        warnings.push("Overall return rate of " + pct(overallRR) + " is above industry norms (8-15%). This is a major margin leak.");
        recommendations.push("Prioritize return reduction: audit return reasons, refund values, and root causes by product and region.");
      }

      // High-value order returns
      var p90 = values.sort(function (a, b) { return a - b; })[Math.floor(values.length * 0.9)] || 0;
      var highOrders = rows.filter(function (r) { var v = nv(r[metric]); return v !== null && v >= p90; });
      if (highOrders.length > 0) {
        var highRR = returnRate(highOrders, returnField);
        if (highRR > overallRR + 0.05) {
          sections.push({ title: "High-Value Return Risk", type: "warning", content: "Orders above " + fmt(p90) + " return at " + pct(highRR) + " vs " + pct(overallRR) + " overall. Expensive items are returned disproportionately — inspect fulfillment quality." });
        }
      }
    }

    // ── Payment Method Analysis ────────────────────────────────────────────

    if (paymentField) {
      var payGroups = groupAgg(rows, metric, paymentField);
      var payRanking = sortedGroup(payGroups);

      if (payRanking.length >= 2) {
        tables.push({
          title: "Revenue by " + paymentField,
          headers: [paymentField, "Revenue", "Orders", "AOV"],
          rows: payRanking.map(function (r) {
            return [r.label, fmt(r.total), r.count.toLocaleString(), fmt(r.count ? r.total / r.count : 0)];
          })
        });

        if (returnField) {
          var payRR = groupReturnRate(rows, returnField, paymentField);
          if (payRR.length) {
            var worstPay = payRR[0];
            if (worstPay.rate > 0.25) {
              warnings.push(worstPay.label + " has a " + pct(worstPay.rate) + " return rate — consider incentives for lower-return payment methods.");
            }
          }
        }
      }
    }

    // ── Customer Type Analysis ─────────────────────────────────────────────

    if (custTypeField) {
      var ctGroups = groupAgg(rows, metric, custTypeField);
      var ctRanking = sortedGroup(ctGroups);
      var ctTotal = ctRanking.reduce(function (s, r) { return s + r.total; }, 0);

      if (ctRanking.length >= 2) {
        sections.push({
          title: "Customer Segment Analysis",
          type: "finding",
          content: ctRanking.map(function (r) {
            return "**" + r.label + "**: " + fmt(r.total) + " (" + pct(r.total / ctTotal) + "), " + r.count.toLocaleString() + " orders, " + fmt(r.count ? r.total / r.count : 0) + " AOV";
          }).join("; ") + "."
        });
      }
    }

    // ── Store Analysis ─────────────────────────────────────────────────────

    if (storeField) {
      var sGroups = groupAgg(rows, metric, storeField);
      var sRanking = sortedGroup(sGroups);
      if (sRanking.length >= 2) {
        tables.push({
          title: "Revenue by " + storeField,
          headers: [storeField, "Revenue", "Orders", "AOV"],
          rows: sRanking.map(function (r) {
            return [r.label, fmt(r.total), r.count.toLocaleString(), fmt(r.count ? r.total / r.count : 0)];
          })
        });
      }
    }

    // ── Salesperson Analysis ───────────────────────────────────────────────

    if (spField) {
      var spGroups = groupAgg(rows, metric, spField);
      var spRanking = sortedGroup(spGroups);
      if (spRanking.length >= 2) {
        var spLeader = spRanking[0];
        var spWeakest = spRanking.at(-1);
        kpis.push({ label: "TOP " + spField.toUpperCase(), value: spLeader.label, change: fmt(spLeader.total) });
        sections.push({
          title: "Salesperson Performance",
          type: "finding",
          content: "**" + spLeader.label + "** leads with **" + fmt(spLeader.total) + "** across " + spLeader.count + " orders (" + fmt(spLeader.count ? spLeader.total / spLeader.count : 0) + " AOV). **" + spWeakest.label + "** trails at **" + fmt(spWeakest.total) + "**."
        });
        recommendations.push("Study " + spLeader.label + "'s sales practices and create a playbook for the team.");
      }
    }

    // ── Shipping Analysis ──────────────────────────────────────────────────

    if (shipField) {
      var shipTotal = rows.reduce(function (s, r) { var v = nv(r[shipField]); return s + (v || 0); }, 0);
      var shipAvg = rows.length ? shipTotal / rows.length : 0;
      kpis.push({ label: "AVG SHIPPING", value: "$" + shipAvg.toFixed(2) });
      if (total > 0) {
        var shipPct = (shipTotal / total) * 100;
        if (shipPct > 2) {
          warnings.push("Shipping costs are " + shipPct.toFixed(1) + "% of revenue — optimize logistics or renegotiate carrier rates.");
        }
      }
    }

    // ── Anomaly Detection ──────────────────────────────────────────────────

    if (values.length >= 8) {
      var mean = values.reduce(function (s, v) { return s + v; }, 0) / values.length;
      var sd = stdDev(values);
      var upper = mean + 2 * sd;
      var anomalies = values.filter(function (v) { return v > upper; });
      if (anomalies.length > 0) {
        sections.push({
          title: "Anomaly Detection",
          type: "warning",
          content: anomalies.length + " anomalous order" + (anomalies.length === 1 ? "" : "s") + " detected (>" + fmt(upper) + "). These may indicate bulk orders, data errors, or exceptional opportunities."
        });
        recommendations.push("Flag high-value orders at checkout for review; investigate if anomalies represent data errors or genuine large orders.");
      }
    }

    // ── Concentration Risk ─────────────────────────────────────────────────

    var concDim = regionField || productField;
    if (concDim) {
      var cGroups = groupAgg(rows, metric, concDim);
      var cSorted = Object.keys(cGroups).map(function (k) { return cGroups[k].total; }).sort(function (a, b) { return b - a; });
      var top3 = cSorted.slice(0, 3).reduce(function (s, v) { return s + v; }, 0);
      var top3Pct = total ? top3 / total : 0;
      if (top3Pct >= 0.7) {
        warnings.push("Top 3 " + concDim + "s account for " + (top3Pct * 100).toFixed(0) + "% of revenue — high concentration risk.");
        recommendations.push("Diversify revenue across " + concDim + "s to reduce dependency on top performers.");
      }
    }

    // ── Cross-Dimensional (Region x Product) ───────────────────────────────

    if (regionField && productField) {
      var combos = {};
      rows.forEach(function (row) {
        var v = nv(row[metric]);
        if (v === null) return;
        var key = String(row[regionField] ?? "?") + " | " + String(row[productField] ?? "?");
        if (!combos[key]) combos[key] = { total: 0, count: 0 };
        combos[key].total += v;
        combos[key].count++;
      });
      var topCombos = Object.keys(combos).map(function (k) { return { label: k, total: combos[k].total, count: combos[k].count }; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
      if (topCombos.length) {
        tables.push({
          title: "Top " + regionField + " x " + productField + " Combinations",
          headers: ["Combination", "Revenue", "Orders"],
          rows: topCombos.map(function (c) { return [c.label, fmt(c.total), c.count.toLocaleString()]; })
        });
      }
    }

    // ── Financial Impact Estimates ─────────────────────────────────────────

    if (returnField && values.length > 0) {
      var rr = returnRate(rows, returnField);
      if (rr > 0.15) {
        var savedIfImproved = total * (rr - 0.15);
        sections.push({
          title: "Financial Impact Estimate",
          type: "recommendation",
          content: "Reducing returns from " + pct(rr) + " to 15% could recover approximately **" + fmt(savedIfImproved) + "** in annual revenue."
        });
      }
    }

    // ── Data Quality ───────────────────────────────────────────────────────

    var quality = qualitySummary(rows);
    sections.push({
      title: "Data Quality",
      type: "text",
      content: "**" + quality.completeness + "%** cell completeness. **" + quality.duplicates + "** duplicate row" + (quality.duplicates === 1 ? "" : "s") + ". " + columns.length + " fields detected."
    });

    // ── Data Quality Audit (via DataCleaner) ─────────────────────────────

    if (window.DataCleaner) {
      var qr = window.DataCleaner.qualityReport(rows);
      if (qr && qr.issues.length) {
        var auditLines = [];
        if (qr.highSeverity) auditLines.push("**" + qr.highSeverity + "** high-severity issue" + (qr.highSeverity === 1 ? "" : "s"));
        if (qr.mediumSeverity) auditLines.push("**" + qr.mediumSeverity + "** medium-severity issue" + (qr.mediumSeverity === 1 ? "" : "s"));
        if (qr.lowSeverity) auditLines.push("**" + qr.lowSeverity + "** low-severity issue" + (qr.lowSeverity === 1 ? "" : "s"));

        sections.push({
          title: "Data Quality Audit",
          type: qr.highSeverity ? "warning" : "finding",
          content: "Detected **" + qr.totalIssues + "** data quality issue" + (qr.totalIssues === 1 ? "" : "s") + " across " + columns.length + " fields: " + auditLines.join(", ") + ". Open the Analyst Console → Clean data to fix these automatically."
        });

        tables.push({
          title: "Data Quality Issues",
          headers: ["Column", "Issue", "Severity", "Detail"],
          rows: qr.issues.slice(0, 12).map(function (issue) {
            return [issue.column, issue.type.replace("_", " "), issue.severity, issue.detail];
          })
        });

        if (qr.highSeverity) {
          warnings.push("Dataset has " + qr.highSeverity + " high-severity data quality issues. Run auto-clean before drawing conclusions.");
        }
      }
    }

    // ── Final Recommendations ──────────────────────────────────────────────

    if (!recommendations.length) {
      recommendations.push("Upload a dataset with region, product, and date fields for richer analysis.");
    }

    var summary = sections.find(function (s) { return s.title === "Executive Summary"; });

    return {
      title: "Comprehensive Data Analysis Report",
      dataset: { rows: rows.length, columns: columns.length },
      summary: summary ? summary.content : "",
      kpis: kpis,
      sections: sections,
      tables: tables,
      recommendations: recommendations.slice(0, 8),
      warnings: warnings
    };
  }

  function qualitySummary(rows) {
    var total = 0, missing = 0;
    rows.forEach(function (row) {
      Object.values(row).forEach(function (v) {
        total++;
        if (v == null || String(v).trim() === "") missing++;
      });
    });
    return {
      total: total,
      missing: missing,
      completeness: total ? Math.round((1 - missing / total) * 100) : 0,
      duplicates: rows.length - new Set(rows.map(function (r) { return JSON.stringify(r); })).size
    };
  }

  // ── SVG Chart Generators ────────────────────────────────────────────────

  var chartColors = ["#7982ff", "#4dd5a0", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#2dd4bf", "#fb923c", "#60a5fa", "#22d3ee"];

  function svgBarChart(data, width, height) {
    if (!data.length) return "";
    var w = width || 700, h = height || 220, pad = { top: 10, right: 10, bottom: 40, left: 60 };
    var iw = w - pad.left - pad.right, ih = h - pad.top - pad.bottom;
    var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }));
    if (maxVal === 0) return "";
    var barW = Math.min(50, (iw / data.length) * 0.7);
    var gap = (iw - barW * data.length) / (data.length + 1);

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px">';
    // Grid lines
    for (var g = 0; g <= 4; g++) {
      var gy = pad.top + ih - (ih * g / 4);
      var gv = (maxVal * g / 4);
      svg += '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (w - pad.right) + '" y2="' + gy + '" stroke="#1e2d45" stroke-dasharray="3 4"/>';
      svg += '<text x="' + (pad.left - 8) + '" y="' + (gy + 4) + '" fill="#64748b" font-size="10" text-anchor="end" font-family="DM Mono,monospace">' + (gv >= 1e6 ? (gv/1e6).toFixed(1)+"M" : gv >= 1e3 ? (gv/1e3).toFixed(0)+"K" : gv.toFixed(0)) + '</text>';
    }
    // Bars
    data.forEach(function (d, i) {
      var x = pad.left + gap + i * (barW + gap);
      var bh = (d.value / maxVal) * ih;
      var y = pad.top + ih - bh;
      var color = chartColors[i % chartColors.length];
      svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh + '" rx="4" fill="' + color + '" opacity="0.9"><animate attributeName="height" from="0" to="' + bh + '" dur="0.6s" fill="freeze"/><animate attributeName="y" from="' + (pad.top + ih) + '" to="' + y + '" dur="0.6s" fill="freeze"/></rect>';
      // Label
      var label = d.label.length > 12 ? d.label.slice(0, 10) + "…" : d.label;
      svg += '<text x="' + (x + barW / 2) + '" y="' + (pad.top + ih + 16) + '" fill="#94a3b8" font-size="10" text-anchor="middle">' + label + '</text>';
      // Value on top
      svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 5) + '" fill="#e2e8f0" font-size="10" text-anchor="middle" font-weight="600">' + (d.value >= 1e6 ? "$"+(d.value/1e6).toFixed(1)+"M" : d.value >= 1e3 ? "$"+(d.value/1e3).toFixed(0)+"K" : "$"+d.value.toFixed(0)) + '</text>';
    });
    svg += '</svg>';
    return '<div class="report-chart-wrap"><svg-bar>' + svg + '</svg-bar></div>';
  }

  function svgLineChart(data, width, height) {
    if (!data.length) return "";
    var w = width || 700, h = height || 220, pad = { top: 15, right: 15, bottom: 35, left: 60 };
    var iw = w - pad.left - pad.right, ih = h - pad.top - pad.bottom;
    var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }));
    var minVal = Math.min.apply(null, data.map(function (d) { return d.value; }));
    var range = maxVal - minVal || 1;

    var points = data.map(function (d, i) {
      var x = pad.left + (i / (data.length - 1)) * iw;
      var y = pad.top + ih - ((d.value - minVal) / range) * ih;
      return { x: x, y: y, v: d.value, l: d.label };
    });

    var pathD = points.map(function (p, i) { return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
    var areaD = pathD + " L" + points[points.length - 1].x + "," + (pad.top + ih) + " L" + points[0].x + "," + (pad.top + ih) + " Z";

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px">';
    // Gradient
    svg += '<defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#7982ff" stop-opacity="0.3"/><stop offset="100%" stop-color="#7982ff" stop-opacity="0"/></linearGradient></defs>';
    // Grid
    for (var g = 0; g <= 4; g++) {
      var gy = pad.top + ih - (ih * g / 4);
      var gv = minVal + range * g / 4;
      svg += '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (w - pad.right) + '" y2="' + gy + '" stroke="#1e2d45" stroke-dasharray="3 4"/>';
      svg += '<text x="' + (pad.left - 8) + '" y="' + (gy + 4) + '" fill="#64748b" font-size="10" text-anchor="end" font-family="DM Mono,monospace">' + (gv >= 1e6 ? (gv/1e6).toFixed(1)+"M" : gv >= 1e3 ? (gv/1e3).toFixed(0)+"K" : gv.toFixed(0)) + '</text>';
    }
    // Area
    svg += '<path d="' + areaD + '" fill="url(#areaFill)"/>';
    // Line
    svg += '<path d="' + pathD + '" fill="none" stroke="#7982ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    // Dots
    points.forEach(function (p, i) {
      svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#7982ff" stroke="#0a101d" stroke-width="2"/>';
      if (i === points.length - 1) {
        svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="6" fill="none" stroke="#7982ff" stroke-width="2" opacity="0.4"/>';
      }
    });
    // X-axis labels
    points.forEach(function (p) {
      var label = p.l.length > 8 ? p.l.slice(0, 6) + "…" : p.l;
      svg += '<text x="' + p.x + '" y="' + (pad.top + ih + 18) + '" fill="#94a3b8" font-size="9" text-anchor="middle">' + label + '</text>';
    });
    svg += '</svg>';
    return '<div class="report-chart-wrap"><svg-line>' + svg + '</svg-line></div>';
  }

  function svgDonut(data, width, height) {
    if (!data.length) return "";
    var w = width || 300, h = height || 260;
    var cx = w / 2, cy = h / 2, r = 80, inner = 50;
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (total === 0) return "";

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;max-width:' + w + 'px;height:' + h + 'px">';
    var angle = -Math.PI / 2;

    data.forEach(function (d, i) {
      var slice = (d.value / total) * 2 * Math.PI;
      var endAngle = angle + slice;
      var largeArc = slice > Math.PI ? 1 : 0;

      var x1 = cx + r * Math.cos(angle);
      var y1 = cy + r * Math.sin(angle);
      var x2 = cx + r * Math.cos(endAngle);
      var y2 = cy + r * Math.sin(endAngle);
      var ix1 = cx + inner * Math.cos(angle);
      var iy1 = cy + inner * Math.sin(angle);
      var ix2 = cx + inner * Math.cos(endAngle);
      var iy2 = cy + inner * Math.sin(endAngle);

      var path = 'M' + x1.toFixed(2) + ',' + y1.toFixed(2) +
        ' A' + r + ',' + r + ' 0 ' + largeArc + ',1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) +
        ' L' + ix2.toFixed(2) + ',' + iy2.toFixed(2) +
        ' A' + inner + ',' + inner + ' 0 ' + largeArc + ',0 ' + ix1.toFixed(2) + ',' + iy1.toFixed(2) + ' Z';

      svg += '<path d="' + path + '" fill="' + chartColors[i % chartColors.length] + '" opacity="0.85"><animate attributeName="opacity" from="0" to="0.85" dur="0.5s" fill="freeze"/></path>';
      angle = endAngle;
    });

    // Center text
    svg += '<text x="' + cx + '" y="' + (cy - 4) + '" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">' + data.length + '</text>';
    svg += '<text x="' + cx + '" y="' + (cy + 12) + '" fill="#64748b" font-size="10" text-anchor="middle">segments</text>';

    svg += '</svg>';

    // Legend
    var legend = '<div class="report-donut-legend">';
    data.forEach(function (d, i) {
      var pct = ((d.value / total) * 100).toFixed(1);
      legend += '<div class="report-donut-item"><span class="report-donut-dot" style="background:' + chartColors[i % chartColors.length] + '"></span>';
      legend += '<span class="report-donut-label">' + d.label + '</span>';
      legend += '<span class="report-donut-pct">' + pct + '%</span></div>';
    });
    legend += '</div>';

    return '<div class="report-chart-wrap report-donut-wrap">' + svg + legend + '</div>';
  }

  function svgHeatBar(value, max, color) {
    var pct = max > 0 ? (value / max) * 100 : 0;
    return '<div class="report-heat-bar"><div class="report-heat-fill" style="width:' + pct + '%;background:' + (color || '#7982ff') + '"></div></div>';
  }

  // ── Table-to-Chart helpers ─────────────────────────────────────────────

  function tableToBarData(tbl) {
    var labelIdx = 0;
    var valueIdx = -1;
    tbl.headers.forEach(function (h, i) { if (/revenue|total|amount|sales|value/i.test(h)) valueIdx = i; });
    if (valueIdx === -1) return [];
    return tbl.rows.map(function (r) {
      var v = nv(r[valueIdx]);
      return v !== null ? { label: r[labelIdx], value: v } : null;
    }).filter(Boolean);
  }

  function tableToLineData(tbl) {
    return tableToBarData(tbl);
  }

  function tableToDonutData(tbl) {
    var labelIdx = 0;
    var shareIdx = -1, valueIdx = -1;
    tbl.headers.forEach(function (h, i) {
      if (/share/i.test(h)) shareIdx = i;
      if (/revenue|total|amount|sales|value/i.test(h)) valueIdx = i;
    });
    if (shareIdx !== -1) {
      return tbl.rows.slice(0, 8).map(function (r) {
        var v = parseFloat(r[shareIdx]) || 0;
        return v > 0 ? { label: r[labelIdx], value: v } : null;
      }).filter(Boolean);
    }
    if (valueIdx !== -1) {
      return tbl.rows.slice(0, 8).map(function (r) {
        var v = nv(r[valueIdx]);
        return v !== null && v > 0 ? { label: r[labelIdx], value: v } : null;
      }).filter(Boolean);
    }
    return [];
  }

  // ── Report Renderer ──────────────────────────────────────────────────────

  function renderReport(report) {
    if (!report) return "<p>No data to analyze.</p>";

    var html = '<div class="report-container">';

    // Title + summary
    html += '<div class="report-header">';
    html += '<p class="eyebrow">ANALYSIS REPORT</p>';
    html += '<h2>' + report.title + '</h2>';
    html += '<p class="report-summary">' + report.summary + '</p>';
    html += '<div class="report-meta">' + report.dataset.rows.toLocaleString() + ' records · ' + report.dataset.columns + ' fields</div>';
    html += '</div>';

    // KPIs with progress bars
    if (report.kpis.length) {
      html += '<p class="report-subhead">KEY METRICS</p>';
      html += '<div class="report-kpis">';
      report.kpis.forEach(function (kpi) {
        var cls = "report-kpi";
        if (kpi.positive === true) cls += " positive";
        if (kpi.positive === false) cls += " negative";
        html += '<div class="' + cls + '">';
        html += '<small>' + kpi.label + '</small>';
        html += '<strong>' + kpi.value + '</strong>';
        if (kpi.change) html += '<span>' + kpi.change + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Warnings
    if (report.warnings.length) {
      html += '<div class="report-warnings">';
      html += '<h3>⚠ Risks to Investigate</h3>';
      report.warnings.forEach(function (w) { html += '<div class="report-warning-item">' + w + '</div>'; });
      html += '</div>';
    }

    // ── Charts from tables ──
    var chartTables = [];
    var nonChartTables = [];

    report.tables.forEach(function (tbl) {
      var isMonthly = /monthly|trend|over time/i.test(tbl.title);
      var hasRevenue = /revenue|total|amount|sales/i.test(tbl.title);
      var isShare = /share|composition|breakdown/i.test(tbl.title);

      if (isMonthly) {
        var lineData = tableToLineData(tbl);
        if (lineData.length >= 3) {
          html += svgLineChart(lineData);
          return;
        }
      }

      if (hasRevenue || isShare) {
        var barData = tableToBarData(tbl);
        if (barData.length >= 2) {
          if (barData.length <= 6) {
            var donutData = tableToDonutData(tbl);
            if (donutData.length >= 2) {
              html += '<div class="report-chart-row">';
              html += svgBarChart(barData);
              html += svgDonut(donutData);
              html += '</div>';
            } else {
              html += svgBarChart(barData);
            }
          } else {
            html += svgBarChart(barData);
          }
          return;
        }
      }

      // Fallback: try bar chart from any table with numeric data
      var fallbackData = tableToBarData(tbl);
      if (fallbackData.length >= 2 && fallbackData.length <= 10) {
        html += svgBarChart(fallbackData);
        return;
      }

      nonChartTables.push(tbl);
    });

    // Sections
    report.sections.forEach(function (sec) {
      if (sec.title === "Executive Summary") return;
      var icon = sec.type === "recommendation" ? "→" : sec.type === "warning" ? "⚠" : sec.type === "finding" ? "✦" : "·";
      html += '<div class="report-section report-' + sec.type + '">';
      html += '<h3>' + icon + ' ' + sec.title + '</h3>';
      html += '<div class="report-section-content">' + formatMarkdown(sec.content) + '</div>';
      html += '</div>';
    });

    // Remaining tables (no chart)
    nonChartTables.forEach(function (tbl) {
      html += '<div class="report-table-wrap">';
      html += '<h3>' + tbl.title + '</h3>';
      html += '<div class="table-scroll"><table class="report-table">';
      html += '<thead><tr>' + tbl.headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>';
      html += '<tbody>' + tbl.rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
      html += '</table></div></div>';
    });

    // Recommendations
    if (report.recommendations.length) {
      html += '<div class="report-recommendations">';
      html += '<h3>→ Prioritized Recommendations</h3>';
      html += '<ol>';
      report.recommendations.forEach(function (r) { html += '<li>' + r + '</li>'; });
      html += '</ol></div>';
    }

    // Footer
    html += '<div class="report-footer">';
    html += '<em>Decision note: This report is based on recorded values in the uploaded dataset. Add cost, margin, and refund amounts to evaluate profitability rather than revenue alone.</em>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  // ── Export ───────────────────────────────────────────────────────────────

  window.generateReport = generateReport;
  window.renderReport = renderReport;

})();
