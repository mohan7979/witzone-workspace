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
#define MyAppVersion  "1.2.4"
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
; 1. Remove any legacy HKCU\Run entry from older installs to prevent double-launch.
Filename: "reg.exe"; \
    Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v WitzoneAgent /f"; \
    Flags: runhidden; StatusMsg: "Cleaning up old startup entry..."

; 2. Register a Task Scheduler task that fires 30 s after the user logs in.
;    The 30-second delay ensures the taskbar/notification area exists before
;    pystray tries to register the tray icon — HKCU\Run fires too early on
;    most machines and the icon silently fails to appear.
Filename: "schtasks.exe"; \
    Parameters: "/Create /TN ""WitzoneAgent"" /TR """"""{app}\{#MyAppExe}"""""" /SC ONLOGON /DELAY 0000:30 /IT /RL LIMITED /F"; \
    Flags: runhidden waituntilterminated; StatusMsg: "Registering startup task..."

; 3. Launch the agent right now so the employee doesn't have to reboot.
Filename: "{app}\{#MyAppExe}"; Description: "Start Witzone Agent now"; \
    Flags: nowait postinstall skipifsilent runasoriginaluser

[UninstallRun]
; Stop the running agent, then remove the startup task.
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "KillAgent"
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
