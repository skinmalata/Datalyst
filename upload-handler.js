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
    document.querySelector("#datasets").classList.add("hidden");

    document.querySelector(".command-card").scrollIntoView({ behavior: "smooth", block: "center" });

    toast("Data loaded. Use the analysis wizard or ask a question above.");

    setTimeout(() => {
      document.querySelector("#openWizard")?.click();
    }, 800);

  } catch {
    toast("We could not find a usable data table. Try CSV, TSV, TXT, or JSON.");
  }
};
