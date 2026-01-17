import * as vscode from 'vscode';
import { LocalDatabase } from './localDatabase';

export class StatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private localDb: LocalDatabase;
    private currentSessionTime: number = 0;

    constructor(localDb: LocalDatabase) {
        this.localDb = localDb;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'analogWakaTime.showStats';
        
        this.update();
        this.statusBarItem.show();
    }

    public updateWithSession(sessionTimeMs: number): void {
        this.currentSessionTime = sessionTimeMs;
        this.update();
    }

    private update(): void {
        const savedSeconds = this.localDb.getTotalTime();
        const sessionSeconds = Math.floor(this.currentSessionTime / 1000);
        const totalSeconds = savedSeconds + sessionSeconds;
        
        const timeStr = this.formatTimeString(totalSeconds);
        
        this.statusBarItem.text = `$(clock) ${timeStr}`;
        this.statusBarItem.tooltip = this.createTooltip(totalSeconds, sessionSeconds, savedSeconds);
    }

    private formatTimeString(totalSeconds: number): string {
        if (totalSeconds < 60) {
            return `${totalSeconds} сек`;
        }
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours} ч ${minutes} мин`;
        }
        return `${minutes} мин`;
    }

    private createTooltip(totalSeconds: number, sessionSeconds: number, savedSeconds: number): string {
        const totalStr = this.formatDetailedTime(totalSeconds);
        const sessionStr = this.formatDetailedTime(sessionSeconds);
        const unsyncedCount = this.localDb.getUnsyncedCount();
        
        let tooltip = `⏱️ Analog WakaTime\n\n`;
        tooltip += `📊 Total: ${totalStr}\n`;
        tooltip += `💻 Current session: ${sessionStr}\n`;
        
        if (unsyncedCount > 0) {
            tooltip += `\n⏳ Waiting for synchronization: ${unsyncedCount} records`;
        } else {
            tooltip += `\n✅ Everything synchronized`;
        }
        
        tooltip += `\n\nClick for detailed statistics`;
        
        return tooltip;
    }

    private formatDetailedTime(totalSeconds: number): string {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours} h ${minutes} min`;
        }
        if (minutes > 0) {
            return `${minutes} min ${seconds} sec`;
        }
        return `${seconds} sec`;
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
