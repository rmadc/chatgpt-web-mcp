import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function safeFilename(value) {
  let name = path.win32.basename(path.posix.basename(String(value || "download")))
    .replace(/[<>:"/\\|?*\x00-\x1f]/gu, "_").replace(/[. ]+$/gu, "");
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) name = "file-" + (name || "download");
  return name.slice(0, 180).replace(/[. ]+$/gu, "") || "download";
}
export async function saveDownload(download, directory, { maxBytes = 104857600 } = {}) {
  await fs.mkdir(directory, { recursive: true });
  const root = await fs.realpath(directory);
  const temporary = path.join(root, ".partial-" + randomUUID());
  try {
    await download.saveAs(temporary);
    const stat = await fs.stat(temporary);
    if (stat.size > maxBytes) throw new Error("Downloaded file exceeds the local size limit.");
    const filename = safeFilename(download.suggestedFilename());
    const ext = path.extname(filename);
    const stem = path.basename(filename, ext);
    for (let index = 0; index < 100; index++) {
      const destination = path.join(root, index ? `${stem}-${index}${ext}` : filename);
      try {
        // Hard-link creation is exclusive: never overwrite a pre-existing file/symlink.
        await fs.link(temporary, destination);
        return { path: destination, filename: path.basename(destination), bytes: stat.size };
      } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    throw new Error("Too many files with the same download name.");
  } finally {
    await fs.unlink(temporary).catch(() => {});
    await download.delete().catch(() => {});
  }
}
export const DOWNLOAD_SELECTOR = 'a[download], a[href^="sandbox:"], a[href*="/backend-api/files/"], a[href*="/backend-api/estuary/"], a[href*="oaiusercontent.com"], a:has-text("Download"), a:has-text("Descargar"), a:has-text("??"), button[aria-label*="Download"], button[aria-label*="Descargar"], button[aria-label*="??"]';
export async function responseDownloadControls(browser) {
  const messages = browser.assistantLocator();
  if (!await messages.count()) throw new Error("No assistant response is available.");
  return messages.last().locator(DOWNLOAD_SELECTOR);
}
export async function listDownloads(browser) {
  await browser.ensureSignedIn();
  const controls = await responseDownloadControls(browser);
  const files = [];
  for (let index = 0; index < await controls.count(); index++) {
    const item = controls.nth(index);
    if (await item.isVisible()) files.push({ index, label: ((await item.innerText()) || await item.getAttribute("aria-label") || "Download").trim().slice(0, 200) });
  }
  return { files, scope: "latest-assistant-response" };
}
export async function downloadFile(browser, { index, directory, timeoutMs = 30000, maxBytes }) {
  await browser.ensureSignedIn();
  const page = await browser.page();
  const controls = await responseDownloadControls(browser);
  if (!Number.isInteger(index) || index < 0 || index >= await controls.count()) throw new Error("Invalid download index; list files again.");
  const control = controls.nth(index);
  if (!await control.isVisible()) throw new Error("Download control is no longer visible.");
  await browser.siteAction("download-result-file");
  const pending = page.waitForEvent("download", { timeout: timeoutMs });
  pending.catch(() => {});
  let download;
  try {
    await browser.click(control, "download-result-file");
    download = await pending;
    return await saveDownload(download, directory, { maxBytes });
  } catch {
    if (download) await download.cancel().catch(() => {});
    throw new Error("Download failed or timed out; no automatic retry. Check browser and list files again.");
  }
}
