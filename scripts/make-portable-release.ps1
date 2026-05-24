param(
  [string]$NodeVersion = ""
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ReleaseDir = Join-Path $Root "release"
$CacheDir = Join-Path $ReleaseDir ".cache"
$StageDir = Join-Path $ReleaseDir "GPI_2.0_Portable"
$AppDir = Join-Path $StageDir "app"
$RuntimeDir = Join-Path $StageDir "runtime"
$NodeDir = Join-Path $RuntimeDir "node"
$ZipPath = Join-Path $ReleaseDir "GPI_2.0_Portable.zip"

function Assert-InRoot($Path) {
  $full = [System.IO.Path]::GetFullPath($Path)
  $rootFull = [System.IO.Path]::GetFullPath($Root)
  if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch path outside project root: $full"
  }
}

function Remove-Directory($Path) {
  Assert-InRoot $Path
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Remove-File($Path) {
  Assert-InRoot $Path
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Force
  }
}

Set-Location -LiteralPath $Root

if (-not $NodeVersion) {
  $NodeVersion = (& node --version).Trim().TrimStart("v")
}

$NodeTag = "v$NodeVersion"
$NodeZipName = "node-$NodeTag-win-x64.zip"
$NodeZipPath = Join-Path $CacheDir $NodeZipName
$NodeExtractDir = Join-Path $CacheDir "node-$NodeTag-win-x64"
$NodeUrl = "https://nodejs.org/dist/$NodeTag/$NodeZipName"
$ShasumsPath = Join-Path $CacheDir "node-$NodeTag-SHASUMS256.txt"
$ShasumsUrl = "https://nodejs.org/dist/$NodeTag/SHASUMS256.txt"

function Get-ExpectedNodeZipHash {
  if (-not (Test-Path -LiteralPath $ShasumsPath)) {
    Write-Host "Downloading Node.js checksums..."
    Invoke-WebRequest -Uri $ShasumsUrl -OutFile $ShasumsPath
  }

  $escapedName = [regex]::Escape($NodeZipName)
  $line = Get-Content -LiteralPath $ShasumsPath | Where-Object { $_ -match "^\s*([a-fA-F0-9]{64})\s+$escapedName\s*$" } | Select-Object -First 1
  if (-not $line) {
    throw "Could not find checksum for $NodeZipName in SHASUMS256.txt"
  }

  return ([regex]::Match($line, "^\s*([a-fA-F0-9]{64})").Groups[1].Value).ToLowerInvariant()
}

function Get-Sha256Hex($Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hash = $sha256.ComputeHash($stream)
      return ([System.BitConverter]::ToString($hash) -replace "-", "").ToLowerInvariant()
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Test-NodeZipHash {
  $expected = Get-ExpectedNodeZipHash
  $actual = Get-Sha256Hex $NodeZipPath
  if ($actual -ne $expected) {
    Remove-File $NodeZipPath
    throw "Node.js ZIP checksum mismatch. Expected $expected but got $actual."
  }
  Write-Host "Node.js checksum verified."
}

Write-Host "Preparing GPI 2.0 portable release..." -ForegroundColor Cyan
Write-Host "Node runtime: $NodeTag"

New-Item -ItemType Directory -Force -Path $ReleaseDir, $CacheDir | Out-Null

Write-Host "Installing npm dependencies..."
if (Test-Path -LiteralPath (Join-Path $Root "package-lock.json")) {
  npm ci
} else {
  npm install
}

Write-Host "Building web app..."
npm run build

if (-not (Test-Path -LiteralPath $NodeZipPath)) {
  Write-Host "Downloading portable Node.js..."
  Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZipPath
}

Test-NodeZipHash

if (-not (Test-Path -LiteralPath (Join-Path $NodeExtractDir "node.exe"))) {
  Write-Host "Extracting portable Node.js..."
  Remove-Directory $NodeExtractDir
  Expand-Archive -LiteralPath $NodeZipPath -DestinationPath $CacheDir -Force
}

Write-Host "Creating release folder..."
Remove-Directory $StageDir
Remove-File $ZipPath

New-Item -ItemType Directory -Force -Path $AppDir, $RuntimeDir, $NodeDir | Out-Null

Copy-Item -Path (Join-Path $NodeExtractDir "*") -Destination $NodeDir -Recurse -Force

Copy-Item -LiteralPath (Join-Path $Root "server") -Destination $AppDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $Root "dist") -Destination $AppDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $Root "package.json") -Destination $AppDir -Force
Copy-Item -LiteralPath (Join-Path $Root "package-lock.json") -Destination $AppDir -Force
Copy-Item -LiteralPath (Join-Path $Root "README.md") -Destination $AppDir -Force

