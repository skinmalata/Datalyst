document.querySelector("#fileInput").onchange = async (event) => {
  const selected = event.target.files[0];
  if (!selected) return;

  file = selected.name;

  try {
    const parsed = await window.datalystParseFile(selected);
    rows = parsed.rows;

    if (!rows.length) throw new Error();

    stats();
    table();

    document.querySelector("#previewTitle").textContent = file;
    document.querySelector("#uploadModal").classList.add("hidden");
    document.querySelector("#datasets").classList.remove("hidden");

    toast(
      parsed.tableCount > 1
        ? "Found " + parsed.tableCount + " report tables; using " + parsed.tableName + "."
        : "Data source added successfully."
    );
  } catch {
    toast("We could not find a usable data table. Try CSV, TSV, TXT, or JSON.");
  }
};
