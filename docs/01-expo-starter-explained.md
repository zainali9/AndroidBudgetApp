# Lesson 1 — Understanding our React Native and Expo starter

This walkthrough describes the actual starter in this repository, created on `main` at commit `8b1cde1`. You already know Git, so the explanations focus on mobile development, React, TypeScript, and Expo.

## 1. What we have built so far

We have created the foundation for a new cross-platform application. It currently has one welcome screen, follows the phone's light/dark appearance, and can be compiled into an Android development APK.

This is not yet the full budget app. The five tabs, transaction forms, charts, SQLite database, and backup/restore are future milestones in this implementation. The Kotlin prototype remains on `master` as a reference for the design you approved.

Android is our first implementation and testing target. The project has an iOS identifier, but that is configuration only: iOS has not been built or tested.

## 2. What each technology contributes

| Technology | Job in this project |
| --- | --- |
| JavaScript | The language executed by the app's JavaScript engine. |
| TypeScript | Adds compile-time type checking to JavaScript. It catches many mistakes before running the app. |
| React | Organizes the interface into components and updates them when their inputs/state change. |
| React Native | Lets React components describe a native mobile interface on Android and iOS. |
| Expo | Provides compatible native libraries, configuration, command-line tools, and native project generation. |
| Node.js | Runs the development tools on your computer. It is not our app's financial backend. |
| npm | Installs the project's libraries and runs commands defined in package.json. |
| Metro | Builds and serves JavaScript during development. |
| JDK and Gradle | Compile and package the Android native application. |
| Android SDK | Supplies Android platform APIs, packaging tools, and device communication tools. |
| ADB | Communicates with the phone: install apps, launch activities, forward ports, and inspect logs. |
| SQLite (later) | Stores the user's financial records in a database on the device. It is not installed in this starter yet. |

React Native uses native mobile components. Our interface is not an HTML page running in a browser. Some layout concepts resemble CSS, but we use React Native components and style objects rather than HTML tags and stylesheets.

