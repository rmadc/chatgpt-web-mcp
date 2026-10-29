import test from "node:test";
import assert from "node:assert/strict";
import {beginLogin,finishLogin} from "../src/auth.js";
import {HEADLESS,setHeadless} from "../src/config.js";
test("login opens visible browser; completion minimizes the signed-in browser without sending",async()=>{
 const events=[];const b={terminateBrowser:async()=>events.push("close"),openLogin:async()=>events.push("login"),signedIn:async()=>true,browserLifecycle:async()=>({pid:7}),page:async()=>({waitForLoadState:async()=>{},title:async()=>"ChatGPT"})};
 const result=await beginLogin(b);assert.equal(result.code,"LOGIN_REQUIRED");assert.equal(HEADLESS,false);
 const finished=await finishLogin(b,{minimize:async()=>({minimized:true})});assert.equal(finished.headless,false);assert.equal(finished.minimized,true);assert.equal(HEADLESS,false);assert.equal(finished.pendingMessageRetried,false);
 assert.deepEqual(events,["close","login"]);
});
test("unfinished login does not restart the browser or send anything",async()=>{
 let closed=false;const result=await finishLogin({signedIn:async()=>false,terminateBrowser:async()=>{closed=true;}});
 assert.equal(result.code,"LOGIN_REQUIRED");assert.equal(closed,false);setHeadless(false);
});

test("security interstitial is distinguished from missing login",async()=>{
 const {authenticationGate}=await import("../src/auth.js");
 assert.equal(authenticationGate("Just a moment...").code,"HUMAN_VERIFICATION_REQUIRED");
 assert.equal(authenticationGate("ChatGPT"),null);
});
