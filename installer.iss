[Setup]
AppName=Digonto QuickFill
AppVersion=4.0.0
AppPublisher=DiGonto Tech
AppPublisherURL=https://digontoedu.com
DefaultDirName={autopf}\Digonto QuickFill
DefaultGroupName=Digonto QuickFill
OutputBaseFilename=Digonto_QuickFill_Setup_v4.0.0
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\Digonto QuickFill\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Digonto QuickFill"; Filename: "{app}\Digonto QuickFill.exe"; IconFilename: "{app}\_internal\icon_v5.ico"
Name: "{group}\{cm:UninstallProgram,Digonto QuickFill}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Digonto QuickFill"; Filename: "{app}\Digonto QuickFill.exe"; IconFilename: "{app}\_internal\icon_v5.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\Digonto QuickFill.exe"; Description: "{cm:LaunchProgram,Digonto QuickFill}"; Flags: nowait postinstall skipifsilent