Further reading: [React Native core components](https://reactnative.dev/docs/intro-react-native-components).

## 3. What I did, step by step

1. Confirmed the project is on `main` and preserved the existing license and project instructions.
2. Downloaded Expo's official `blank-typescript` starter into an ignored staging directory, then copied only the relevant starter files to the project root.
3. Installed the template's compatible dependencies: Expo SDK 57, React Native 0.86, React 19, and TypeScript 6. Exact installed versions are captured in package-lock.json.
4. Added `expo-dev-client` for our own development app, `react-native-safe-area-context` for system-bar spacing, and `expo-system-ui` for system appearance support.
5. Replaced the default example with a simple My Budget welcome screen in App.tsx.
6. Configured the app name, identifiers, appearance, and Android backup flag in app.json.
7. Added a repeatable Windows build script using your JDK 17 and Android SDK.
8. Generated the native Android project with Expo Prebuild.
9. Checked TypeScript, dependency compatibility, Expo project health, and Android JavaScript bundling.
10. Compiled an ARM64 Android debug APK suitable for your OnePlus 8T.

The first native build took about 37 minutes because it downloaded and compiled new tooling. Later builds can reuse caches, although build time still depends on what changed.

## 4. How the files fit together

```text
BudgetApp/
  App.tsx                    The root screen you edit
  index.ts                   Registers that screen with Expo
  app.json                   App/native configuration
  package.json               Libraries and named development commands
  package-lock.json          Exact dependency resolution
  tsconfig.json              TypeScript rules
  assets/                    Starter icons and image files
  scripts/
    build-android.ps1        Our phone-free Android build command
  docs/
    01-expo-starter-explained.md
  android/                   Generated native Android project (ignored)
  node_modules/              Installed libraries (ignored)
```

There may also be ignored `.gradle`, `.idea`, `app/build`, or `build` directories left from earlier work. These are local/generated artifacts, not the React Native source files. We did not merge the Kotlin application into this new implementation.

### index.ts: the entry point

```ts
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

An `import` makes code from another file or library available. `./App` means the App file in the same directory. Registering `App` tells the runtime which React component to start with.

### App.tsx: the screen

The `.tsx` extension means the file contains TypeScript plus JSX, a syntax for writing interface elements inside code.

```tsx
export default function App() {
  return <Text>Hello!</Text>;
}
```

- `function App()` defines a React component.
- The capital A distinguishes a component from ordinary values in JSX.
- `return` supplies the interface description.
- `<Text>` is React Native's text component.
- `export default` lets index.ts import this component as `App`.

This small example illustrates the syntax; the actual App.tsx includes the full welcome layout.

## 5. Reading the actual screen

### Theme selection

```tsx
const dark = useColorScheme() === 'dark';
const colors = dark ? darkColors : lightColors;
```

The real file writes the two color objects directly in this expression. `const` declares a binding that is not reassigned. `===` compares values strictly. `condition ? a : b` chooses one of two values.

`useColorScheme()` is a hook: a React-oriented function that subscribes to the device's appearance setting. When that setting changes, React can render the component again with the appropriate colors. Calling a component again to calculate updated UI is called rendering; it does not mean reinstalling the app.

### The component tree

```text
SafeAreaProvider
  SafeAreaView
    StatusBar
    ScrollView
      Text: MY BUDGET
      Text: heading
      Text: introduction
      View: starter card
      View: feature row 01
      View: feature row 02
      View: feature row 03
```

- `SafeAreaProvider` supplies information about space occupied by system UI.
- `SafeAreaView` applies safe margins so content avoids system bars and cutouts.
- `StatusBar` chooses light or dark status-bar content.
- `ScrollView` lets the content scroll on a smaller screen or with larger text.
- `View` groups and lays out content.
- `Text` displays a string.

### Props: inputs to a component

```tsx
<StatusBar style={dark ? 'light' : 'dark'} />
```

`style` here is a prop: a named input. The braces switch from JSX markup into a JavaScript expression. This chooses a prop value using our `dark` boolean.

Props serve a similar purpose to arguments passed to the composable functions you saw in Kotlin.

### Styles

```tsx
<View style={[styles.card, { backgroundColor: colors.surface }]}>
```

The array combines two style objects. The shared card layout comes from `styles.card`; the current theme supplies its background color. Later entries override earlier entries for the same property.

Examples from StyleSheet.create:

- `padding: 22`: space inside the card.
- `gap: 12`: space between children.
- `borderRadius: 20`: rounded corners.
- `flexDirection: 'row'`: arrange children side by side.
- `flex: 1`: allow an element to occupy available space in its layout.
- `fontSize` and `lineHeight`: control text size and line spacing.

Layout numbers are logical display units, not necessarily physical pixels. Text also responds to accessibility settings. We will verify large-text behavior as the screens develop.

### Repeating feature rows

```tsx
items.map(([number, title, detail]) => (
  <View key={number}>...</View>
))
```

The actual screen contains three arrays describing the numbered features. `.map()` transforms each item into UI. `[number, title, detail]` is destructuring: it assigns those three values to local names. The `key` gives React a stable identity for each row.

## 6. Configuration versus screen code

App.tsx changes what the screen displays. app.json controls application metadata and native configuration.

| Setting | Our value or choice | Meaning |
| --- | --- | --- |
| name | My Budget | Display name. |
| slug | budget-app | Expo project slug. |
| version | 1.0.0 | Current app version string; not a claim that the full product is complete. |
| android.package | com.zaina.budgetapp | Android's application identifier. |
| ios.bundleIdentifier | com.zaina.budgetapp | Planned iOS identifier. |
| userInterfaceStyle | automatic | Allow appearance to follow the phone. |
| orientation | default | Do not restrict the app to portrait. |
| android.allowBackup | false | Disable the standard Android automatic-backup flag; complete backup/restore behavior still needs validation when storage is added. |
| plugins | expo-dev-client | Apply the development-client native configuration. |

The Kotlin prototype used `com.example.mybudgetapp`. These different identifiers allow both installations to coexist. A matching display name does not make them the same application.

The icon images are still template assets; custom branding is a later task.

## 7. Why we still generate an Android project

Your phone cannot install a folder of TypeScript files. It installs a native Android package containing the runtime and native libraries.

Our local flow is:

```text
app.json + package dependencies
           |
           v
     Expo Prebuild
           |
           v
 generated android/ project
           |
           v
 JDK + Gradle + Android SDK
           |
           v
      development APK
```

Expo Prebuild produces native Android files from our configuration and dependencies. We ignore those generated files in Git and maintain intended native changes through app.json/config plugins. Avoid manually treating generated files as the permanent source of truth: regeneration can overwrite manual changes.

See [Expo native project generation](https://docs.expo.dev/workflow/continuous-native-generation/).

## 8. How development code reaches your phone

There are two things involved when running this development build:

```text
Computer                                 OnePlus
App.tsx and libraries                    Installed native development app
        |                                           ^
        v                                           |
Metro on port 8081 -------- USB connection ----------+
        prepares and serves the JavaScript bundle
```

After installing the APK, the development client connects to Metro. The JavaScript executes on the device; Metro provides the code and development support.

With `adb reverse tcp:8081 tcp:8081`, a connection made by the phone to its localhost port 8081 is forwarded over USB to port 8081 on the computer. This avoids needing the phone and PC to discover each other over Wi-Fi.

If Metro is stopped or USB forwarding is gone, the development app may fail to load or reload the screen. That does not mean a database server is missing.

### Development build versus standalone release

| Build | Purpose | Needs Metro for our current workflow? |
| --- | --- | --- |
| Current development APK | Coding, debugging, rapid iteration | Yes |
| Future standalone APK | Normal use independent of the PC | No; it will include its JavaScript bundle |

The finished budgeting app will store financial data locally. We have not added SQLite yet. Development networking and the future app's offline data storage are separate concerns.

See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## 9. Commands you will actually use

Run project commands from the actual project folder:

```powershell
Set-Location 'G:\0.MyGitHub\BudgetApp'
```

The `.cmd` suffix avoids selecting PowerShell's npm script wrapper on Windows.

### Check code without opening the phone app

```powershell
npm.cmd run typecheck
npx.cmd expo install --check
npx.cmd expo-doctor
```

Type checking finds type-related mistakes. Dependency checking compares installed libraries with the Expo SDK's supported versions. Expo Doctor checks project health. None of these proves that the app looks or behaves correctly on a device.

### Build an APK without installing it

```powershell
npm.cmd run build:android
```

Our script checks that JAVA_HOME exists, finds the Android SDK, runs Prebuild for Android, and asks Gradle to assemble a debug APK for ARM64. The OnePlus 8T is an ARM64 device; an x86 emulator may require a different architecture build.

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### Install a built APK and start a USB development session

```powershell
$adbPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adbPath devices
& $adbPath install -r '.\android\app\build\outputs\apk\debug\app-debug.apk'
& $adbPath reverse tcp:8081 tcp:8081
npm.cmd start -- --localhost --port 8081
```

Keep that terminal open while testing. If the app shows its development launcher, connect it to `http://127.0.0.1:8081`. The `-r` flag requests reinstall/update of the same app without clearing its data.

Another workflow is `npm.cmd run android -- --device`, which lets Expo build, select a device, install, and start development.

### Stop development

Press Ctrl+C in the Metro terminal. The installed app remains on the phone. Restart Metro and restore USB forwarding when you want to continue editing.

## 10. When do we need another native build?

| Change | Usual action |
| --- | --- |
| Text, spacing, colors, ordinary TypeScript logic | Save the file; Fast Refresh usually updates the running app. |
| A JavaScript-only package | Install it; Metro may need a restart. |
| A native library such as SQLite | Install an Expo-compatible version and regenerate/rebuild the native app. |
| Native configuration or Expo SDK upgrade | Regenerate/rebuild, then reinstall. |

Not every text change needs a new APK. Fast Refresh is one reason this development workflow is useful. It does not guarantee state is always preserved and does not replace deliberate testing.

## 11. What has been verified

At the starter checkpoint:

- TypeScript strict checking passed.
- Expo dependency compatibility passed.
- Expo Doctor passed 21 checks.
- Metro exported the Android JavaScript bundle successfully.
- Gradle built the ARM64 APK successfully.
- APK metadata was verified: identifier com.zaina.budgetapp, minimum API 24, target API 36.

These results do not prove the complete budget application exists or that iOS works. On-device results for this session are recorded below after installation checks.

The installed dependency graph has 10 moderate advisories in Expo's tooling dependency chain. npm's proposed forced fix would downgrade Expo; it was not applied. We will review compatible upstream updates before release. Do not run a forced dependency upgrade/downgrade without understanding the changes.

## 12. A small exercise

1. Open App.tsx.
2. Find `Your money.` in the heading.
3. Change only that text to a phrase of your choice and save.
4. With Metro running and the phone connected, observe the updated screen.
5. Change `padding: 22` inside the card style to `padding: 12` and observe the spacing difference.
6. Undo the experiments if you prefer the original design.

This introduces the core workflow: edit a component, save, observe the result, and adjust.

## 13. What we will learn next

The five-screen milestone will introduce components in separate files, navigation, props, shared theme values, React state, and event handlers. Then SQLite will introduce permanent storage. We will connect each new concept to a visible feature rather than introduce all the libraries at once.

## 14. Phone setup performed in this session

- Detected the authorized OnePlus 8T / Android 14 over USB.
- Installed the development APK successfully.
- Forwarded phone port 8081 to the computer's Metro port over USB.
- Started Metro and verified its IPv4 status endpoint reports `packager-status:running`.
- Requested the app to open its local development URL.
- The phone was locked during the check, so the welcome screen has not yet been visually verified.

### Windows localhost adjustment

On this computer, Node initially resolved localhost to IPv6 (`::1`) while the phone's USB route used IPv4 (`127.0.0.1`). I updated the `start` command in package.json to:

```text
node --dns-result-order=ipv4first ./node_modules/expo/bin/cli start --dev-client
```

This affects the local development command; it does not change the budget app's financial logic. With `npm.cmd start -- --localhost --port 8081`, the server now answers the address used by the USB connection. It is not necessary to rebuild the APK for this change.
