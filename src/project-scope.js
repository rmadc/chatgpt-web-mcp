import fs from "node:fs";
const settings = JSON.parse(fs.readFileSync(new URL("../local-project.json", import.meta.url), "utf8"));
export const PROJECT = Object.freeze(settings);
export function validProjectUrl(value) {
  const url = new URL(value);
  return url.origin === "https://chatgpt.com" && /^\/g\/g-p-[a-z0-9]+\/project$/u.test(url.pathname);
}
if (PROJECT.name !== "CODEX-MCP" || !validProjectUrl(PROJECT.url)) throw new Error("Invalid local CODEX-MCP project configuration.");
export async function assertProject(browser) {
  const page = await browser.page();
  const base = new URL(PROJECT.url).pathname.replace(/\/project$/u, "");
  const url = new URL(page.url());
  if (url.origin !== "https://chatgpt.com") throw new Error("Not on ChatGPT; nothing sent.");
  const pathMatches = url.pathname === base + "/project" || url.pathname.startsWith(base + "/c/");
  const projectControl = page.locator('button[aria-label="Change icon and color for CODEX-MCP"]:visible');
  const headerLink = page.locator('main a,header a').filter({visible:true}).filter({hasText:/^CODEX-MCP$/});
  if (!pathMatches && !await projectControl.count() && !await headerLink.count()) throw new Error("Current conversation is outside CODEX-MCP; nothing sent.");
  // The target project page must identify the project, not just match an opaque URL.
  if (url.pathname.endsWith("/project") && !await projectControl.count() && !await headerLink.count()) throw new Error("Could not verify the CODEX-MCP project name.");
  return {name:PROJECT.name, url:page.url()};
}
export function installProjectScope(browser) {
  browser.openRoot = async ({temporary=false}={}) => {
    if (temporary) throw new Error("Temporary chats cannot be created inside CODEX-MCP.");
    await browser.ensureSignedIn();
    await browser.assertComposerEmpty("new-project-conversation");
    const page = await browser.page();
    const pending = await page.locator('input[type="file"]').evaluateAll(es=>es.reduce((n,e)=>n+(e.files?.length||0),0));
    if (pending) throw new Error("Unsent attachments exist; project navigation stopped.");
    const blank = page.url() === PROJECT.url && await browser.userLocator().count() === 0;
    if (!blank) {
      await browser.siteAction("open-CODEX-MCP-project");
      await page.goto(PROJECT.url,{waitUntil:"domcontentloaded",timeout:20000});
    }
    await page.locator('button[aria-label="Change icon and color for CODEX-MCP"]:visible').waitFor({timeout:10000});
    await assertProject(browser);
    if (!await browser.composer()) throw new Error("CODEX-MCP composer is unavailable.");
    browser.rememberSettings(null,null);
    return {url:page.url(),conversationId:null,temporary:false,navigation:"CODEX-MCP-project",project:PROJECT.name};
  };
  const setTemporary = browser.setTemporary.bind(browser);
  browser.setTemporary = async (enabled, options) => {
    if (enabled) throw new Error("Temporary chats are unavailable inside CODEX-MCP.");
    return setTemporary(enabled, options);
  };
  const submit = browser.submitPrompt.bind(browser);
  browser.submitPrompt = async options => { await assertProject(browser); return submit(options); };
}
