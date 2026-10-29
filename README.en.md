# ChatGPT Web MCP ? local fork

A Node.js MCP server for operating a dedicated signed-in ChatGPT browser session.
Fork of [Goudu666/chatgpt-web-mcp](https://github.com/Goudu666/chatgpt-web-mcp), based
on commit `d6c1909`. MIT licensed; original attribution and history are retained.
Unofficial and dependent on the web interface.

## Local additions

- Windows background operation using **normal Chrome kept minimized**. This is
  not true headless operation: the tested headless session hit a security check.
- Explicit `LOGIN_REQUIRED` / `HUMAN_VERIFICATION_REQUIRED` outcomes and MCP tools
  to open manual login and minimize the same signed-in browser afterward.
- New conversations routed to an existing **CODEX-MCP** project, with submission
  guards and temporary-chat rejection.
- Current Chat/Work button detection and a model/effort picker adapter.
- Work default: **GPT-6.1 Sol / Light**, verified on the tested account.
- Result-file listing/downloading code with filename sanitization, exclusive saves,
  bounded waits, and no automatic generation retries.

## Status and known limitations

This is experimental, **not a finished integration**. Live Chat requests and
response extraction worked through the browser functions, including a substantial
self-contained design task. This does not establish that every combined MCP tool
works on the current UI.

- Chat uses effort controls rather than the Work model selector. The combined
  preset adapter still needs that distinction implemented; it currently requests
  a Work model name in Chat and may stop before sending. Do not assume it works.
- The upstream completion detector timed out on a successfully generated document
  card. The current download tools scope to older response containers and have
  not been validated on that new card layout. No end-to-end download success is
  claimed.
- Conversation-type detection can return unknown after navigation.
- Project guards rely on visible UI evidence and URL structure; UI or slug changes
  may cause safe rejection and need adaptation.
- Model/effort labels and availability vary by account. Browser controls do not
  independently prove which backend model served a request.

## Setup

Requires Node.js 20+, Chrome/Edge, and a ChatGPT account.

```powershell
npm ci --ignore-scripts
Copy-Item local-project.example.json local-project.json
```

Edit the ignored `local-project.json` with your existing CODEX-MCP project URL.
The project page is expected to use `https://chatgpt.com/g/g-p-<id>/project`.
No credentials belong in this file. Browser login/session data stays in the
separate profile `~/.chatgpt-web-mcp/chrome-profile`, never your everyday profile.

Start the server with an absolute path in your MCP client's stdio configuration:

```text
node /absolute/path/to/chatgpt-web-mcp/src/index.js
```

MCP login: call `chatgpt_begin_login`, have the user sign in manually, then call
`chatgpt_finish_login`. Login is interactive; normal operation is minimized.
If the server reports a security check, stop for manual action. There is no
challenge-solving or rate-limit bypass. Pending prompts are never automatically
resent by the login tools.

## Files and transcripts

`chatgpt_list_downloads` lists candidate files from the latest response;
`chatgpt_download_file` saves one selected index under
`~/.chatgpt-web-mcp/downloads` (override with `CHATGPT_WEB_DOWNLOAD_DIR`). Files are
never executed. The 100 MiB limit is checked after transfer, not a bandwidth cap.
The newer document-card layout remains an open limitation noted above.

Upstream rotation at 40 turns saves Markdown transcripts locally under
`~/.chatgpt-web-mcp/conversation-context` before creating a new conversation.
Archives are not automatically injected into new chats. Selective retrieval can
reduce context, but no archive-search tool is implemented here. Browser profiles,
project IDs, runtime state, downloads and private transcripts must stay out of Git.

## Validation

```powershell
npm test
```

Run tests after creating the local project configuration. Focused local checks
cover defaults, safe file saves, project guards and login recovery; they do not
replace live UI verification. No automatic account rotation or generation retries
are provided. Ask for user approval before delegating work or uploading files.

The original upstream English README is preserved in
[docs/UPSTREAM-README.en.md](docs/UPSTREAM-README.en.md).
