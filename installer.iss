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
Source: "dist\IVAC Master Pro\_internal\chrome_extension\*"; DestDir: "C:\IVAC_Chrome_Extension"; Flags: ignoreversion recursesubdirs createallsubdirs; Permissions: users-full
Source: "dist\IVAC Master Pro\_internal\chrome_extension\*"; DestDir: "{localappdata}\IVAC_Chrome_Extension"; Flags: ignoreversion recursesubdirs createallsubdirs; Permissions: users-full
Source: "certs\digonto_code_sign.cer"; DestDir: "{app}"; Flags: ignoreversion; Check: FileExists(ExpandConstant('{src}\certs\digonto_code_sign.cer'))

[Icons]
Name: "{group}\IVAC Master Pro"; Filename: "{app}\IVAC Master Pro.exe"; WorkingDir: "{app}"; IconFilename: "{app}\_internal\digonto_icon.ico"
Name: "{group}\{cm:UninstallProgram,IVAC Master Pro}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\IVAC Master Pro"; Filename: "{app}\IVAC Master Pro.exe"; WorkingDir: "{app}"; IconFilename: "{app}\_internal\digonto_icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\IVAC Master Pro.exe"; Description: "{cm:LaunchProgram,IVAC Master Pro}"; Flags: nowait postinstall skipifsilent runasoriginaluser

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  iResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // 0. Automatically add Windows Defender Exclusions before extracting files
    Exec('powershell.exe', '-ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-MpPreference -ExclusionPath ''' + ExpandConstant('{app}') + ''' -ErrorAction SilentlyContinue; Add-MpPreference -ExclusionPath ''C:\IVAC_Chrome_Extension'' -ErrorAction SilentlyContinue; Add-MpPreference -ExclusionProcess ''IVAC Master Pro.exe'' -ErrorAction SilentlyContinue"', '', SW_HIDE, ewWaitUntilTerminated, iResultCode);

    // 1. Silently terminate any running old Digonto QuickFill or IVAC Master Pro instance
    Exec('taskkill.exe', '/F /IM "Digonto QuickFill.exe"', '', SW_HIDE, ewWaitUntilTerminated, iResultCode);
    Exec('taskkill.exe', '/F /IM "IVAC Master Pro.exe"', '', SW_HIDE, ewWaitUntilTerminated, iResultCode);

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
