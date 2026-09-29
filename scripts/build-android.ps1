# Build without a connected phone. Generated Android sources stay out of Git.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
    throw 'Set JAVA_HOME to your JDK 17 installation before building.'
}
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
if (-not (Test-Path $env:ANDROID_HOME)) { throw 'Android SDK not found; set ANDROID_HOME.' }
Push-Location $projectRoot
try {
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Expo native project generation failed.' }
    Push-Location android
    try {
        # OnePlus 8T uses ARM64. Add other ABIs when emulator/distribution testing needs them.
        & .\gradlew.bat assembleDebug '-PreactNativeArchitectures=arm64-v8a' --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }
} finally { Pop-Location }
