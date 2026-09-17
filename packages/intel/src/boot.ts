/**
 * Railway start: INTEL_ROLE=scanner → hourly push-scan; otherwise the API.
 */
export {};

const role = process.env.INTEL_ROLE?.trim().toLowerCase();
if (role === "scanner") {
  const { runPushScan } = await import("./push-scan.js");
  await runPushScan();
} else {
  const { startSiteServer } = await import("./site-server.js");
  startSiteServer();
}
