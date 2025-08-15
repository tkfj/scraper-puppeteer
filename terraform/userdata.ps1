<powershell>
# 環境変数 TMP のパスを取得
$tempDir = [System.Environment]::GetEnvironmentVariable("TMP", "Machine")
if (-not $tempDir) {
  $tempDir = $env:TMP  # 念のためユーザー環境変数も確認
}
# ログファイルパス（TMP直下）
$masterLogFile   = Join-Path $tempDir "install_log.txt"
$masterErrorFile = Join-Path $tempDir "install_error.txt"

# TMP の値をログに記録
"TMP Environment Variable Value: $tempDir" | Out-File -FilePath $masterLogFile -Encoding utf8

try {
  # --- AWS CLI v2 ---
  # 保存先パス
  $InstallerPath = Join-Path $tempDir "AWSCLIV2.msi"
  $logFile   = Join-Path $tempDir "awscli_install_log.txt"

  # インストーラーのダウンロード
  Invoke-WebRequest "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile $InstallerPath

  # サイレントインストール
  Start-Process msiexec.exe -ArgumentList "/i `"$InstallerPath`" /qn /l* `"$logFile`"" -Wait

  # PATH 反映（再ログオンなしで使いたい場合）
  $cliPath = "C:\Program Files\Amazon\AWSCLIV2"
  $env:PATH = $clipath + ";" + $env:PATH

  # インストールバージョンをログに追記
  $version = & "aws" --version 2>&1
  "AWS CLI Installed Version: $version" | Out-File -FilePath $masterLogFile -Encoding utf8 -Append


  # --- Node.js ---
  $NodeVersion = "20.17.0"
  $NodeArch = "x64"

  $NodeInstaller = "node-v$NodeVersion-$NodeArch.msi"
  $NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeInstaller"

  # 保存先パス
  $InstallerPath = Join-Path $tempDir $NodeInstaller
  $logFile   = Join-Path $tempDir "nodejs_install_log.txt"

  # インストーラーのダウンロード
  Invoke-WebRequest $NodeUrl -OutFile $InstallerPath

  # サイレントインストール
  Start-Process msiexec.exe -ArgumentList "/i `"$InstallerPath`" /qn /l* `"$logFile`"" -Wait

  # PATH 反映（再ログオンなしで使いたい場合）
  $cliPath = "C:\Program Files\nodejs"
  $env:PATH = $clipath + ";" + $env:PATH

  # インストールバージョンをログに追記
  $version = & "node" --version 2>&1
  "Node.js Installed Version: $version" | Out-File -FilePath $masterLogFile -Encoding utf8 -Append
  $version = & "npm" --version 2>&1
  "npm Installed Version: $version" | Out-File -FilePath $masterLogFile -Encoding utf8 -Append



  $GitVersion = "2.45.2"  # 固定したい場合はここで指定
  $GitInstaller = "Git-$GitVersion-64-bit.exe"
  $GitUrl = "https://github.com/git-for-windows/git/releases/download/v$GitVersion.windows.1/$GitInstaller"

  # 保存先パス
  $InstallerPath = Join-Path $tempDir $GitInstaller
  $logFile   = Join-Path $tempDir "git_install_log.txt"

  # インストーラーのダウンロード
  Write-Host "Downloading Git..."
  Invoke-WebRequest $GitUrl -OutFile $InstallerPath

  # サイレントインストール
  Write-Host "Installing Git..."
  Start-Process -FilePath "$InstallerPath" -ArgumentList "/VERYSILENT /NORESTART /LOG=`"$logFile`"" -Wait

  # PATH 反映（再ログオンなしで使いたい場合）
  $cliPath = "C:\Program Files\Git\cmd"
  $env:PATH = $clipath + ";" + $env:PATH

  # インストールバージョンをログに追記
  $version = & "git" --version 2>&1
  "Git Installed Version: $version" | Out-File -FilePath $masterLogFile -Encoding utf8 -Append

  mkdir C:\projects
  cd C:\projects
  git clone https://github.com/tkfj/scraper-puppeteer.git
  cd scraper-puppeteer
  npm install
  npx puppeteer browsers install chrome
}
catch {
  $_ | Out-File -FilePath $masterErrorFile -Encoding utf8 -Append
}
</powershell>
