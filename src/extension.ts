import * as vscode from 'vscode';
import { ActivityTracker } from './activityTracker';
import { ApiClient } from './apiClient';
import { LocalDatabase } from './localDatabase';
import { StatusBar } from './statusBar';
import { Telemetry } from './telemetry';

let activityTracker: ActivityTracker | undefined;
let syncInterval: NodeJS.Timeout | undefined;
let saveInterval: NodeJS.Timeout | undefined;
let statusUpdateInterval: NodeJS.Timeout | undefined;
let apiClient: ApiClient | undefined;
let localDb: LocalDatabase | undefined;
let statusBar: StatusBar | undefined;
let telemetry: Telemetry | undefined;

const SAVE_INTERVAL_MS = 30000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const STATUS_UPDATE_INTERVAL_MS = 1000;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Analog WakaTime] Активация плагина...');
    
    const config = vscode.workspace.getConfiguration('analogWakaTime');
    const backendUrl = 'https://testingmyproject.space'; 
    const apiToken = config.get<string>('apiToken', '');

    localDb = new LocalDatabase(context);
    statusBar = new StatusBar(localDb);
    apiClient = new ApiClient(backendUrl, apiToken);
    activityTracker = new ActivityTracker();
    telemetry = new Telemetry(context);

    if (apiToken) {
        apiClient.validateToken().then(isValid => {
            if (!isValid) {
                vscode.window.showWarningMessage(
                    'Analog WakaTime: API токен недействителен. Пожалуйста, обновите токен в настройках.',
                    'Настроить токен'
                ).then(selection => {
                    if (selection === 'Настроить токен') {
                        vscode.commands.executeCommand('analogWakaTime.setApiToken');
                    }
                });
            } else {
                console.log('[Analog WakaTime] Токен валиден');
            }
        });
    } else {
        vscode.window.showInformationMessage(
            'Analog WakaTime: Настройте API токен для синхронизации статистики',
            'Настроить'
        ).then(selection => {
            if (selection === 'Настроить') {
                vscode.commands.executeCommand('analogWakaTime.setApiToken');
            }
        });
    }

    const setApiTokenCommand = vscode.commands.registerCommand('analogWakaTime.setApiToken', async () => {
        const token = await vscode.window.showInputBox({
            prompt: 'Введите API токен из вашего профиля на сайте',
            placeHolder: 'Вставьте токен здесь...',
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
                        vscode.window.showInformationMessage('✅ API токен успешно установлен и проверен!');
                    } else {
                        vscode.window.showWarningMessage('⚠️ API токен установлен, но не прошел проверку. Убедитесь, что токен правильный.');
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Ошибка при сохранении токена: ${error}`);
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
        message += `📊 Всего времени: ${hours} ч ${minutes} мин\n`;
        message += `💻 Текущая сессия: ${Math.floor(sessionSeconds / 60)} мин\n`;
        
        if (unsynced > 0) {
            message += `⏳ Ожидает синхронизации: ${unsynced} записей`;
        } else {
            message += `✅ Всё синхронизировано`;
        }
        
        vscode.window.showInformationMessage(message);
    });

    const forceSyncCommand = vscode.commands.registerCommand('analogWakaTime.forceSync', async () => {
        const currentConfig = vscode.workspace.getConfiguration('analogWakaTime');
        const currentToken = currentConfig.get<string>('apiToken', '');
        
        if (!currentToken) {
            vscode.window.showWarningMessage('Сначала настройте API токен');
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
            vscode.window.showInformationMessage('✅ Нет данных для синхронизации');
            return;
        }

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Синхронизация...',
                cancellable: false
            }, async () => {
                await apiClient!.syncActivities(unsyncedActivities);
                localDb!.markAsSynced(unsyncedActivities);
            });
            
            vscode.window.showInformationMessage(`✅ Синхронизировано ${unsyncedActivities.length} записей`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`❌ Ошибка синхронизации: ${error.message || error}`);
        }
    });

    context.subscriptions.push(setApiTokenCommand, showStatsCommand, forceSyncCommand);

    saveInterval = setInterval(() => {
        const stats = activityTracker?.getStats();
        if (stats && Object.keys(stats.activeFiles).length > 0 && localDb) {
            const hasActivity = stats.totalTimeSpent > 0 || stats.totalKeystrokes > 0;
            
            if (hasActivity) {
                console.log(`[Analog WakaTime] Сохранение: ${Math.floor(stats.totalTimeSpent / 1000)} сек, ${stats.totalKeystrokes} нажатий`);
                localDb.saveActivity(stats);
                activityTracker?.resetStats();
            }
        }
    }, SAVE_INTERVAL_MS);
    
    statusUpdateInterval = setInterval(() => {
        if (statusBar && activityTracker) {
            const sessionTime = activityTracker.getSessionTime();
            statusBar.updateWithSession(sessionTime);
        }
    }, STATUS_UPDATE_INTERVAL_MS);

    syncInterval = setInterval(async () => {
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
            console.log(`[Analog WakaTime] Синхронизация ${unsyncedActivities.length} записей...`);
            await apiClient.syncActivities(unsyncedActivities);
            localDb.markAsSynced(unsyncedActivities);
            console.log(`[Analog WakaTime] Синхронизация завершена`);
        } catch (error: any) {
            console.error('[Analog WakaTime] Ошибка синхронизации:', error);
        }
    }, SYNC_INTERVAL_MS);

    context.subscriptions.push({
        dispose: async () => {
            console.log('[Analog WakaTime] Деактивация плагина...');
            
            if (saveInterval) {
                clearInterval(saveInterval);
            }
            if (syncInterval) {
                clearInterval(syncInterval);
            }
            if (statusUpdateInterval) {
                clearInterval(statusUpdateInterval);
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
                        console.log(`[Analog WakaTime] Финальная синхронизация: ${unsyncedActivities.length} записей`);
                        await apiClient.syncActivities(unsyncedActivities);
                        localDb.markAsSynced(unsyncedActivities);
                        console.log(`[Analog WakaTime] Финальная синхронизация завершена`);
                    } catch (error: any) {
                        console.error('[Analog WakaTime] Ошибка финальной синхронизации:', error);
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
    
    console.log('[Analog WakaTime] Плагин активирован');
}

export function deactivate() {
    console.log('[Analog WakaTime] Деактивация...');
    
    if (saveInterval) {
        clearInterval(saveInterval);
    }
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
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
                    console.error('[Analog WakaTime] Ошибка финальной синхронизации:', error);
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
