// Local defaults; no model probes or messages are sent to discover settings.
export const PRESETS = Object.freeze({
  work: { model: "GPT-6.1 Sol", thinkingLevel: "Light" },
  chat: { model: "GPT-6.1 Sol", thinkingLevel: "Medium" },
});
const normal = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[\s_-]+/gu, "");
export function modeKind(value) {
  const text = normal(value);
  if (["work", "\u5de5\u4f5c", "trabajo"].includes(text)) return "work";
  if (["chat", "\u804a\u5929", "\u804a\u5929\u6a21\u5f0f", "charlar"].includes(text)) return "chat";
  throw new Error("Unrecognized Chat/Work mode; discover the visible modes before sending.");
}
export function exactModel(options, requested) {
  const key = normal(requested).replace(/^gpt/u, "");
  const matches = options.filter(item => normal(item.name).replace(/^gpt/u, "") === key);
  if (matches.length !== 1) throw new Error("Requested model is unavailable or ambiguous; nothing sent.");
  return matches[0].name;
}
export function installLocalPresets(browser) {
  const originalNew = browser.newChat.bind(browser);
  const originalSend = browser.sendMessage.bind(browser);
  const originalRoute = browser.routeNewChat.bind(browser);
  async function settings(input, continuing = false) {
    if (input.answerTier) throw new Error("Answer-tier overrides are disabled locally; use model and thinkingLevel explicitly.");
    const observedMode = continuing && !input.mode ? await browser.currentMode() : null;
    if (continuing && !input.mode && !observedMode) throw new Error("Cannot detect the existing conversation type; specify Chat or Work explicitly.");
    const requestedMode = input.mode || observedMode || "Work";
    const kind = modeKind(requestedMode);
    const modes = await browser.listModes();
    const match = modes.modes.filter(item => {
      try { return modeKind(item.name) === kind; } catch { return false; }
    });
    if (match.length !== 1) throw new Error("Requested Chat/Work mode is not available; nothing sent.");
    const preset = PRESETS[kind];
    return { ...input, mode: match[0].name, model: input.model || preset.model,
      thinkingLevel: input.thinkingLevel || preset.thinkingLevel };
  }
  // Reject fuzzy model fallback before allowing the upstream selector to act.
  const selectModel = browser.selectModel.bind(browser);
  browser.selectModel = async model => {
    const available = await browser.listModels();
    return selectModel(exactModel(available.models, model));
  };
  const selectThinking = browser.selectThinkingLevel.bind(browser);
  browser.selectThinkingLevel = async level => {
    const options = await browser.listThinkingLevels();
    const aliases = { light: ["light", "low", "\u8f7b\u5ea6", "\u4f4e"], medium: ["medium", "\u4e2d\u7b49", "\u4e2d"] };
    const keys = aliases[normal(level)] || [normal(level)];
    const matches = options.levels.filter(item => keys.includes(normal(item.name)));
    if (matches.length > 1) throw new Error("Ambiguous reasoning label; nothing sent.");
    // Upstream direct-slider path searches labels and restores the slider if absent.
    if (!matches.length && options.control?.type !== "slider") throw new Error("Requested reasoning effort is unavailable; nothing sent.");
    return selectThinking(matches[0]?.name || level);
  };
  browser.newChat = async (input = {}, options) => originalNew(await settings(input), options);
  browser.sendMessage = async input => originalSend(await settings(input, !input.newChat && !input.temporary));
  browser.routeNewChat = async input => {
    if (input.requestPro) return originalRoute(input); // Disabled upstream unless explicitly configured.
    return browser.sendMessage({ ...input, newChat: true, temporary: false });
  };
}
