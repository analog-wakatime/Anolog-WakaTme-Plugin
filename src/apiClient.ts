import { ActivityStats, FileActivity } from './activityTracker';

interface ActivityRequest {
    language: string;
    lines: number;
    time: number; 
    date?: string; 
    hour?: number; 
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

    private groupActivityByLanguageAndHour(stats: ActivityStats): Map<string, Map<string, Map<number, ActivityRequest>>> {
        const grouped = new Map<string, Map<string, Map<number, ActivityRequest>>>();

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

            if (!grouped.has(language)) {
                grouped.set(language, new Map());
            }

            const dateMap = grouped.get(language)!;
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, new Map());
            }

            const hourMap = dateMap.get(dateStr)!;
            if (!hourMap.has(hour)) {
                hourMap.set(hour, {
                    language,
                    lines: 0,
                    time: 0,
                    date: dateStr,
                    hour
                });
            }

            const activity = hourMap.get(hour)!;
            activity.lines += netLines;
            activity.time += timeSpentSeconds;
        }

        return grouped;
    }

    public async sendActivity(stats: ActivityStats): Promise<void> {
        if (!this.apiToken) {
            throw new Error('API token is not set. Please configure the token in the plugin settings.');
        }

        const grouped = this.groupActivityByLanguageAndHour(stats);
        
        if (grouped.size === 0) {
            console.log('No activity to send');
            return;
        }

        const url = `${this.backendUrl}/api/activity`;
        const headers: { [key: string]: string } = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiToken}`
        };

        const requests: Promise<void>[] = [];
        
        for (const [language, dateMap] of grouped.entries()) {
            for (const [dateStr, hourMap] of dateMap.entries()) {
                for (const [hour, activity] of hourMap.entries()) {
                    requests.push(
                        fetch(url, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(activity)
                        }).then(async (response) => {
                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                            }
                        })
                    );
                }
            }
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
                time: 0
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

    public async syncActivities(activities: Array<{ language: string; lines: number; time: number; date: string; hour: number }>): Promise<void> {
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


