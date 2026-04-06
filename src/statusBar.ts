import * as vscode from 'vscode';
import { LocalDatabase } from './localDatabase';

export class StatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private localDb: LocalDatabase;
    private currentSessionTime: number = 0;
    private isAuthenticated: boolean = false;
    private isOnline: boolean = true;

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

    public setAuthenticated(isAuthenticated: boolean): void {
        this.isAuthenticated = isAuthenticated;
        this.update();
    }

    public setOnline(isOnline: boolean): void {
        this.isOnline = isOnline;
        this.update();
    }

    private update(): void {
        if (!this.isAuthenticated) {
            this.statusBarItem.text = `$(lock) Need authentication`;
            this.statusBarItem.tooltip = `⏱️ Analog WakaTime\n\nPlease authenticate to track time.\nClick to login.`;
            return;
        }

        const savedSeconds = this.localDb.getTotalTime();
        const sessionSeconds = Math.floor(this.currentSessionTime / 1000);
        const totalSeconds = savedSeconds + sessionSeconds;

        const timeStr = this.formatTimeString(totalSeconds);

        const cloud = this.isOnline ? '$(cloud-upload)' : '$(cloud-off)';
        this.statusBarItem.text = `${cloud} $(clock) ${timeStr}`;
        this.statusBarItem.tooltip = this.createTooltip(totalSeconds, sessionSeconds, savedSeconds);
    }

    private formatTimeString(totalSeconds: number): string {
        if (totalSeconds < 60) {
            return `${totalSeconds} sec`;
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} h ${minutes} min`;
        }
        return `${minutes} min`;
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

        tooltip += this.isOnline ? `\n🌐 Online` : `\n📴 Offline (saving locally)`;
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