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
#define MyAppVersion  "1.2.0"
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
; Offer to start the agent right after installing.
Filename: "{app}\{#MyAppExe}"; Description: "Start Witzone Agent now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop the running agent, then clear the per-user autostart entry it created.
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "KillAgent"
Filename: "{cmd}"; Parameters: "/C reg delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v WitzoneAgent /f"; Flags: runhidden; RunOnceId: "DelAutostart"

[Code]
// Stop any running instance before install/upgrade so the .exe isn't locked.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/C taskkill /IM {#MyAppExe} /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
