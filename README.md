# Analog WakaTime

Analog WakaTime is a Visual Studio Code extension that records active coding time, keystrokes, and line changes, then syncs aggregated activity to the Analog backend. It is built around automatic background tracking, a local offline queue, and a small status bar summary inside VS Code.

## Features

- Tracks active coding time for focused local files
- Counts keystrokes and line additions/deletions per file
- Groups uploaded activity by language, date, hour, and project
- Supports browser-based device-flow login
- Keeps unsent data in a local queue and retries automatically
- Shows authentication, online status, and tracked time in the status bar
- Includes manual API token input through settings or a command

## Requirements

- Visual Studio Code `1.80.0` or newer
- Network access for authentication, synchronization, and dashboard access
- An external browser for the device-flow sign-in command

## Installation

Install from the VS Code Marketplace:

1. Open Extensions in VS Code
2. Search for `Analog WakaTime`
3. Select the extension published by `pablaofficeals`
4. Click Install

Or install from the command line:

```bash
code --install-extension pablaofficeals.analog-wakatime
```

## Quick Start

1. Open the Command Palette
2. Run `Analog WakaTime: Login with Browser`
3. Copy the device code shown by the extension
4. Open the browser window and complete authorization
5. Start coding in local files

The extension will begin tracking once it has authentication and an active local file. The status bar item shows the current state:

- `$(lock) Need authentication` when sign-in is missing
- `$(cloud-upload)` when the backend is reachable
- `$(cloud-off)` when the extension is saving locally and waiting to retry

### Manual API token

The extension also exposes:

- the `Analog WakaTime: Set API Token` command
- the `analogWakaTime.apiToken` setting

Browser login is the primary sign-in flow and is the best-tested path. Manual token entry is useful when you already have a token and want to store or replace it in VS Code.

## Dashboard

Your personal dashboard is available at:

`https://analogwakatime.com/dashboard`

## Commands

- `Analog WakaTime: Login with Browser`  
  Starts the device-flow authorization flow and stores the received token.

- `Analog WakaTime: Logout`  
  Clears the stored token and stops authenticated tracking until you log in again.

- `Analog WakaTime: Set API Token`  
  Prompts for an API token and updates the extension configuration.

- `Analog WakaTime: Show Statistics`  
  Shows total tracked time, current session time, and the number of unsynced records.

- `Analog WakaTime: Force Sync Now`  
  Saves current in-memory activity, uploads queued records immediately, and marks them as synced if the request succeeds.

## Settings

### `analogWakaTime.apiToken`

- Type: `string`
- Default: `""`
- Scope: `application`
- Purpose: stores the API token used for authenticated requests

### `analogWakaTime.sendInterval`

- Type: `number`
- Default: `5000`
- Minimum: `1000`
- Maximum: `3600000`
- Purpose: controls how often the extension snapshots current activity and tries an immediate upload

## How Tracking Works

The implementation in `src/activityTracker.ts` and `src/extension.ts` works like this:

- Only documents with the `file` URI scheme are tracked
- Activity time is updated once per second
- Time is counted only while:
  - the VS Code window is focused
  - there is an active tracked file
  - the user has been active within the last 2 minutes
- Opening files, editing text, changing selections, switching visible editors, and returning focus mark the user as active
- Each file keeps:
  - language
  - keystrokes
  - added lines
  - deleted lines
  - active time
  - first and last activity timestamps

The extension resets the current in-memory counters after each successful snapshot cycle, whether the data was uploaded immediately or written to the local queue for later retry.

## Sync and Offline Queue

The extension uses two layers of delivery:

1. A fast snapshot loop driven by `analogWakaTime.sendInterval`  
   If the user is authenticated and there is activity, the extension tries to upload the current stats immediately.

2. A background flush loop every 30 seconds  
   Unsynced records stored locally are retried in batches through the sync endpoint.

Additional behavior from the source:

- Connectivity is checked every 10 seconds
- Unsynced activity is stored in a local JSON file under the extension's global storage
- Synced records older than 30 days are cleaned up once per day
- On deactivation, the extension saves any final in-memory activity and attempts one last sync pass

## Data Sent to the Backend

Your activity analytics are stored on Analog WakaTime servers. You can review your stats in the dashboard:

`https://analogwakatime.com/dashboard`

Each grouped activity record can include:

- `language`
- `lines`
- `time`
- `date`
- `hour`
- `path`
- `project_name`

Important details from the current implementation:

- I cannot physically view your source code through this extension
- uploads are grouped by language, day, hour, workspace path, and workspace name
- `lines` is the net added line count and is never sent as a negative number
- raw file contents are not uploaded
- the extension uses project or workspace paths, not individual file contents, when building upload payloads

## Telemetry

The extension also sends service telemetry on startup, every 30 minutes, and again during disposal.

The current telemetry payload includes fields derived from the running VS Code session, including:

- installation ID generated by the extension
- extension version
- VS Code version
- operating system
- number of open files
- detected languages
- whether an API token is present
- current theme kind
- number of workspace folders
- count of active extensions
- machine ID
- session ID
- whether this is a new app install
- UI kind
- remote environment name

There is currently no dedicated telemetry opt-out setting contributed by the extension UI.

## Status Bar

The status bar item is always available after activation and opens `Show Statistics` when clicked.

It displays:

- authentication state
- online or offline state
- total tracked time including saved and current-session activity

Its tooltip also shows whether there are records still waiting for synchronization.

## Troubleshooting

### The extension keeps asking me to authenticate

- Use `Analog WakaTime: Login with Browser`
- Complete the browser step before the device code expires
- If you previously stored a token manually, try the browser flow to refresh the full authenticated state

### Sync is not happening

- Check whether the status bar shows `$(cloud-off)`
- Run `Analog WakaTime: Force Sync Now`
- Confirm the backend is reachable from your machine
- Re-enter your token or log in again if the token may be invalid

### Time is not increasing

- Make sure you are editing a local file, not a non-file resource
- Keep the VS Code window focused
- Activity pauses after 2 minutes of inactivity
- Open `Analog WakaTime: Show Statistics` to confirm whether data is being saved locally

## Development

Useful project scripts from `package.json`:

```bash
npm run compile
npm run watch
npm run package
npm run publish
```

Notes:

- `npm run package` uses `vsce package --allow-missing-repository --no-yarn`
- `npm run publish` uses `vsce publish --allow-missing-repository`
- bump the extension version before packaging or publishing

## License

Apache License 2.0
