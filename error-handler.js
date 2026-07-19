window.addEventListener("error", function (event) {
  var message = event.message || "An unexpected error occurred.";
  var source = event.filename ? " in " + event.filename.split("/").pop() : "";
  console.error("[Datalyst]" + source, message);
  var toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = "Something went wrong. " + message;
    toast.classList.remove("hidden");
    setTimeout(function () { toast.classList.add("hidden"); }, 5000);
  }
  return false;
});

window.addEventListener("unhandledrejection", function (event) {
  var reason = event.reason;
  var message = reason instanceof Error ? reason.message : String(reason || "An unexpected error occurred.");
  console.error("[Datalyst] Unhandled promise rejection:", message);
  var toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = "Something went wrong. " + message;
    toast.classList.remove("hidden");
    setTimeout(function () { toast.classList.add("hidden"); }, 5000);
  }
});

window.addEventListener("DOMContentLoaded", function () {
  var scripts = document.querySelectorAll("script[src]");
  scripts.forEach(function (script) {
    script.addEventListener("error", function () {
      console.error("[Datalyst] Failed to load script:", script.src);
      var toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = "A required component failed to load. Please refresh the page.";
        toast.classList.remove("hidden");
        setTimeout(function () { toast.classList.add("hidden"); }, 5000);
      }
    });
  });
});
