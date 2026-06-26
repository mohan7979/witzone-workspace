; ============================================================================
;  Witzone Workspace Agent — Windows installer (Inno Setup)
;  Produces WitzoneAgentSetup.exe which:
;    • installs WitzoneAgent.exe into Program Files
;    • registers a proper uninstaller (Control Panel → Programs & Features)
;    • stops any running agent before install/upgrade
;    • launches the agent after install
;  On uninstall it stops the running agent and removes the autostart entry.
; ============================================================================

#define MyAppName     "Witzone Workspace Agent"
#define MyAppVersion  "1.2.6"
#define MyAppPublisher "Witzone Technologies"
#define MyAppExe      "WitzoneAgent.exe"

[Setup]
AppId={{7E1C4F0A-9B2D-4C77-AE10-A1B2C3D4E5F6}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Witzone Agent
DefaultGroupName=Witzone Agent
DisableProgramGroupPage=yes
DisableDirPage=yes
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExe}
OutputDir=installer_output
OutputBaseFilename=WitzoneAgentSetup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern

[Files]
Source: "dist\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Witzone Agent";           Filename: "{app}\{#MyAppExe}"
Name: "{group}\Uninstall Witzone Agent"; Filename: "{uninstallexe}"

[Run]
; 1. Clean up any Task Scheduler task left by v1.2.4/v1.2.5.
;    Register-ScheduledTask requires admin rights on many BPO machines (GP
;    restriction) so the agent now uses HKCU\Run instead — writable by any user.
Filename: "schtasks.exe"; \
    Parameters: "/Delete /TN ""WitzoneAgent"" /F"; \
    Flags: runhidden; StatusMsg: "Cleaning up old startup task..."

; 2. Launch the agent as the original (non-elevated) user.
;    On first run it writes its own HKCU\Run entry, so no installer-level
;    registry write is needed and no admin permission issues can arise.
Filename: "{app}\{#MyAppExe}"; Description: "Start Witzone Agent now"; \
    Flags: nowait postinstall skipifsilent runasoriginaluser

[UninstallRun]
; Stop the running agent.
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "KillAgent"
; Remove HKCU\Run entry. The agent writes this as the non-elevated user, so
; this cleanup only works when the same account runs the uninstaller — if an
; IT admin uninstalls it for another user, the orphaned key is harmless (Windows
; skips missing exe paths silently at startup). runasoriginaluser is not valid
; in [UninstallRun], so we rely on HKCU resolving to the uninstalling user.
Filename: "reg.exe"; \
    Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v WitzoneAgent /f"; \
    Flags: runhidden; RunOnceId: "DelReg"
; Remove any leftover Task Scheduler task (v1.2.4/v1.2.5 artefact).
Filename: "schtasks.exe"; Parameters: "/Delete /TN ""WitzoneAgent"" /F"; \
    Flags: runhidden; RunOnceId: "DelTask"

[Code]
// Stop any running instance before install/upgrade so the .exe isn't locked.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/C taskkill /IM {#MyAppExe} /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
