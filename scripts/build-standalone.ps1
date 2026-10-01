# Personal standalone APK. Keeps the existing local signing key for in-place updates.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'Set JAVA_HOME to JDK 17.' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
Push-Location $projectRoot
try {
    $preservedKey = Join-Path $projectRoot 'build/local-signing/debug.keystore'
    $generatedKey = Join-Path $projectRoot 'android/app/debug.keystore'
    if (-not (Test-Path -LiteralPath $preservedKey)) {
        if (-not (Test-Path -LiteralPath $generatedKey)) { throw 'Existing signing key is required. Do not generate a new key for an installed app.' }
        New-Item -ItemType Directory -Force (Split-Path -Parent $preservedKey) | Out-Null
        Copy-Item -LiteralPath $generatedKey -Destination $preservedKey
    }
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
    Copy-Item -LiteralPath $preservedKey -Destination $generatedKey -Force
    # Expo's local template signs release with this debug key. This APK is for personal sideloading,
    # not Play Store publication. Verify the certificate against the installed APK before installing.
    $gradleFile = Get-Content android/app/build.gradle -Raw
    if ($gradleFile -notmatch 'signingConfig signingConfigs.debug') { throw 'Review release signing configuration before building' }
    Push-Location android
    try {
        & .\gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a' --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Standalone build failed' }
    } finally { Pop-Location }
} finally { Pop-Location }
