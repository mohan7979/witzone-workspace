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
#define MyAppVersion  "1.2.3"
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

[Registry]
; Register the agent as a Windows startup app (current user).
; This makes it appear in Settings → Apps → Startup and auto-run on every login.
; uninsdeletevalue removes the entry automatically when the user uninstalls.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
    ValueType: string; ValueName: "WitzoneAgent"; \
    ValueData: """{app}\{#MyAppExe}"""; Flags: uninsdeletevalue

[Run]
; Launch the agent immediately after install (runs as current user, not elevated).
Filename: "{app}\{#MyAppExe}"; Description: "Start Witzone Agent now"; \
    Flags: nowait postinstall skipifsilent runasoriginaluser

[UninstallRun]
; Stop the running agent before removing files.
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "KillAgent"

[Code]
// Stop any running instance before install/upgrade so the .exe isn't locked.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/C taskkill /IM {#MyAppExe} /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
