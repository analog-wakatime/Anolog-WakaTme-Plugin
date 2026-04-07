import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { AuthManager } from '../src/authManager';

const { configGetMock } = vi.hoisted(() => ({
    configGetMock: vi.fn()
}));

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: () => ({
            get: configGetMock
        })
    }
}));

describe('AuthManager#getToken', () => {
    beforeEach(() => {
        configGetMock.mockReset();
    });

    it('prefers token from global state', () => {
        const context = {
            globalState: {
                get: vi.fn().mockReturnValue('state-token'),
                update: vi.fn()
            }
        } as unknown as vscode.ExtensionContext;

        const manager = new AuthManager(context);
        expect(manager.getToken()).toBe('state-token');
    });

    it('returns empty token when no global token is stored', () => {
        configGetMock.mockReturnValue('config-token');

        const context = {
            globalState: {
                get: vi.fn().mockReturnValue(''),
                update: vi.fn()
            }
        } as unknown as vscode.ExtensionContext;

        const manager = new AuthManager(context);
        expect(manager.getToken()).toBe('');
    });
});