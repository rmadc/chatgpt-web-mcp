// Current web picker: visible Select ChatGPT model button, model radios and Power slider.
const equal = (a,b) => String(a||"").trim().toLowerCase() === String(b||"").trim().toLowerCase();
export function pickerLines(text) { return text.split("\n").map(s=>s.trim()).filter(Boolean); }
export function installModernPicker(browser) {
  async function picker() {
    const page = await browser.page();
    let menu = page.locator('[role="menu"]:visible').filter({has:page.locator('[role="slider"]')}).last();
    if (!await menu.count()) {
      const trigger = page.locator('button[aria-label="Select ChatGPT model"]:visible').last();
      if (!await trigger.count()) throw new Error("Current model picker is unavailable; nothing sent.");
      await browser.click(trigger,"open-current-model-picker");
      await page.waitForTimeout(250);
      menu = page.locator('[role="menu"]:visible').filter({has:page.locator('[role="slider"]')}).last();
    }
    if (!await menu.count()) throw new Error("Unsupported model picker layout; nothing sent.");
    return {page,menu};
  }
  async function state(menu) {
    const toggle = menu.locator('[role="menuitem"][aria-label="Select model"]');
    if (!await toggle.count()) throw new Error("This mode does not expose exact model and reasoning settings; nothing sent.");
    const lines = pickerLines(await toggle.innerText());
    if (lines.length < 2) throw new Error("Cannot verify model and reasoning labels; nothing sent.");
    return {model:lines[0],thinkingLevel:lines[1]};
  }
  async function close(page) {await page.keyboard.press("Escape");}
  browser.listModels = async () => {
    const {page,menu}=await picker();
    try {const radios=menu.locator('[role="menuitemradio"]');
      const models=await radios.evaluateAll(es=>es.map(e=>({name:e.innerText.split("\n")[0].trim(),disabled:e.getAttribute("aria-disabled")==="true"})).filter(e=>e.name!=="Default"));
      let current=null;try{current=(await state(menu)).model;}catch{}
      return {current,models};
    } finally {await close(page);}
  };
  browser.selectModel = async model => {
    const {page,menu}=await picker();
    try {
      const option=menu.locator('[role="menuitemradio"]').filter({hasText:new RegExp(`^${model.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`)});
      if (await option.count() !== 1 || await option.getAttribute("aria-disabled") === "true") throw new Error("Requested model unavailable or locked; nothing sent.");
      if (!await option.isVisible() || await option.evaluate(e => e.closest("[data-active]")?.getAttribute("data-active")) !== "true") {
        const toggle=menu.locator('[role="menuitem"][aria-label="Select model"]');
        if (await toggle.count()) { await browser.click(toggle,"expand-model-options"); await page.waitForTimeout(350); }
      }
      await browser.click(option,"select-exact-model");
    } finally {await close(page);}
    const check=await picker();
    try {const observed=await state(check.menu);
      if (!equal(observed.model,model)) throw new Error("Model verification failed; nothing sent.");
      browser.rememberSettings(observed.model,observed.thinkingLevel);
      return {requested:model,selected:observed.model,verifiedBy:"visible-picker-label"};
    } finally {await close(check.page);}
  };
  browser.listThinkingLevels=async()=>{
    const {page,menu}=await picker();
    try {const observed=await state(menu);return {current:observed.thinkingLevel,levels:[],control:{type:"slider"}};}
    finally {await close(page);}
  };
  browser.selectThinkingLevel=async level=>{
    const {page,menu}=await picker();
    const slider=menu.locator('[role="slider"]').last();
    const original=Number(await slider.getAttribute("aria-valuenow"));
    try {
      let observed=await state(menu);
      if (!equal(observed.thinkingLevel,level)) {
        const min=Number(await slider.getAttribute("aria-valuemin"));
        const max=Number(await slider.getAttribute("aria-valuemax"));
        if (![min,max,original].every(Number.isFinite)||max-min>10) throw new Error("Unusable reasoning slider; nothing sent.");
        await browser.press(slider,"Home","reasoning-start");
        for(let position=min;position<=max;position++) {
          await page.waitForTimeout(150);
          observed=await state(menu);
          if(equal(observed.thinkingLevel,level)) break;
          if(position<max) await browser.press(slider,"ArrowRight","reasoning-next");
        }
        if(!equal(observed.thinkingLevel,level)) {
          await browser.press(slider,"Home","restore-reasoning");
          for(let pos=min;pos<original;pos++) await browser.press(slider,"ArrowRight","restore-reasoning");
          throw new Error("Requested reasoning effort is unavailable; restored original setting; nothing sent.");
        }
      }
      browser.rememberSettings(observed.model,observed.thinkingLevel);
      return {requested:level,selected:observed.thinkingLevel,verifiedBy:"visible-picker-label"};
    } finally {await close(page);}
  };
}
