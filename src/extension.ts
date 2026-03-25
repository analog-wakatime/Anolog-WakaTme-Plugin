import * as vscode from 'vscode';
import { ActivityTracker } from './activityTracker';
import { ApiClient } from './apiClient';
import { LocalDatabase } from './localDatabase';
import { StatusBar } from './statusBar';
import { Telemetry } from './telemetry';
import { AuthManager } from './authManager';
import { output } from './output';

let activityTracker: ActivityTracker | undefined;
let syncInterval: NodeJS.Timeout | undefined;
let saveInterval: NodeJS.Timeout | undefined;
let statusUpdateInterval: NodeJS.Timeout | undefined;
let authReminderInterval: NodeJS.Timeout | undefined;
let apiClient: ApiClient | undefined;
let localDb: LocalDatabase | undefined;
let statusBar: StatusBar | undefined;
let telemetry: Telemetry | undefined;
let authManager: AuthManager | undefined;
let pingInterval: NodeJS.Timeout | undefined;
let isOnline: boolean = true;

const DEFAULT_SEND_INTERVAL_MS = 5000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const STATUS_UPDATE_INTERVAL_MS = 1000;
const AUTH_REMINDER_INTERVAL_MS = 2 * 60 * 1000;
const PING_INTERVAL_MS = 10 * 1000;
const FLUSH_INTERVAL_MS = 30 * 1000;

