(function () {
  function isExactBuildPcUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "phongvu.vn" && url.pathname === "/buildpc" && url.search === "" && url.hash === "";
    } catch {
      return false;
    }
  }

  globalThis.BuildMateEligibility = { isExactBuildPcUrl };
  if (typeof module !== "undefined") {
    module.exports = globalThis.BuildMateEligibility;
  }
})();
