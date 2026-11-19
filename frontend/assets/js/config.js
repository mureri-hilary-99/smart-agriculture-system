/* Runtime configuration.
   The static frontend has no build step, so the base URL lives here and can be
   overridden at runtime from the API reference page (stored in localStorage). */

(function () {
  var DEFAULT_BASE = "http://localhost:8000";
  var KEY = "agri_api_base_url";

  window.AGRI_CONFIG = {
    getApiBaseUrl: function () {
      var saved = localStorage.getItem(KEY);
      return (saved || DEFAULT_BASE).replace(/\/+$/, "");
    },
    setApiBaseUrl: function (value) {
      localStorage.setItem(KEY, String(value).trim().replace(/\/+$/, ""));
    },
    resetApiBaseUrl: function () {
      localStorage.removeItem(KEY);
    },
    defaultBase: DEFAULT_BASE
  };
})();
