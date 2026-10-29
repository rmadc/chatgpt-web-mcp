import { minimizeWindow } from "./background-window.js";
import { setHeadless, setMinimized } from "./config.js";
export function authenticationGate(title) {
  return /just a moment|checking your browser|verify you are human/i.test(title || "")
    ? { code: "HUMAN_VERIFICATION_REQUIRED", message: "ChatGPT is showing a browser security check, not a login failure. Stop automatic retries. Request manual verification in a visible browser; headless operation may remain unsupported." }
    : null;
}
export async function beginLogin(browser) {
  await browser.terminateBrowser();
  setHeadless(false);
  setMinimized(false);
  await browser.openLogin();
  return { code: "LOGIN_REQUIRED", browserVisible: true,
    message: "Please sign in in the dedicated Chrome window. After confirmation call chatgpt_finish_login. No prompt has been sent." };
}
export async function finishLogin(browser, {minimize = minimizeWindow} = {}) {
  if (!await browser.signedIn()) return {code:"LOGIN_REQUIRED",message:"Complete sign-in in the visible browser first."};
  setHeadless(false);
  setMinimized(true);
  const lifecycle = await browser.browserLifecycle();
  const background = await minimize(Number(lifecycle.pid));
  return {signedIn:true,headless:false,...background,pendingMessageRetried:false};
}
