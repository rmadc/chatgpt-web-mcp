import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installLocalPresets, exactModel } from "../src/local-presets.js";
import { safeFilename, saveDownload, downloadFile } from "../src/downloads.js";

function fakeBrowser(current = "Chat") {
  const calls = [];
  return { calls, currentMode: async () => current,
    listModes: async () => ({ modes: [{name:"Chat"}, {name:"Work"}] }),
    listModels: async () => ({models:[{name:"GPT-6.1 Sol"}]}),
    listThinkingLevels: async () => ({levels:[{name:"Light"},{name:"Medium"}]}),
    selectModel: async value => {calls.push(["model",value]);},
    selectThinkingLevel: async value => {calls.push(["effort",value]);},
    newChat: async input => {calls.push(["new",input]);return input;},
    sendMessage: async input => {calls.push(["send",input]);return input;},
    routeNewChat: async () => {throw new Error("probe disabled");} };
}
test("new Work and Chat routes have distinct defaults; continuation detects current mode", async () => {
  const browser = fakeBrowser(); installLocalPresets(browser);
  assert.equal((await browser.newChat()).thinkingLevel,"Light");
  assert.equal((await browser.newChat({mode:"Chat"})).thinkingLevel,"Medium");
  assert.equal((await browser.sendMessage({prompt:"x"})).mode,"Chat");
  assert.equal((await browser.routeNewChat({prompt:"x",mode:"Chat"})).newChat,true);
  assert.equal((await browser.routeNewChat({prompt:"x"})).thinkingLevel,"Light");
});
test("unknown current type, unavailable model, and tier override fail before sending", async () => {
  const browser=fakeBrowser(null); installLocalPresets(browser);
  await assert.rejects(browser.sendMessage({prompt:"x"}),/Cannot detect/);
  await assert.rejects(browser.newChat({answerTier:"Extreme"}),/disabled/);
  assert.throws(()=>exactModel([{name:"GPT-6 Sol"},{name:"GPT-6.1 Sol Pro"}],"GPT-6.1 Sol"),/unavailable/);
  assert.equal(browser.calls.length,0);
});
test("default selection rejects missing effort and selects exact model", async () => {
  const browser=fakeBrowser(); installLocalPresets(browser);
  await browser.selectModel("6.1 Sol");
  await browser.selectThinkingLevel("Light");
  assert.deepEqual(browser.calls,[["model","GPT-6.1 Sol"],["effort","Light"]]);
  await assert.rejects(browser.selectThinkingLevel("Max"),/unavailable/);
});
test("download names cannot escape folder or use Windows device names", () => {
  assert.equal(safeFilename("../../report.txt"),"report.txt");
  assert.equal(safeFilename("C:\\secret\\report.txt"),"report.txt");
  assert.equal(safeFilename("CON.txt"),"file-CON.txt");
  assert.equal(safeFilename(".."),"file-download");
});
test("downloads preserve existing files and remove partial files; oversized output rejected", async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"chatgpt-download-test-"));
  const fixture = () => ({suggestedFilename:()=>"../../report.txt", saveAs:file=>fs.writeFile(file,"hello"), delete:async()=>{}});
  try {
    await fs.writeFile(path.join(dir,"report.txt"),"original");
    const result=await saveDownload(fixture(),dir);
    assert.equal(result.filename,"report-1.txt");
    assert.equal(await fs.readFile(path.join(dir,"report.txt"),"utf8"),"original");
    assert.equal(result.bytes,5);
    await assert.rejects(saveDownload(fixture(),dir,{maxBytes:2}),/size limit/);
    assert.equal((await fs.readdir(dir)).some(name=>name.startsWith(".partial-")),false);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test("download waits before click and makes no retry on a missing event", async () => {
  const events=[];
  const item={isVisible:async()=>true};
  const browser={ ensureSignedIn:async()=>{}, siteAction:async()=>{},
    page:async()=>({waitForEvent:()=>{events.push("wait");return Promise.reject(new Error("timeout"));}}),
    assistantLocator:()=>({count:async()=>1,last:()=>({locator:()=>({count:async()=>1,nth:()=>item})})}),
    click:async()=>{events.push("click");} };
  await assert.rejects(downloadFile(browser,{index:0,directory:os.tmpdir()}),/no automatic retry/);
  assert.deepEqual(events,["wait","click"]);
});

// Project guards are tested without starting a browser or sending requests.
test("project configuration rejects external and non-project URLs", async () => {
  const { validProjectUrl } = await import("../src/project-scope.js");
  assert.equal(validProjectUrl("https://chatgpt.com/g/g-p-abc123/project"),true);
  assert.equal(validProjectUrl("https://example.com/g/g-p-abc123/project"),false);
  assert.equal(validProjectUrl("https://chatgpt.com/c/abc"),false);
});
test("project submission is blocked outside CODEX-MCP and temporary chats are rejected", async () => {
  const { installProjectScope } = await import("../src/project-scope.js");
  let submitted=false;
  const empty={count:async()=>0,filter(){return this;}};
  const browser={page:async()=>({url:()=>"https://chatgpt.com/c/unrelated",locator:()=>empty}),
    submitPrompt:async()=>{submitted=true;},setTemporary:async()=>{}};
  installProjectScope(browser);
  await assert.rejects(browser.submitPrompt({}),/outside CODEX-MCP/);
  await assert.rejects(browser.openRoot({temporary:true}),/Temporary/);
  await assert.rejects(browser.setTemporary(true),/Temporary/);
  assert.equal(submitted,false);
});
