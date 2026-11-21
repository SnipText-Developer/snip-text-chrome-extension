// The development dashboard keeps its test templates inside the page's fetch mock.
export async function readDashboardTestTemplates(origin: string): Promise<unknown> {
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  for (const tab of tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))) {
    if (tab.id === undefined) continue;
    try {
      const [response] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        args: [origin],
        func: async (expectedOrigin) => {
          if (location.origin !== expectedOrigin) return null;
          const response = await fetch("/api/v1/templates", {
            headers: { Authorization: "Bearer sniptext-test-token" },
            redirect: "error",
            signal: AbortSignal.timeout(3_000),
          });
          if (!response.ok) return null;
          const data = await response.json();
          if (data?.isSuccess !== true || data.code !== "TEMPLATE200_1") return null;
          return data.result;
        },
      });
      if (Array.isArray(response?.result?.templates)) return response.result;
    } catch {
      // A candidate tab can close or navigate before script execution.
    }
  }
  return null;
}
