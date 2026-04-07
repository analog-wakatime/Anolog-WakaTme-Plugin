import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { AuthManager } from '../src/authManager';

const {
    configUpdateMock,
    openExternalMock
} = vi.hoisted(() => ({
    configUpdateMock: vi.fn(),
    openExternalMock: vi.fn()
}));

vi.mock('vscode', () => ({
    ConfigurationTarget: {
        Global: 1
    },
    Uri: {
        parse: (value: string) => ({ value })
    },
    env: {
        openExternal: openExternalMock
    },
    workspace: {
        getConfiguration: () => ({
            update: configUpdateMock
        })
    }
}));

describe('AuthManager', () => {
    const globalStateGet = vi.fn();
    const globalStateUpdate = vi.fn();

    const context = {
        globalState: {
            get: globalStateGet,
            update: globalStateUpdate
        }
    } as unknown as vscode.ExtensionContext;

    beforeEach(() => {
        configUpdateMock.mockReset();
        openExternalMock.mockReset();
        globalStateGet.mockReset();
        globalStateUpdate.mockReset();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('prefers token from global state', () => {
        globalStateGet.mockReturnValue('state-token');

        const manager = new AuthManager(context);
        expect(manager.getToken()).toBe('state-token');
    });

    it('returns empty token when no global token is stored', () => {
        globalStateGet.mockReturnValue('');

        const manager = new AuthManager(context);
        expect(manager.getToken()).toBe('');
    });

    it('returns auth state from token presence', () => {
        const manager = new AuthManager(context);

        globalStateGet.mockReturnValueOnce('token');
        expect(manager.isAuthenticated()).toBe(true);

        globalStateGet.mockReturnValueOnce(undefined);
        expect(manager.isAuthenticated()).toBe(false);
    });

    it('saves token in global state and config', async () => {
        const manager = new AuthManager(context);
        await manager.saveToken('new-token');

        expect(globalStateUpdate).toHaveBeenCalledWith('auth_token', 'new-token');
        expect(configUpdateMock).toHaveBeenCalledWith('apiToken', 'new-token', 1);
    });

    it('clears token and resets config on logout', async () => {
        const manager = new AuthManager(context);
        await manager.logout();

        expect(globalStateUpdate).toHaveBeenCalledWith('auth_token', undefined);
        expect(configUpdateMock).toHaveBeenCalledWith('apiToken', '', 1);
    });

    it('opens browser for auth URL', () => {
        const manager = new AuthManager(context);
        manager.openBrowserForAuth('https://example.com/verify');

        expect(openExternalMock).toHaveBeenCalledTimes(1);
    });

    it('maps successful device flow response', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                device_code: 'dev',
                user_code: 'usr',
                verification_url: 'https://example.com',
                expires_in: 300,
                interval: 5
            })
        });
        vi.stubGlobal('fetch', fetchMock);

        const manager = new AuthManager(context);
        await expect(manager.startDeviceFlow()).resolves.toEqual({
            deviceCode: 'dev',
            userCode: 'usr',
            verificationUrl: 'https://example.com',
            expiresIn: 300,
            interval: 5
        });
    });

    it('throws on failed device flow init', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            text: vi.fn().mockResolvedValue('bad request')
        });
        vi.stubGlobal('fetch', fetchMock);

        const manager = new AuthManager(context);
        await expect(manager.startDeviceFlow()).rejects.toThrow('Failed to init device flow: bad request');
    });

    it('resolves with token when polling is authorized', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue({
            status: 200,
            json: vi.fn().mockResolvedValue({
                status: 'authorized',
                token: 'poll-token'
            })
        });
        vi.stubGlobal('fetch', fetchMock);

        const manager = new AuthManager(context);
        await expect(manager.pollForToken('device-code', 1, 30)).resolves.toBe('poll-token');
    });

    it('rejects when polling expires', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue({
            status: 202
        });
        vi.stubGlobal('fetch', fetchMock);

        const manager = new AuthManager(context);
        const polling = manager.pollForToken('device-code', 1, 1);
        const assertion = expect(polling).rejects.toThrow('Authorization timed out. Please try again.');

        await vi.advanceTimersByTimeAsync(2200);
        await assertion;
    });
});