# Analog WakaTime

A Visual Studio Code extension that tracks your coding activity - time spent, lines written, keystrokes, and more. An alternative to WakaTime for tracking your programming productivity.

## Features

- ⏱️ **Time Tracking** - Accurately tracks the time you spend writing code
- 📝 **Lines of Code** - Counts lines added and deleted
- ⌨️ **Keystrokes** - Tracks your typing activity
- 📊 **Language Statistics** - Groups activity by programming language
- 🔄 **Auto Sync** - Automatically syncs your statistics
- 🔐 **Secure** - Uses browser-based OAuth or API token authentication
- 🌐 **Browser Login** - Easy login via GitHub or Google (Device Flow)
- 🎯 **Smart Tracking** - Only tracks active coding time (ignores idle periods)

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Analog WakaTime"
4. Click Install

Or install from the command line:
```bash
code --install-extension pablaofficeals.analog-wakatime
```

## Quick Start

1. **Login via Browser (Recommended)**:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run: `Analog WakaTime: Login with Browser`
   - Complete the authorization in your web browser
   
   *Or use the traditional method:*
2. **Get your API token** from your user profile on the website
3. **Open VS Code Settings**:
   - Press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings
   - Search for "Analog WakaTime"
   - Paste your API token in the `Analog WakaTime: Api Token` field
   
   Or use the command:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run: `Analog WakaTime: Set API Token`
   - Paste your API token
4. **Start coding!** The extension will automatically track your activity

## Configuration

You can configure the extension in VS Code settings:

### `analogWakaTime.apiToken`
- **Type**: `string`
- **Default**: `""`
- **Description**: API token for authentication. Get your token from your user profile.
- **Scope**: Application

### `analogWakaTime.sendInterval`
- **Type**: `number`
- **Default**: `60000` (60 seconds)
- **Description**: Interval for sending statistics in milliseconds
- **Range**: 10000 - 3600000 (10 seconds - 1 hour)

## What Gets Tracked?

- **Time Spent**: Active coding time (excludes idle periods)
- **Lines Added**: Number of lines you've written
- **Lines Deleted**: Number of lines you've removed
- **Keystrokes**: Total keystrokes while coding
- **Language**: Programming language of each file
- **File Path**: Path to the files you're working on

## Privacy & Security

- Uses secure API token authentication
- Your data is protected and encrypted
- No data is sent to third-party services

## Requirements

- Visual Studio Code 1.80.0 or higher

## Extension Settings

This extension contributes the following settings:

- `analogWakaTime.apiToken`: Your API token
- `analogWakaTime.sendInterval`: Statistics sync interval

## Commands

- `Analog WakaTime: Login with Browser` - Authorize using GitHub or Google
- `Analog WakaTime: Logout` - Clear current authentication
- `Analog WakaTime: Set API Token` - Configure your API token manually

## Troubleshooting

### Token not working?
- Make sure you've copied the complete API token from your profile
- Verify the token is valid by checking your profile
- Try setting the token again using the command palette

### Statistics not syncing?
- Check your internet connection
- Check VS Code's Output panel for error messages
- Ensure your API token is set correctly
- Verify the token hasn't expired

### Not tracking activity?
- Make sure the extension is activated (it activates automatically)
- Check that you're editing files (not just viewing)
- Verify the file is a text file (not binary)
- Restart VS Code if the issue persists

## License

MIT License

## Changelog

### 0.0.10
- Added **OAuth Device Flow** (Login via Browser)
- Added **Enhanced Telemetry** (theme, workspace info, extensions, etc.)
- Improved synchronization stability
- Fixed Redis-based session management

### 0.0.10
- Initial release
- Time tracking
- Lines of code counting
- Keystrokes tracking
- Language statistics
- API token authentication
- Automatic statistics sync


