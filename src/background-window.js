import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export async function minimizeWindow(pid) {
  if (process.platform !== "win32") return {minimized:false,reason:"Windows-only window control"};
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("Invalid browser PID.");
  const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class McpWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd); }'; $p = Get-Process -Id ${pid}; $h = $p.MainWindowHandle; if ($h -eq 0) { throw 'Browser window handle not found' }; [void][McpWindow]::ShowWindowAsync($h,6); Start-Sleep -Milliseconds 200; if (![McpWindow]::IsIconic($h)) { throw 'Browser did not minimize' }; Write-Output 'MINIMIZED'`;
  const result = await run("powershell.exe", ["-NoProfile","-NonInteractive","-Command",script], {windowsHide:true,timeout:10000});
  if (!result.stdout.includes("MINIMIZED")) throw new Error("Minimization not confirmed.");
  return {minimized:true};
}
