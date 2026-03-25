import * as vscode from 'vscode';

interface DeviceFlowResult {
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}

export class AuthManager {
    private backendUrl: string = 'https://testingmyproject.space';
    private context: vscode.ExtensionContext;
    private pollingInterval: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public getToken(): string | undefined {
        return this.context.globalState.get<string>('auth_token');
    }
    public isAuthenticated(): boolean {
        return !!this.getToken();
    }

    public async startDeviceFlow(): Promise<DeviceFlowResult> {
        const url = `${this.backendUrl}/api/auth/device/init`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to init device flow: ${error}`);
        }

        const data = await response.json() as {
            device_code: string;
            user_code: string;
            verification_url: string;
            expires_in: number;
            interval: number;
        };

        return {
            deviceCode: data.device_code,
            userCode: data.user_code,
            verificationUrl: data.verification_url,
            expiresIn: data.expires_in,
            interval: data.interval
        };
    }

    public openBrowserForAuth(verificationUrl: string): void {
        vscode.env.openExternal(vscode.Uri.parse(verificationUrl));
    }

    public async pollForToken(deviceCode: string, interval: number, expiresIn: number): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const url = `${this.backendUrl}/api/auth/device/poll?device_code=${deviceCode}`;
            const startTime = Date.now();
            const expiresAt = startTime + (expiresIn * 1000);

            const poll = async () => {
                try {
                    if (Date.now() > expiresAt) {
                        this.stopPolling();
                        reject(new Error('Authorization timed out. Please try again.'));
                        return;
                    }

                    const response = await fetch(url);

                    if (response.status === 200) {
                        const data = await response.json() as { status: string; token?: string };
                        if (data.status === 'authorized' && data.token) {
                            this.stopPolling();
                            resolve(data.token);
                            return;
                        }
                    } else if (response.status === 202) {
                        console.log('[Analog WakaTime] Waiting for authorization...');
                    } else if (response.status === 404 || response.status === 410) {
                        this.stopPolling();
                        reject(new Error('Authorization expired or invalid. Please try again.'));
                        return;
                    }
                } catch (error) {
                    console.error('[Analog WakaTime] Polling error:', error);
                }
            };

            poll();
            this.pollingInterval = setInterval(poll, interval * 1000);
        });
    }

    private stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    public async saveToken(token: string): Promise<void> {
        await this.context.globalState.update('auth_token', token);

        const config = vscode.workspace.getConfiguration('analogWakaTime');
        await config.update('apiToken', token, vscode.ConfigurationTarget.Global);
    }

    public async logout(): Promise<void> {
        this.stopPolling();
        await this.context.globalState.update('auth_token', undefined);

        const config = vscode.workspace.getConfiguration('analogWakaTime');
        await config.update('apiToken', '', vscode.ConfigurationTarget.Global);
    }

    public async login(): Promise<boolean> {
        try {
            const deviceFlow = await this.startDeviceFlow();
            const result = await vscode.window.showInformationMessage(
                `🔐 Analog WakaTime: Authorization\n\nCode: ${deviceFlow.userCode}\n\nOpen browser to complete authorization.`,
                'Open Browser',
                'Cancel'
            );

            if (result !== 'Open Browser') {
                return false;
            }

            this.openBrowserForAuth(deviceFlow.verificationUrl);

            const token = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analog WakaTime: Waiting for authorization...',
                cancellable: true
            }, async (progress, cancellationToken) => {
                cancellationToken.onCancellationRequested(() => {
                    this.stopPolling();
                });

                try {
                    return await this.pollForToken(
                        deviceFlow.deviceCode,
                        deviceFlow.interval,
                        deviceFlow.expiresIn
                    );
                } catch (error) {
                    return null;
                }
            });

            if (token) {
                await this.saveToken(token);
                vscode.window.showInformationMessage('✅ Analog WakaTime: Authorization successful!');
                return true;
            } else {
                vscode.window.showWarningMessage('⚠️ Analog WakaTime: Authorization cancelled or expired.');
                return false;
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`❌ Analog WakaTime: Authorization error: ${error.message}`);
            return false;
        }
    }

    public dispose(): void {
        this.stopPolling();
    }
}
