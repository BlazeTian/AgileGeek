; The Windows installer for AgileGeek, compiled by tool/build_windows.dart.
;
; It is compiled with three /D defines, all required:
;   BundleDir  the Release bundle to pack (the folder holding agilegeek.exe)
;   AppVersion the version pubspec.yaml carries, as it writes it (1.0.0+1)
;   OutDir     where to write the installer (build/installers)
;
; Output: AgileGeek-<version>-setup.exe (-setup-arm64.exe for Arm)

#ifndef BundleDir
  #error BundleDir is not defined: pass /DBundleDir=<release bundle folder>
#endif
#ifndef AppVersion
  #error AppVersion is not defined: pass /DAppVersion=<version from pubspec.yaml>
#endif
#ifndef OutDir
  #error OutDir is not defined: pass /DOutDir=<folder for the installer>
#endif

; The channel build's (tool/build_windows.dart --channel): "-channel", after
; the installer's name. The same app either way, installed over the other.
#ifndef Edition
  #define Edition ""
#endif

; The processor the bundle was built for (tool/build_windows.dart passes
; it): x64, or arm64, whose installer's name says so ("-arm64", before the
; edition's). The same app either way: one installs over the other.
#ifndef Arch
  #define Arch "x64"
#endif
#if Arch == "arm64"
  #define ArchSuffix "-arm64"
#else
  #define ArchSuffix ""
#endif

; The part of the version Windows records, without the build number pubspec
; adds after "+".
#define VersionNumber Copy(AppVersion, 1, Pos("+", AppVersion) - 1)
#if Pos("+", AppVersion) == 0
  #undef VersionNumber
  #define VersionNumber AppVersion
#endif

