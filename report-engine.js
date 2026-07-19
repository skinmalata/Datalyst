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

    // KPIs
    if (report.kpis.length) {
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

    // Sections
    report.sections.forEach(function (sec) {
      if (sec.title === "Executive Summary") return; // already rendered
      var icon = sec.type === "recommendation" ? "→" : sec.type === "warning" ? "⚠" : sec.type === "finding" ? "✦" : "·";
      html += '<div class="report-section report-' + sec.type + '">';
      html += '<h3>' + icon + ' ' + sec.title + '</h3>';
      html += '<div class="report-section-content">' + formatMarkdown(sec.content) + '</div>';
      html += '</div>';
    });

    // Tables
    report.tables.forEach(function (tbl) {
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
