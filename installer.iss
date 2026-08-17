[Setup]
AppName=IVAC Auto Fill Assistant
AppVersion=3.0.0
AppPublisher=DiGonto Tech
AppPublisherURL=https://digontoedu.com
DefaultDirName={autopf}\IVAC Auto Fill Assistant
DefaultGroupName=IVAC Auto Fill Assistant
OutputBaseFilename=IVAC_Auto_Fill_Setup_v3.0.0
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\IVAC Auto Fill\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\IVAC Auto Fill Assistant"; Filename: "{app}\IVAC Auto Fill.exe"
Name: "{group}\{cm:UninstallProgram,IVAC Auto Fill Assistant}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\IVAC Auto Fill Assistant"; Filename: "{app}\IVAC Auto Fill.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\IVAC Auto Fill.exe"; Description: "{cm:LaunchProgram,IVAC Auto Fill Assistant}"; Flags: nowait postinstall skipifsilent
