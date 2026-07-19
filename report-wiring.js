(function () {
  var modal = document.getElementById("reportModal");
  var content = document.getElementById("reportContent");
  var closeBtn = document.getElementById("closeReport");
  var genBtn = document.getElementById("generateReport");

  if (closeBtn) {
    closeBtn.onclick = function () {
      modal.classList.add("hidden");
    };
  }

  if (genBtn) {
    genBtn.onclick = openReport;
  }

  var quickReport = document.getElementById("quickReport");
  if (quickReport) {
    quickReport.onclick = openReport;
  }

  function openReport() {
    if (!window.rows || !window.rows.length) {
      if (typeof toast === "function") toast("Upload a dataset first to generate a report.");
      return;
    }

    modal.classList.remove("hidden");
    content.innerHTML = '<div class="report-loading"><div class="spinner"></div><p>Analyzing your data across all dimensions...</p></div>';

    setTimeout(function () {
      try {
        var report = window.generateReport(window.rows);
        if (!report) {
          content.innerHTML = '<div class="report-loading"><p>Could not generate a report from this data.</p></div>';
          return;
        }
        content.innerHTML = window.renderReport(report);
      } catch (err) {
        content.innerHTML = '<div class="report-loading"><p>Report generation failed: ' + (err.message || "Unknown error") + '</p></div>';
      }
    }, 100);
  }

  // Also wire the "Export report" button to export the full report as text
  var exportBtn = document.getElementById("exportReport");
  if (exportBtn) {
    var originalExport = exportBtn.onclick;
    exportBtn.onclick = function () {
      if (!window.rows || !window.rows.length) {
        if (typeof toast === "function") toast("No data to export.");
        return;
      }
      try {
        var report = window.generateReport(window.rows);
        if (!report) return;

        var lines = [];
        lines.push("DATALYST ANALYSIS REPORT");
        lines.push("=".repeat(60));
        lines.push("");
        lines.push(report.title);
        lines.push("");
        report.kpis.forEach(function (kpi) {
          lines.push("  " + kpi.label + ": " + kpi.value + (kpi.change ? " (" + kpi.change + ")" : ""));
        });
        lines.push("");
        lines.push("-".repeat(60));

        report.warnings.forEach(function (w) {
          lines.push("RISK: " + w);
        });

        report.sections.forEach(function (sec) {
          lines.push("");
          lines.push(sec.title.toUpperCase());
          lines.push("-".repeat(40));
          lines.push(sec.content.replace(/\*\*/g, ""));
        });

        report.tables.forEach(function (tbl) {
          lines.push("");
          lines.push(tbl.title);
          lines.push(tbl.headers.join("\t"));
          tbl.rows.forEach(function (r) { lines.push(r.join("\t")); });
        });

        lines.push("");
        lines.push("RECOMMENDATIONS");
        lines.push("-".repeat(40));
        report.recommendations.forEach(function (r, i) {
          lines.push((i + 1) + ". " + r);
        });

        lines.push("");
        lines.push("Decision note: This report is based on recorded values in the uploaded dataset.");

        var blob = new Blob([lines.join("\n")], { type: "text/plain" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "datalyst-analysis-report.txt";
        a.click();
        URL.revokeObjectURL(a.href);
        if (typeof toast === "function") toast("Full analysis report exported.");
      } catch (err) {
        if (typeof toast === "function") toast("Export failed: " + (err.message || "Unknown error"));
      }
    };
  }
})();
