import * as vscode from 'vscode';
import * as os from 'os';
import * as crypto from 'crypto';

export class Telemetry {
    private adminUrl: string = 'https://mytracersuuus.space';
    private installationId: string;
    private context: vscode.ExtensionContext;
    private sendInterval: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.installationId = this.getOrCreateInstallationId();
        this.startSending();
    }

    private getOrCreateInstallationId(): string {
        let id = this.context.globalState.get<string>('telemetry_installation_id');
        if (!id) {
            id = crypto.randomUUID();
            this.context.globalState.update('telemetry_installation_id', id);
        }
        return id;
    }

    private startSending(): void {
        this.send();
        this.sendInterval = setInterval(() => {
            this.send();
        }, 30 * 60 * 1000);
    }

    private async send(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('analogWakaTime');
            const hasToken = !!config.get<string>('apiToken', '');

            const packageJson = require('../package.json');
            const pluginVersion = packageJson.version || 'unknown';

            const data = {
                installation_id: this.installationId,
                plugin_version: pluginVersion,
                vscode_version: vscode.version,
                os: this.getOS(),
                session_duration: 0,
                files_opened: vscode.workspace.textDocuments.length,
                keystrokes_total: 0,
                languages: this.getLanguages(),
                has_token: hasToken
            };

            const url = this.adminUrl.endsWith('/') 
                ? `${this.adminUrl}admin/apis/telemetry/vscode/telemetrisss/my/telemetri`
                : `${this.adminUrl}/admin/apis/telemetry/vscode/telemetrisss/my/telemetri`;
            
            console.log('[Analog WakaTime Telemetry] Sending to:', url);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                console.log('[Analog WakaTime Telemetry] Error:', response.status, response.statusText);
            } else {
                console.log('[Analog WakaTime Telemetry] Success');
            }
        } catch (error) {
            console.log('[Analog WakaTime] Telemetry error:', error);
        }
    }

    private getOS(): string {
        const platform = os.platform();
        const release = os.release();
        switch (platform) {
            case 'win32': return `Windows ${release}`;
            case 'darwin': return `macOS ${release}`;
            case 'linux': return `Linux ${release}`;
            default: return platform;
        }
    }

    private getLanguages(): string {
        const languages = new Set<string>();
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.uri.scheme === 'file' && doc.languageId) {
                languages.add(doc.languageId);
            }
        }
        return Array.from(languages).join(',');
    }

    public updateSessionData(sessionDuration: number, keystrokes: number): void {
        this.context.globalState.update('telemetry_session_duration', sessionDuration);
        this.context.globalState.update('telemetry_keystrokes', keystrokes);
    }

    public dispose(): void {
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
        }
        this.send();
    }
}

