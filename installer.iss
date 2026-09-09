[Setup]
AppName=IVAC Master Pro
AppVersion=4.0.0
AppPublisher=IVAC Master Pro
AppPublisherURL=https://digontoedu.com
DefaultDirName={autopf}\IVAC Master Pro
DefaultGroupName=IVAC Master Pro
OutputBaseFilename=IVAC_Master_Pro_Setup_v4.0.0
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
SetupIconFile=digonto_icon.ico
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[InstallDelete]
; Clean up previous Digonto QuickFill desktop shortcuts
Type: files; Name: "{autodesktop}\Digonto QuickFill.lnk"
Type: files; Name: "{userdesktop}\Digonto QuickFill.lnk"
Type: files; Name: "{commondesktop}\Digonto QuickFill.lnk"
; Clean up previous Digonto QuickFill Start Menu entries
Type: filesandordirs; Name: "{commonprograms}\Digonto QuickFill"
Type: filesandordirs; Name: "{userprograms}\Digonto QuickFill"
; Clean up previous Digonto QuickFill program folder
Type: filesandordirs; Name: "{autopf}\Digonto QuickFill"
; Clean up previous desktop extension folder if present
Type: filesandordirs; Name: "{userdesktop}\IVAC_Chrome_Extension"
Type: filesandordirs; Name: "{autodesktop}\IVAC_Chrome_Extension"
Type: filesandordirs; Name: "{commondesktop}\IVAC_Chrome_Extension"

[Files]
Source: "dist\IVAC Master Pro\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\IVAC Master Pro\_internal\chrome_extension\*"; DestDir: "C:\IVAC_Chrome_Extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\IVAC Master Pro\_internal\chrome_extension\*"; DestDir: "{localappdata}\IVAC_Chrome_Extension"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\IVAC Master Pro"; Filename: "{app}\IVAC Master Pro.exe"; IconFilename: "{app}\_internal\digonto_icon.ico"
Name: "{group}\{cm:UninstallProgram,IVAC Master Pro}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\IVAC Master Pro"; Filename: "{app}\IVAC Master Pro.exe"; IconFilename: "{app}\_internal\digonto_icon.ico"; Tasks: desktopicon

[Run]
Filename: "attrib.exe"; Parameters: "-h -s ""C:\IVAC_Chrome_Extension"""; Flags: runhidden
Filename: "icacls.exe"; Parameters: """C:\IVAC_Chrome_Extension"" /grant Everyone:(OI)(CI)F /T"; Flags: runhidden
Filename: "icacls.exe"; Parameters: """C:\IVAC_Chrome_Extension"" /grant *S-1-5-32-545:(OI)(CI)F /T"; Flags: runhidden
Filename: "{app}\IVAC Master Pro.exe"; Description: "{cm:LaunchProgram,IVAC Master Pro}"; Flags: nowait postinstall skipifsilent runasoriginaluser

[Code]
function GetOldUninstallString(): String;
var
  sUnInstPath: String;
begin
  sUnInstPath := '';
  if not RegQueryStringValue(HKLM64, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\Digonto QuickFill_is1', 'UninstallString', sUnInstPath) then
    if not RegQueryStringValue(HKLM32, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\Digonto QuickFill_is1', 'UninstallString', sUnInstPath) then
      if not RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\Digonto QuickFill_is1', 'UninstallString', sUnInstPath) then
        sUnInstPath := '';
  Result := sUnInstPath;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  sUnInstPath: String;
  iResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // 1. Silently terminate any running old Digonto QuickFill instance
    Exec('taskkill.exe', '/F /IM "Digonto QuickFill.exe"', '', SW_HIDE, ewWaitUntilTerminated, iResultCode);
    
    // 2. Silently run the old uninstaller to cleanly unregister Digonto QuickFill from Windows
    sUnInstPath := GetOldUninstallString();
    if sUnInstPath <> '' then
    begin
      sUnInstPath := RemoveQuotes(sUnInstPath);
      if FileExists(sUnInstPath) then
      begin
        Exec(sUnInstPath, '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewWaitUntilTerminated, iResultCode);
      end;
    end;

    // 3. Delete any old Digonto shortcuts & program directory
    DeleteFile(ExpandConstant('{userdesktop}\Digonto QuickFill.lnk'));
    DeleteFile(ExpandConstant('{commondesktop}\Digonto QuickFill.lnk'));
    DeleteFile(ExpandConstant('{autodesktop}\Digonto QuickFill.lnk'));
    DelTree(ExpandConstant('{commonprograms}\Digonto QuickFill'), True, True, True);
    DelTree(ExpandConstant('{userprograms}\Digonto QuickFill'), True, True, True);
    DelTree('C:\Program Files\Digonto QuickFill', True, True, True);
    DelTree('C:\Program Files (x86)\Digonto QuickFill', True, True, True);
  end;
end;