Write-Host "Installing runtime npm dependencies..."
Push-Location -LiteralPath $AppDir
try {
  npm ci --omit=dev --no-audit --no-fund
} finally {
  Pop-Location
}

$RunBatName = "GPI " + [char]0xC2E4 + [char]0xD589 + ".bat"
$GuideName = "GPI " + [char]0xCC98 + [char]0xC74C + " " + [char]0xC77D + [char]0xC5B4 + [char]0xC8FC + [char]0xC138 + [char]0xC694 + ".txt"
$GuideBase64 = "R1BJIDIuMCDsi6Ttlokg67Cp67KVCgoxLiAiR1BJIOyLpO2WiS5iYXQi7J2EIOuNlOu4lO2BtOumre2VmOyEuOyalC4KMi4g67iM65287Jqw7KCA6rCAIOyekOuPmeycvOuhnCDsl7Trpr3ri4jri6QuCjMuIOyVsSDsnITsqr0g6rCA7Jq0642w7JeQ7IScIO2VmOuCmOulvCDshKDtg53tlZjshLjsmpQuCgpPcGVuQUkg7IKs7JqpOgoiY2hhdCBncHQgb2F1dGgg66Gc6re47J24IiDrsoTtirzsnYQg64iE66W07IS47JqULgpPcGVuQUkgQVBJIEtleeuKlCDtlYTsmpQg7JeG7Iq164uI64ukLgoKR2VtaW5pIOyCrOyaqToKImdlbWluaSBhcGkga2V5IOyeheugpSIg67KE7Yq87J2EIOuIhOultOqzoCBHZW1pbmkgQVBJIEtleeulvCDrtpnsl6zrhKPsnLzshLjsmpQuCgrso7zsnZg6CkdQSeulvCDsk7DripQg64+Z7JWIIOqygOydgCDshJzrsoQg7LC97J2AIOuLq+yngCDrp4jshLjsmpQuCkdQSeulvCDrgYTqs6Ag7Iu27Jy866m0IOq3uCDqsoDsnYAg7LC97J2EIOuLq+ycvOuptCDrkKnri4jri6QuCgrruIzrnbzsmrDsoIDqsIAg7J6Q64+Z7Jy866GcIOyViCDsl7TrpqzrqbQg7JWE656YIOyjvOyGjOulvCDsp4HsoJEg7Jes7IS47JqULgpodHRwOi8vMTI3LjAuMC4xOjg3ODc="

@'
@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0runtime\node;%PATH%"

echo.
echo ================================
echo GPI 2.0
echo ================================
echo.
echo Browser will open automatically.
echo Keep this black window open while using GPI.
echo Close this window when you want to stop GPI.
echo.

if not exist "%~dp0runtime\node\node.exe" (
  echo Missing runtime\node\node.exe
  echo Please download GPI_2.0_Portable.zip again.
  pause
  exit /b 1
)

if not exist "%~dp0app\dist\index.html" (
  echo Missing app\dist\index.html
  echo Please download GPI_2.0_Portable.zip again.
  pause
  exit /b 1
)

"%~dp0runtime\node\node.exe" "%~dp0app\server\index.js" --production --open
if errorlevel 1 (
  echo.
  echo GPI stopped with an error.
  echo Check the message above.
  echo.
  pause
  exit /b 1
)

echo.
echo GPI stopped.
echo.
pause
'@ | Set-Content -LiteralPath (Join-Path $StageDir $RunBatName) -Encoding Default

$GuideText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($GuideBase64))
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $StageDir $GuideName), $GuideText, $Utf8NoBom)

Write-Host "Creating ZIP..."
Compress-Archive -LiteralPath $StageDir -DestinationPath $ZipPath -Force

Write-Host ""
Write-Host "Portable release ready:" -ForegroundColor Green
Write-Host $ZipPath
