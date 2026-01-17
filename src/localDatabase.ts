import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ActivityStats, FileActivity } from './activityTracker';

interface StoredActivity {
    language: string;
    lines: number;
    time: number; 
    date: string; 
    hour: number; 
    synced: boolean; 
    timestamp: number; 
}

export class LocalDatabase {
    private dbPath: string;
    private activities: StoredActivity[] = [];

    constructor(context: vscode.ExtensionContext) {
        const storageUri = context.globalStorageUri;
        this.dbPath = path.join(storageUri.fsPath, 'analog-wakatime-db.json');
        this.loadDatabase();
    }

    private loadDatabase(): void {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf8');
                this.activities = JSON.parse(data);
            } else {
                this.activities = [];
            }
        } catch (error) {
            console.error('Ошибка загрузки локальной БД:', error);
            this.activities = [];
        }
    }

    private saveDatabase(): void {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, JSON.stringify(this.activities, null, 2), 'utf8');
        } catch (error) {
            console.error('Ошибка сохранения локальной БД:', error);
        }
    }

    public saveActivity(stats: ActivityStats): void {
        const now = Date.now();

        for (const [filePath, fileActivity] of Object.entries(stats.activeFiles)) {
            const language = fileActivity.language || 'unknown';
            const timeSpentSeconds = Math.floor(fileActivity.timeSpent / 1000);
            
            if (timeSpentSeconds <= 0 && fileActivity.linesAdded === 0 && fileActivity.linesDeleted === 0) {
                continue;
            }

            const netLines = fileActivity.linesAdded - fileActivity.linesDeleted;
            
            const startTime = fileActivity.firstActive;
            const endTime = fileActivity.lastActive;
            const midTime = (startTime + endTime) / 2;
            const activityDate = new Date(midTime);
            const dateStr = activityDate.toISOString().split('T')[0];
            const hour = activityDate.getHours();

            if (timeSpentSeconds > 0 || netLines !== 0) {
                this.activities.push({
                    language,
                    lines: Math.max(0, netLines), 
                    time: timeSpentSeconds,
                    date: dateStr,
                    hour,
                    synced: false,
                    timestamp: now
                });
            }
        }

        this.saveDatabase();
    }

    public getUnsyncedActivities(): StoredActivity[] {
        return this.activities.filter(activity => !activity.synced);
    }

    public markAsSynced(activities: StoredActivity[]): void {
        const syncedTimestamps = new Set(activities.map(a => a.timestamp));
        
        for (const activity of this.activities) {
            if (syncedTimestamps.has(activity.timestamp)) {
                activity.synced = true;
            }
        }

        this.saveDatabase();
    }

    public getTotalTime(): number {
        return this.activities.reduce((total, activity) => total + activity.time, 0);
    }

    public cleanupOldRecords(): void {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        this.activities = this.activities.filter(activity => {
            return !activity.synced || activity.timestamp > thirtyDaysAgo;
        });
        this.saveDatabase();
    }

    public getUnsyncedCount(): number {
        return this.activities.filter(a => !a.synced).length;
    }
}