function updatePluginState() {
    const isAuth = authManager?.isAuthenticated() || false;
    activityTracker?.setEnabled(isAuth);
    statusBar?.setAuthenticated(isAuth);
    statusBar?.setOnline(isOnline);

    if (isAuth) {
        if (authReminderInterval) {
            clearInterval(authReminderInterval);
            authReminderInterval = undefined;
        }
    } else {
        if (!authReminderInterval) {
            authReminderInterval = setInterval(() => {
                vscode.window.showWarningMessage(
                    'Analog WakaTime: Please authenticate to start tracking time.',
                    'Login'
                ).then(selection => {
                    if (selection === 'Login') {
                        vscode.commands.executeCommand('analogWakaTime.login');
                    }
                });
            }, AUTH_REMINDER_INTERVAL_MS);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    output.init(context);
    output.show(true);
    output.info('Starting plugin...');

    const config = vscode.workspace.getConfiguration('analogWakaTime');
    const backendUrl = 'https://testingmyproject.space';
    const apiToken = config.get<string>('apiToken', '');
    const sendIntervalMs = Math.max(1000, config.get<number>('sendInterval', DEFAULT_SEND_INTERVAL_MS));

    localDb = new LocalDatabase(context);
    statusBar = new StatusBar(localDb);
    apiClient = new ApiClient(backendUrl, apiToken);
    activityTracker = new ActivityTracker();
    telemetry = new Telemetry(context);
    authManager = new AuthManager(context);

    if (apiToken) {
        apiClient.validateToken().then(isValid => {
            if (!isValid) {
                output.warn('Token is invalid');
                vscode.window.showWarningMessage(
                    'Analog WakaTime: Token is invalid. Please log in again.',
                    'Login'
                ).then(selection => {
                    if (selection === 'Login') {
                        vscode.commands.executeCommand('analogWakaTime.login');
                    }
                });
            } else {
                output.info('Token is valid');
            }
        });
    } else {
        output.warn('No token configured');
        vscode.window.showInformationMessage(
            'Analog WakaTime: Please log in to synchronize statistics',
            'Login through browser'
        ).then(selection => {
            if (selection === 'Login through browser') {
                vscode.commands.executeCommand('analogWakaTime.login');
            }
        });
    }

    updatePluginState();

    const setApiTokenCommand = vscode.commands.registerCommand('analogWakaTime.setApiToken', async () => {
        const token = await vscode.window.showInputBox({
            prompt: 'Enter API token from your profile on the website',
            placeHolder: 'Paste token here...',
            password: true,
            ignoreFocusOut: true,
            value: apiToken || ''
        });

        if (token !== undefined) {
            try {
                await config.update('apiToken', token, vscode.ConfigurationTarget.Global);

                if (apiClient) {
                    apiClient.updateConfig(backendUrl, token);

                    const isValid = await apiClient.validateToken();
                    if (isValid) {
                        vscode.window.showInformationMessage('✅ API token successfully installed and verified!');
                    } else {
                        vscode.window.showWarningMessage('⚠️ API token installed, but failed verification. Please make sure the token is correct.');
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Error saving token: ${error}`);
            }
        }
    });

    const showStatsCommand = vscode.commands.registerCommand('analogWakaTime.showStats', () => {
        const savedSeconds = localDb?.getTotalTime() || 0;
        const sessionTime = activityTracker?.getSessionTime() || 0;
        const sessionSeconds = Math.floor(sessionTime / 1000);
        const totalSeconds = savedSeconds + sessionSeconds;

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const unsynced = localDb?.getUnsyncedCount() || 0;

        let message = `⏱️ Analog WakaTime\n\n`;
        message += `📊 Total time: ${hours} h ${minutes} min\n`;
        message += `💻 Current session: ${Math.floor(sessionSeconds / 60)} min\n`;

        if (unsynced > 0) {
            message += `⏳ Waiting for synchronization: ${unsynced} records`;
        } else {
            message += `✅ Everything synchronized`;
        }

        vscode.window.showInformationMessage(message);
    });

    const forceSyncCommand = vscode.commands.registerCommand('analogWakaTime.forceSync', async () => {
        const currentConfig = vscode.workspace.getConfiguration('analogWakaTime');
        const currentToken = currentConfig.get<string>('apiToken', '');

        if (!currentToken) {
            vscode.window.showWarningMessage('First configure API token');
            return;
        }

        if (!localDb || !apiClient) {
            return;
        }

        const stats = activityTracker?.getStats();
        if (stats && Object.keys(stats.activeFiles).length > 0) {
            localDb.saveActivity(stats);
            activityTracker?.resetStats();
        }

        const unsyncedActivities = localDb.getUnsyncedActivities();
        if (unsyncedActivities.length === 0) {
            vscode.window.showInformationMessage('✅ No data for synchronization');
            return;
        }

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Synchronization...',
                cancellable: false
            }, async () => {
                await apiClient!.syncActivities(unsyncedActivities);
                localDb!.markAsSynced(unsyncedActivities);
            });

            vscode.window.showInformationMessage(`✅ Synchronized ${unsyncedActivities.length} records`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`❌ Synchronization error: ${error.message || error}`);
        }
    });

    const loginCommand = vscode.commands.registerCommand('analogWakaTime.login', async () => {
        if (!authManager) {
            vscode.window.showErrorMessage('Auth Manager not initialized');
            return;
        }

        const success = await authManager.login();
        if (success && apiClient) {
            const newToken = authManager.getToken();
            if (newToken) {
                apiClient.updateConfig(backendUrl, newToken);
            }
            updatePluginState();
        }
    });

    const logoutCommand = vscode.commands.registerCommand('analogWakaTime.logout', async () => {
        if (!authManager) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            'Analog WakaTime: Are you sure you want to log out?',
            'Yes, log out',
            'Cancel'
        );

        if (confirm === 'Yes, log out') {
            await authManager.logout();
            if (apiClient) {
                apiClient.updateConfig(backendUrl, '');
            }
            updatePluginState();
            vscode.window.showInformationMessage('✅ Analog WakaTime: You have logged out');
        }
    });

    context.subscriptions.push(setApiTokenCommand, showStatsCommand, forceSyncCommand, loginCommand, logoutCommand);

    saveInterval = setInterval(() => {
        if (!authManager?.isAuthenticated()) {
            return;
        }

        const stats = activityTracker?.getStats();
        if (stats && Object.keys(stats.activeFiles).length > 0 && localDb) {
            const hasActivity = stats.totalTimeSpent > 0 || stats.totalKeystrokes > 0;

            if (hasActivity) {
                const sendNow = async () => {
                    if (!apiClient) return;
                    if (!isOnline) throw new Error('offline');
                    await apiClient.sendActivity(stats);
                };

                sendNow().then(() => {
                    localDb?.saveActivity(stats);
                    localDb?.markAsSynced(localDb.getUnsyncedActivities());
                    activityTracker?.resetStats();
                }).catch(() => {
                    localDb?.saveActivity(stats);
                    activityTracker?.resetStats();
                });
            }
        }
    }, sendIntervalMs);

    statusUpdateInterval = setInterval(() => {
        if (statusBar && activityTracker) {
            const sessionTime = activityTracker.getSessionTime();
            statusBar.updateWithSession(sessionTime);
        }
    }, STATUS_UPDATE_INTERVAL_MS);

    syncInterval = setInterval(async () => {
        if (!authManager?.isAuthenticated()) {
            return;
        }

        const currentConfig = vscode.workspace.getConfiguration('analogWakaTime');
        const currentToken = currentConfig.get<string>('apiToken', '');

        if (!currentToken || !localDb || !apiClient) {
            return;
        }

        const unsyncedActivities = localDb.getUnsyncedActivities();
        if (unsyncedActivities.length === 0) {
            return;
        }

        try {
            if (!isOnline) {
                return;
            }
            await apiClient.syncActivities(unsyncedActivities);
            localDb.markAsSynced(unsyncedActivities);
        } catch (error: any) {
            console.error('[Analog WakaTime] Synchronization error:', error);
        }
    }, FLUSH_INTERVAL_MS);

    pingInterval = setInterval(async () => {
        if (!apiClient) return;
        const ok = await apiClient.ping();
        if (ok !== isOnline) {
            isOnline = ok;
            statusBar?.setOnline(isOnline);
        }
    }, PING_INTERVAL_MS);

    context.subscriptions.push({
        dispose: async () => {
            output.info('Deactivation of the plugin...');

            if (saveInterval) {
                clearInterval(saveInterval);
            }
            if (syncInterval) {
                clearInterval(syncInterval);
            }
            if (statusUpdateInterval) {
                clearInterval(statusUpdateInterval);
            }
            if (pingInterval) {
                clearInterval(pingInterval);
            }

            const finalStats = activityTracker?.getStats();
            if (finalStats && Object.keys(finalStats.activeFiles).length > 0 && localDb) {
                const hasActivity = finalStats.totalTimeSpent > 0 || finalStats.totalKeystrokes > 0;
                if (hasActivity) {
                    localDb.saveActivity(finalStats);
                }
            }

            const currentConfig = vscode.workspace.getConfiguration('analogWakaTime');
            const currentToken = currentConfig.get<string>('apiToken', '');

            if (currentToken && localDb && apiClient) {
                const unsyncedActivities = localDb.getUnsyncedActivities();
                if (unsyncedActivities.length > 0) {
                    try {
                        output.info(`Final synchronization: ${unsyncedActivities.length} records`);
                        await apiClient.syncActivities(unsyncedActivities);
                        localDb.markAsSynced(unsyncedActivities);
                        output.info('Final synchronization completed');
                    } catch (error: any) {
                        output.error(`Final synchronization error: ${error?.message || String(error)}`);
                    }
                }
            }
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('analogWakaTime')) {
                const newConfig = vscode.workspace.getConfiguration('analogWakaTime');
                const newApiToken = newConfig.get<string>('apiToken', '');

                if (apiClient) {
                    apiClient.updateConfig(backendUrl, newApiToken);
                }
            }
        })
    );

    setInterval(() => {
        localDb?.cleanupOldRecords();
    }, 24 * 60 * 60 * 1000);

    output.info('Plugin activated');
}

export function deactivate() {
    output.info('Deactivation...');

    if (saveInterval) {
        clearInterval(saveInterval);
    }
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
    if (authReminderInterval) {
        clearInterval(authReminderInterval);
    }
    if (pingInterval) {
        clearInterval(pingInterval);
    }

    if (activityTracker && localDb) {
        const finalStats = activityTracker.getStats();
        if (finalStats && Object.keys(finalStats.activeFiles).length > 0) {
            const hasActivity = finalStats.totalTimeSpent > 0 || finalStats.totalKeystrokes > 0;
            if (hasActivity) {
                localDb.saveActivity(finalStats);
            }
        }
    }

    if (apiClient && localDb) {
        const config = vscode.workspace.getConfiguration('analogWakaTime');
        const apiToken = config.get<string>('apiToken', '');

        if (apiToken) {
            const unsyncedActivities = localDb.getUnsyncedActivities();
            if (unsyncedActivities.length > 0) {
                apiClient.syncActivities(unsyncedActivities).then(() => {
                    localDb?.markAsSynced(unsyncedActivities);
                }).catch((error) => {
                    console.error('[Analog WakaTime] Final synchronization error:', error);
                });
            }
        }
    }

    if (activityTracker) {
        activityTracker.dispose();
    }
    if (statusBar) {
        statusBar.dispose();
    }
    if (telemetry) {
        telemetry.dispose();
    }

    activityTracker = undefined;
    apiClient = undefined;
    localDb = undefined;
    statusBar = undefined;
    telemetry = undefined;
}