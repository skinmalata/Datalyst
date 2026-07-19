(function () {
  var config = window.DATALYST_CONFIG || {};
  var apiBase = (config.apiBaseUrl || "").replace(/\/$/, "");

  function showOnboarding() {
    var modal = document.getElementById("onboardingModal");
    if (modal) modal.classList.remove("hidden");
  }

  function hideOnboarding() {
    var modal = document.getElementById("onboardingModal");
    if (modal) modal.classList.add("hidden");
  }

  function setOrganizationId(orgId) {
    localStorage.setItem("datalyst.organizationId", orgId);
    window.dispatchEvent(new CustomEvent("datalyst:onboarded", { detail: { organizationId: orgId } }));
  }

  function getOrganizationId() {
    return localStorage.getItem("datalyst.organizationId") || "";
  }

  window.showOnboarding = showOnboarding;
  window.hideOnboarding = hideOnboarding;
  window.getOrganizationId = getOrganizationId;

  var closeBtn = document.getElementById("closeOnboarding");
  if (closeBtn) closeBtn.onclick = hideOnboarding;

  var startBtn = document.getElementById("startOnboarding");
  if (startBtn) {
    startBtn.onclick = async function () {
      var nameInput = document.getElementById("onboardingOrgName");
      var orgName = (nameInput ? nameInput.value.trim() : "") || "My workspace";
      startBtn.disabled = true;
      startBtn.textContent = "Creating workspace...";
      try {
        var token = window._datalystToken || "";
        var headers = { "content-type": "application/json" };
        if (token) headers["authorization"] = "Bearer " + token;
        var response = await fetch(apiBase + "/api/onboarding", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ organizationName: orgName })
        });
        var body = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(body.error || "Onboarding failed.");
        setOrganizationId(body.organization.id);
        hideOnboarding();
        if (typeof window.revealWorkspace === "function") window.revealWorkspace();
        if (typeof toast === "function") toast("Workspace created. You can now upload data and run analyses.");
      } catch (err) {
        if (typeof toast === "function") toast(err.message || "Could not create workspace.");
      } finally {
        startBtn.disabled = false;
        startBtn.textContent = "Create workspace →";
      }
    };
  }
})();
