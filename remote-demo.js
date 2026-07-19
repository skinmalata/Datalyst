(() => {
  const config = window.DATALYST_CONFIG || {};
  const ready = Boolean(
    config.apiBaseUrl &&
    config.auth0Domain &&
    config.auth0ClientId &&
    window.createAuth0Client
  );

  if (!ready) return;

  const state = {
    client: null,
    token: null,
    organizationId: localStorage.getItem("datalyst.organizationId") || "",
    datasetId: "",
  };

  const api = async (path, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      authorization: `Bearer ${state.token}`,
      "content-type": "application/json",
    };

    if (state.organizationId) {
      headers["x-organization-id"] = state.organizationId;
    }

    const response = await fetch(
      `${config.apiBaseUrl.replace(/\/$/, "")}${path}`,
      { ...options, headers }
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || "The request could not be completed.");
    }

    return body;
  };

  const setSessionLabel = async () => {
    const slot = document.querySelector(".header-actions");
    if (!slot) return;

    let button = document.querySelector("#remoteSignIn");

    if (!button) {
      button = document.createElement("button");
      button.id = "remoteSignIn";
      button.className = "team-button";
      slot.prepend(button);
    }

    const user = await state.client.getUser();
    button.textContent = user
      ? `Signed in: ${user.name || user.email || "User"}`
      : "Sign in";

    button.onclick = () =>
      state.client.loginWithRedirect({
        authorizationParams: {
          audience: config.auth0Audience,
          redirect_uri: location.origin,
        },
      });
  };

  const ensureWorkspace = async () => {
    if (state.organizationId) return;

    if (typeof window.showOnboarding === "function") {
      window._datalystToken = state.token;
      window.showOnboarding();
      return;
    }

    const workspace = await api("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({}),
    });

    state.organizationId = workspace.organization.id;
    localStorage.setItem("datalyst.organizationId", state.organizationId);
    window._datalystToken = state.token;
  };

  const csvRow = (line, delimiter) => {
    const values = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];

      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        values.push(value.trim());
        value = "";
      } else {
        value += char;
      }
    }

    values.push(value.trim());
    return values;
  };

  const tidyHeaders = (headers) => {
    const used = new Map();
    return headers.map((header, index) => {
      const base =
        String(header || "").replace(/\s+/g, " ").trim() || `Column ${index + 1}`;
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      return count === 1 ? base : `${base} ${count}`;
    });
  };

  const numericValue = (value) =>
    Number(String(value ?? "").replace(/[,$%\s]/g, ""));

  const looksLikeData = (values) => {
    const filled = values.filter((value) => String(value).trim() !== "");
    return (
      filled.length > 0 &&
      filled.filter((value) => Number.isFinite(numericValue(value))).length /
        filled.length >=
        0.5
    );
  };

  const parseFile = window.datalystParseFile;

  const metricHelp = (metric) => {
    if (/bounce.?rate/i.test(metric)) {
      return "Bounce rate is the share of visits where someone left without continuing to another page.";
    }
    if (/active.?users?/i.test(metric)) {
      return "Active users means the number of different people who visited.";
    }
    if (/event.?count/i.test(metric)) {
      return "Event count is the number of tracked actions, such as clicks or page views.";
    }
    if (/views?/i.test(metric)) {
      return "Views means the number of times a page was opened.";
    }
    return "This number comes directly from the uploaded file.";
  };

  const displayValue = (value, metric = "") => {
    const number = Number(value);

    if (!Number.isFinite(number)) return String(value);

    if (/bounce.?rate|percent|percentage/i.test(metric)) {
      return `${(number <= 1 ? number * 100 : number).toFixed(1)}%`;
    }

    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
      number
    );
  };

  const showResult = (result) => {
    const output = result.result || result;
    const title = document.querySelector(".insight-card h2");
    const copy = document.querySelector(".insight-copy");

    if (output.forecast) {
      title.textContent = `Forecast total: ${money(output.totalForecast)}`;
      copy.textContent =
        `This is an estimate, not a promise. The system tested it against earlier data ` +
        `and the average error was ${output.validation?.mapePercent}%. ${output.limitation}`;
    } else if (output.comparison) {
      title.textContent = `The result is ${money(output.value)}.`;
      copy.textContent =
        `Compared with the earlier group, it changed by ${money(output.comparison.difference)} ` +
        `(${output.comparison.percentChange?.toFixed(1) ?? "n/a"}%).`;
    } else if (Array.isArray(output.values)) {
      const metric =
        output.method?.match(/Sum of (.+?) grouped/)?.[1] || "selected metric";
      const leading = output.values[0];
      const group =
        output.method?.match(/grouped by (.+)$/)?.[1] || "items";

      title.textContent =
        `Here are the ${output.values.length} ${group} with the highest ${metric}.`;
      copy.textContent = leading
        ? `The first one is "${leading.label}" with ${displayValue(leading.value, metric)}. ` +
          `${metricHelp(metric)} We checked ${output.recordsUsed || 0} rows from your file.`
        : `We could not find matching values in this file.`;

      if (
        typeof drawEvidenceChart === "function" &&
        output.values.length
      ) {
        drawEvidenceChart(
          output.values.map((item) => Number(item.value)),
          output.values.map((item) => item.label),
          `${metric} by ${group}`
        );
      }
    } else {
      title.textContent = `The answer is ${displayValue(output.value)}.`;
      copy.textContent =
        `${output.recordsUsed || 0} rows from your uploaded file were used to calculate this.`;
    }

    window.updateAssurance?.({
      method: "Simple calculation from your uploaded data",
      note:
        `Dataset version ${result.datasetVersion || "current"}; ` +
        `${output.evidence?.recordsMatched || output.recordsUsed || 0} rows used.`,
      confidence:
        "This result was calculated from the uploaded data and saved in the audit trail.",
    });

    toast("Your analysis is ready.");
  };

  const runQuestion = async (question) => {
    if (!state.datasetId) {
      throw new Error(
        "Upload a dataset after signing in before running an API analysis."
      );
    }

    const plan = await api("/api/analyses/plan", {
      method: "POST",
      body: JSON.stringify({ datasetId: state.datasetId, question }),
    });

    const result = await api("/api/analyses", {
      method: "POST",
      body: JSON.stringify({ datasetId: state.datasetId, question, plan }),
    });

    showResult(result);
    addHistory(question);
  };

  const connectUi = () => {
    const fileInput = document.querySelector("#fileInput");

    fileInput.onchange = async (event) => {
      const selected = event.target.files[0];
      if (!selected) return;

      try {
        const parsedFile = await parseFile(selected);
        const parsed = parsedFile.rows;

        if (!parsed.length) throw new Error("The file has no data rows.");

        rows = parsed;
        file = selected.name;
        stats();
        table();

        document.querySelector("#previewTitle").textContent = file;
        document.querySelector("#uploadModal").classList.add("hidden");
        document.querySelector("#datasets").classList.remove("hidden");

        state.datasetId = (
          await api("/api/datasets", {
            method: "POST",
            body: JSON.stringify({
              name: file,
              rows: parsed,
              classification: "internal",
            }),
          })
        ).id;

        toast(
          parsedFile.tableCount > 1
            ? `Detected ${parsedFile.tableCount} report tables; using ${parsedFile.tableName}.`
            : "Dataset uploaded to the live workspace."
        );
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "We could not upload that file."
        );
      }
    };

    const fallback = window.enterpriseAnalyze;

    window.enterpriseAnalyze = (question) =>
      runQuestion(question).catch((error) => {
        toast(
          error instanceof Error
            ? error.message
            : "Live analysis failed."
        );
        fallback(question);
      });

    document.querySelector("#sendQuery").onclick = () =>
      window.enterpriseAnalyze(
        document.querySelector("#queryInput").value
      );

    document.querySelector("#queryInput").addEventListener(
      "keydown",
      (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.enterpriseAnalyze(event.target.value);
        }
      },
      true
    );
  };

  (async () => {
    state.client = await createAuth0Client({
      domain: config.auth0Domain,
      clientId: config.auth0ClientId,
      authorizationParams: {
        redirect_uri: location.origin,
        audience: config.auth0Audience,
      },
    });

    window.datalystAuth = {
      login: () =>
        state.client.loginWithRedirect({
          authorizationParams: {
            audience: config.auth0Audience,
            redirect_uri: location.origin,
          },
        }),
      signup: () =>
        state.client.loginWithRedirect({
          authorizationParams: {
            audience: config.auth0Audience,
            redirect_uri: location.origin,
            screen_hint: "signup",
          },
        }),
    };

    if (
      location.search.includes("code=") &&
      location.search.includes("state=")
    ) {
      await state.client.handleRedirectCallback();
      history.replaceState({}, document.title, location.pathname);
    }

    if (await state.client.isAuthenticated()) {
      state.token = await state.client.getTokenSilently();
      await ensureWorkspace();
    }

    await setSessionLabel();
    connectUi();
  })().catch((error) =>
    console.warn("Remote demo setup failed", error)
  );
})();