[Setup]
; Base of the identity Windows uses for the installed app. It must not change
; between versions, or an upgrade installs beside the old one instead of over
; it.
AppId={{a480a5f9-7c97-4f63-8fd0-7a43bff19b96}
AppName=AgileGeek
AppVersion={#VersionNumber}
AppPublisher=AgileGeek
AppVerName=AgileGeek {#VersionNumber}
DefaultDirName={autopf}\AgileGeek
DefaultGroupName=AgileGeek
UninstallDisplayName=AgileGeek
UninstallDisplayIcon={app}\agilegeek.exe
OutputBaseFilename=AgileGeek-{#VersionNumber}-setup{#ArchSuffix}{#Edition}
OutputDir={#OutDir}
; What Explorer shows for the installer itself. Windows wants four numbers,
; where pubspec's version has three.
VersionInfoVersion={#VersionNumber}.0
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; The app is 64-bit only: x64 (which Windows on Arm runs too, emulated),
; or arm64.
#if Arch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#else
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#endif
; Per user by default ({autopf} is then %LOCALAPPDATA%\Programs): neither
; the install nor the app's updates ask for elevation, which a machine may
; not grant (no admin; UAC set to elevate signed programs only, and Setup is
; not signed) or show behind other windows. For all users (Program Files,
; elevated) is the dialog's other choice; an update keeps the install mode
; there is (UsePreviousPrivileges, and lib/update/installer_io.dart passes
; it).
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DisableProgramGroupPage=yes
; A running AgileGeek is asked to close (it quits on WM_ENDSESSION, see
; windows/runner/flutter_window.cpp), and ended if it does not: a version
; from before that, or one stuck, would otherwise hold Setup at "Closing
; applications..." for good.
CloseApplications=force
; Always a log (%TEMP%\Setup Log <date> #<n>.txt, or where /LOG= says, as
; an update the app runs does): a silent install that fails says why only
; there.
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; \
  GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "addtopath"; Description: "Add AgileGeek to the PATH"; \
  GroupDescription: "Other:"; Flags: unchecked
Name: "contextmenu"; \
  Description: "Add ""Open with AgileGeek"" and ""Open with Fast Ide"" to Explorer's context menu"; \
  GroupDescription: "Other:"

[Files]
; The whole bundle: agilegeek.exe, the engine and plugin DLLs, data\ (the
; AOT app.so and flutter_assets) which sit beside the executable, and
; remote\ (VERSION and servers.json: which agilegeek-server remote projects
; run on their host, and where the app downloads it; tool/build_windows.dart
; puts them there), and openssh\ (OpenSSH for Windows, for remote projects
; where the system's ssh is too old to ask for a password).
Source: "{#BundleDir}\*"; Excludes: "\agilegeek-browser-host.exe"; \
  DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; The browser extension's host, which a browser may have started again since
; PrepareToInstall: see ReplaceBrowserHost.
Source: "{#BundleDir}\agilegeek-browser-host.exe"; DestDir: "{app}"; \
  Flags: ignoreversion; BeforeInstall: ReplaceBrowserHost

[InstallDelete]
; A host ReplaceBrowserHost moved out of the way, at an install before.
Type: files; Name: "{app}\agilegeek-browser-host.exe.*.old"

[UninstallDelete]
Type: files; Name: "{app}\agilegeek-browser-host.exe.*.old"

[Icons]
Name: "{group}\AgileGeek"; Filename: "{app}\agilegeek.exe"
Name: "{group}\{cm:UninstallProgram,AgileGeek}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\AgileGeek"; Filename: "{app}\agilegeek.exe"; Tasks: desktopicon

[Registry]
; Only when asked for. Which hive follows the install mode: a per-machine
; install writes the machine's PATH (HKLM), a per-user one the user's (HKCU).
; Writing HKCU while installing as admin would put the entry in whichever
; account elevated, which is not necessarily the one that runs the app.
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; \
  Tasks: addtopath; Check: IsAdminInstallMode and NeedsAddPath(ExpandConstant('{app}'), True)
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{olddata};{app}"; Tasks: addtopath; \
  Check: (not IsAdminInstallMode) and NeedsAddPath(ExpandConstant('{app}'), False)

; agilegeek_wer.dll listed for Windows Error Reporting (windows/wer), as the
; app lists it for the user who runs it (hang_watchdog.cpp's
; RegisterFastFailModule): written here so that uninstalling removes it.
; The user's own, so a per-user install's only.
Root: HKCU; Subkey: "Software\Microsoft\Windows\Windows Error Reporting\RuntimeExceptionHelperModules"; \
  ValueType: dword; ValueName: "{app}\agilegeek_wer.dll"; ValueData: 0; \
  Flags: uninsdeletevalue; Check: not IsAdminInstallMode

; Explorer's context menu, on a file, a folder and a folder's background,
; each in a new window: Open with AgileGeek, a new agent in a narrow window of
; its own (a file in its composer; see AppWindows.openAgent), and Open with
; Fast Ide, as `code -n` opens it (the path its own working folder: it is
; absolute). HKA is the install mode's hive (HKLM per machine, HKCU per
; user). Windows 11 lists them under "Show more options". Unticked on a
; reinstall, they go. Settings → General writes the same keys under HKCU
; (lib/platform/context_menu_io.dart), for the user alone.
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeek"; ValueType: string; \
  ValueName: ""; ValueData: "{code:MenuLabel|AgileGeek}"; Tasks: contextmenu; \
  Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeek"; ValueType: string; \
  ValueName: "Icon"; ValueData: """{app}\agilegeek.exe"""; Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeek\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-agent ""%1"""; Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeek"; \
  ValueType: string; ValueName: ""; ValueData: "{code:MenuLabel|AgileGeek}"; \
  Tasks: contextmenu; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeek"; \
  ValueType: string; ValueName: "Icon"; ValueData: """{app}\agilegeek.exe"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeek\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-agent ""%V"""; Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeek"; \
  ValueType: string; ValueName: ""; ValueData: "{code:MenuLabel|AgileGeek}"; \
  Tasks: contextmenu; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeek"; \
  ValueType: string; ValueName: "Icon"; ValueData: """{app}\agilegeek.exe"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeek\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-agent ""%V"""; Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeekFastIde"; \
  ValueType: string; ValueName: ""; ValueData: "{code:MenuLabel|Fast Ide}"; \
  Tasks: contextmenu; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeekFastIde"; \
  ValueType: string; ValueName: "Icon"; ValueData: """{app}\agilegeek.exe"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeekFastIde\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-cli ""%1"" -n ""%1"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeekFastIde"; \
  ValueType: string; ValueName: ""; ValueData: "{code:MenuLabel|Fast Ide}"; \
  Tasks: contextmenu; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeekFastIde"; \
  ValueType: string; ValueName: "Icon"; ValueData: """{app}\agilegeek.exe"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeekFastIde\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-cli ""%V"" -n ""%V"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeekFastIde"; \
  ValueType: string; ValueName: ""; ValueData: "{code:MenuLabel|Fast Ide}"; \
  Tasks: contextmenu; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeekFastIde"; \
  ValueType: string; ValueName: "Icon"; ValueData: """{app}\agilegeek.exe"""; \
  Tasks: contextmenu
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeekFastIde\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-cli ""%V"" -n ""%V"""; \
  Tasks: contextmenu
; The agilegeek: URL scheme, always: a site's one-click import of an upstream
; (agilegeek.dev/import opens agilegeek://provider/import?…; see
; docs/upstream-import.md), the channel build's setup (agilegeek.dev/activate
; opens agilegeek://activate?…), and a file to open in the IDE at a line, as
; VS Code's vscode://file/… (agilegeek://file/C:/…:12:5, see FileLink in
; lib/window/code_args.dart). The link comes after --agilegeek-link, which the
; runner hands Flutter as a request (windows/runner/open_requests.cpp).
Root: HKA; Subkey: "Software\Classes\agilegeek"; ValueType: string; \
  ValueName: ""; ValueData: "URL:AgileGeek"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\agilegeek"; ValueType: string; \
  ValueName: "URL Protocol"; ValueData: ""
Root: HKA; Subkey: "Software\Classes\agilegeek\DefaultIcon"; ValueType: string; \
  ValueName: ""; ValueData: """{app}\agilegeek.exe"",0"
Root: HKA; Subkey: "Software\Classes\agilegeek\shell\open\command"; \
  ValueType: string; ValueName: ""; \
  ValueData: """{app}\agilegeek.exe"" --agilegeek-link ""%1"""
; The browsers' native messaging host for AgileGeek's extension, always
; (windows/BrowserBridge): a browser finds dev.agilegeek.browser.json, beside
; agilegeek.exe, by its key, and the manifest names the host beside it.
; Chrome's key is also the one Brave, Vivaldi and other Chromium browsers
; read; Edge and Chromium read their own. The keys above go at uninstall
; too when nothing else is left in them (the browser is not installed).
Root: HKA; Subkey: "Software\Google"; ValueType: none; \
  Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Google\Chrome"; ValueType: none; \
  Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Google\Chrome\NativeMessagingHosts"; \
  ValueType: none; Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Google\Chrome\NativeMessagingHosts\dev.agilegeek.browser"; \
  ValueType: string; ValueName: ""; \
  ValueData: "{app}\dev.agilegeek.browser.json"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Microsoft\Edge"; ValueType: none; \
  Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts"; \
  ValueType: none; Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\dev.agilegeek.browser"; \
  ValueType: string; ValueName: ""; \
  ValueData: "{app}\dev.agilegeek.browser.json"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Chromium"; ValueType: none; \
  Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Chromium\NativeMessagingHosts"; \
  ValueType: none; Flags: uninsdeletekeyifempty
Root: HKA; Subkey: "Software\Chromium\NativeMessagingHosts\dev.agilegeek.browser"; \
  ValueType: string; ValueName: ""; \
  ValueData: "{app}\dev.agilegeek.browser.json"; Flags: uninsdeletekey
; Unticked: what an earlier install added goes.
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeek"; ValueType: none; \
  Tasks: not contextmenu; Flags: deletekey
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeek"; ValueType: none; \
  Tasks: not contextmenu; Flags: deletekey
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeek"; \
  ValueType: none; Tasks: not contextmenu; Flags: deletekey
Root: HKA; Subkey: "Software\Classes\*\shell\AgileGeekFastIde"; ValueType: none; \
  Tasks: not contextmenu; Flags: deletekey
Root: HKA; Subkey: "Software\Classes\Directory\shell\AgileGeekFastIde"; \
  ValueType: none; Tasks: not contextmenu; Flags: deletekey
Root: HKA; Subkey: "Software\Classes\Directory\Background\shell\AgileGeekFastIde"; \
  ValueType: none; Tasks: not contextmenu; Flags: deletekey

[Run]
Filename: "{app}\agilegeek.exe"; Description: "{cm:LaunchProgram,AgileGeek}"; \
  Flags: nowait postinstall skipifsilent
; An update the app ran (lib/update/installer_io.dart) is silent, which
; skips the entry above: /RELAUNCH opens the app again once it is in place,
; as the user who ran it rather than the administrator Setup elevated to.
Filename: "{app}\agilegeek.exe"; Flags: nowait runasoriginaluser; \
  Check: RelaunchRequested

[Code]
const
  SYNCHRONIZE = $00100000;
  WaitPidTimeout = 120000;

function OpenProcess(dwDesiredAccess: DWORD; bInheritHandle: BOOL;
  dwProcessId: DWORD): THandle;
  external 'OpenProcess@kernel32.dll stdcall';
function WaitForSingleObject(hHandle: THandle; dwMilliseconds: DWORD): DWORD;
  external 'WaitForSingleObject@kernel32.dll stdcall';
function CloseHandle(hObject: THandle): BOOL;
  external 'CloseHandle@kernel32.dll stdcall';

// An update the app runs (lib/update/installer_io.dart) starts Setup as the
// app quits, with /WAITPID=<the app's process>, so the elevation it asks
// for comes up in front of the app: it waits here (two minutes at most) for
// the app to be gone before installing over it. One that does not go is
// closed by CloseApplications=force.
function InitializeSetup: Boolean;
var
  Pid: Integer;
  App: THandle;
begin
  Result := True;
  Pid := StrToIntDef(ExpandConstant('{param:WAITPID|0}'), 0);
  if Pid <= 0 then
    Exit;
  App := OpenProcess(SYNCHRONIZE, False, Pid);
  if App = 0 then
  begin
    Log(Format('Process %d is gone already', [Pid]));
    Exit;
  end;
  Log(Format('Waiting for process %d to quit', [Pid]));
  if WaitForSingleObject(App, WaitPidTimeout) <> 0 then
    Log(Format('Process %d is still running', [Pid]));
  CloseHandle(App);
end;

// The browser extension's host (agilegeek-browser-host.exe), which Chrome or
// Edge keeps running while the extension is connected: it has no window,
// so CloseApplications does not close it, and replacing or removing it
// fails ("DeleteFile failed; code 5"). Ended first; the extension connects
// again on its own (each minute), to the host installed.
procedure EndBrowserHost;
var
  Code: Integer;
begin
  if Exec(ExpandConstant('{sys}\taskkill.exe'),
    '/F /IM agilegeek-browser-host.exe', '', SW_HIDE,
    ewWaitUntilTerminated, Code) then
    Log(Format('taskkill agilegeek-browser-host.exe: %d', [Code]));
end;

// Right before the host is replaced, ended again: the extension connects
// each minute, and the install takes long enough for it to have started the
// host anew since PrepareToInstall, whose file then could not be replaced.
// Started again in between, or not quite gone yet, it is moved out of the
// way, as Windows lets a running program's file be; [InstallDelete] removes
// it at the next install.
procedure ReplaceBrowserHost;
var
  Host: String;
  Old: String;
begin
  EndBrowserHost;
  Host := ExpandConstant('{app}\agilegeek-browser-host.exe');
  if (not FileExists(Host)) or DeleteFile(Host) then
    Exit;
  Old := Host + '.' + GetDateTimeString('yyyymmddhhnnsszzz', #0, #0) + '.old';
  if RenameFile(Host, Old) then
    Log(Format('%s is in use: moved to %s', [Host, Old]))
  else
    Log(Format('%s is in use, and could not be moved', [Host]));
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  EndBrowserHost;
  Result := '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    EndBrowserHost;
end;

// Whether the command line asks for the app to be opened after a silent
// install (/RELAUNCH, an update's; see [Run]). Not silent, the finish
// page's checkbox opens it.
function RelaunchRequested: Boolean;
var
  I: Integer;
begin
  Result := False;
  if not WizardSilent then
    Exit;
  for I := 1 to ParamCount do
    if CompareText(ParamStr(I), '/RELAUNCH') = 0 then
    begin
      Result := True;
      Exit;
    end;
end;

// The context menu's labels (see [Registry]): "Open with AgileGeek", in
// Chinese where Windows is. Written as code points, so the script's encoding
// does not matter.
function MenuLabel(Param: String): String;
begin
  if (GetUILanguage and $3FF) = $04 then
    Result := #$7528 + ' ' + Param + ' ' + #$6253#$5F00
  else
    Result := 'Open with ' + Param;
end;

// Whether {app} is already on the PATH the install will write, so a reinstall
// does not append it a second time. Machine reads the machine's PATH, user the
// user's, matching [Registry] above.
function NeedsAddPath(Param: string; Machine: Boolean): Boolean;
var
  Path: String;
  Subkey: String;
  RootKey: Integer;
begin
  if Machine then
  begin
    RootKey := HKEY_LOCAL_MACHINE;
    Subkey := 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment';
  end
  else
  begin
    RootKey := HKEY_CURRENT_USER;
    Subkey := 'Environment';
  end;

  if not RegQueryStringValue(RootKey, Subkey, 'Path', Path) then
  begin
    Result := True;
    Exit;
  end;
  Result := Pos(';' + Uppercase(Param) + ';', ';' + Uppercase(Path) + ';') = 0;
end;
