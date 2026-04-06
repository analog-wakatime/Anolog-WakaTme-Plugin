import { ActivityStats } from './activityTracker';
import { resolveProjectContext } from './projectContext';

interface ActivityRequest {
    language: string;
    lines: number;
    time: number; 
    date?: string; 
    hour?: number; 
    path?: string;
    project_name?: string;
}

export class ApiClient {
    private backendUrl: string;
    private apiToken: string;

    constructor(backendUrl: string, apiToken: string) {
        this.backendUrl = backendUrl;
        this.apiToken = apiToken;
    }

    public updateConfig(backendUrl: string, apiToken: string) {
        this.backendUrl = backendUrl;
        this.apiToken = apiToken;
    }

    private groupActivityForUpload(stats: ActivityStats): ActivityRequest[] {
        const grouped = new Map<string, ActivityRequest>();

        for (const [filePath, fileActivity] of Object.entries(stats.activeFiles)) {
            const language = fileActivity.language || 'unknown';
            const timeSpentSeconds = Math.floor(fileActivity.timeSpent / 1000);
            
            if (timeSpentSeconds <= 0) {
                continue; 
            }

            const netLines = Math.max(0, fileActivity.linesAdded - fileActivity.linesDeleted);

            const startTime = fileActivity.firstActive;
            const endTime = fileActivity.lastActive;
            const midTime = (startTime + endTime) / 2;
            const activityDate = new Date(midTime);
            const dateStr = activityDate.toISOString().split('T')[0]; 
            const hour = activityDate.getHours();
            const projectContext = resolveProjectContext(filePath);
            const groupKey = [
                language,
                dateStr,
                hour,
                projectContext.path || '',
                projectContext.projectName || ''
            ].join('|');

            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, {
                    language,
                    lines: 0,
                    time: 0,
                    date: dateStr,
                    hour,
                    path: projectContext.path,
                    project_name: projectContext.projectName
                });
            }

            const activity = grouped.get(groupKey)!;
            activity.lines += netLines;
            activity.time += timeSpentSeconds;
        }

        return Array.from(grouped.values());
    }

    private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(id);
        }
    }

    public async ping(timeoutMs: number = 3000): Promise<boolean> {
        try {
            const url = `${this.backendUrl}/`;
            const response = await this.fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
            return response.ok;
        } catch {
            return false;
        }
    }

    public async sendActivity(stats: ActivityStats): Promise<void> {
        if (!this.apiToken) {
            throw new Error('API token is not set. Please configure the token in the plugin settings.');
        }

        const grouped = this.groupActivityForUpload(stats);
        
        if (grouped.length === 0) {
            console.log('No activity to send');
            return;
        }

        const url = `${this.backendUrl}/api/activity`;
        const headers: { [key: string]: string } = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiToken}`
        };

        const requests: Promise<void>[] = [];
        
        for (const activity of grouped) {
            requests.push(
                this.fetchWithTimeout(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(activity)
                }, 8000).then(async (response) => {
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }
                })
            );
        }

        try {
            await Promise.all(requests);
            console.log(`Statistics successfully sent to the backend (${requests.length} records)`);
        } catch (error) {
            console.error('Error sending statistics:', error);
            throw error;
        }
    }

    public async validateToken(): Promise<boolean> {
        if (!this.apiToken) {
            return false;
        }

        try {
            const url = `${this.backendUrl}/api/activity`;
            const testActivity = {
                language: 'test',
                lines: 0,
                time: 0,
                path: '/test-project',
                project_name: 'test-project'
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify(testActivity)
            });

            return response.status === 200 || response.status === 400;
        } catch (error) {
            console.error('Error checking token:', error);
            return false;
        }
    }

    public async syncActivities(activities: Array<{ language: string; lines: number; time: number; date: string; hour: number; path?: string; project_name?: string }>): Promise<void> {
        if (!this.apiToken) {
            throw new Error('API token is not set');
        }

        if (activities.length === 0) {
            return;
        }

        const url = `${this.backendUrl}/api/activity/sync`;
        const headers: { [key: string]: string } = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiToken}`
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ activities })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json() as { saved?: number; grouped?: number; message?: string };
        console.log(`Synchronized: ${result.saved || activities.length} activities (grouped into ${result.grouped || 0} records)`);
    }
}