import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/apiClient';

const { getWorkspaceFolderMock } = vi.hoisted(() => ({
    getWorkspaceFolderMock: vi.fn()
}));

vi.mock('vscode', () => ({
    env: {
        appName: 'VS Code'
    },
    Uri: {
        file: (fsPath: string) => ({ fsPath })
    },
    workspace: {
        getWorkspaceFolder: getWorkspaceFolderMock
    }
}));

describe('ApiClient', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        getWorkspaceFolderMock.mockReset();
    });

    it('uses root endpoint for ping', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);

        const client = new ApiClient('https://testingmyproject.space', 'token');
        await expect(client.ping()).resolves.toBe(true);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://testingmyproject.space/',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('throws when sending activity without token', async () => {
        const client = new ApiClient('https://testingmyproject.space', '');
        await expect(client.sendActivity({
            sessionStart: Date.now(),
            sessionEnd: Date.now(),
            activeFiles: {},
            totalTimeSpent: 0,
            totalKeystrokes: 0
        })).rejects.toThrow('API token is not set. Please configure the token in the plugin settings.');
    });

    it('sends grouped activity to /api/activity with bearer token', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true
        });
        vi.stubGlobal('fetch', fetchMock);
        getWorkspaceFolderMock.mockReturnValue({
            uri: { fsPath: '/workspace/project' },
            name: 'project'
        });

        const client = new ApiClient('https://testingmyproject.space', 'token-123');
        await client.sendActivity({
            totalTimeSpent: 1500,
            totalKeystrokes: 12,
            activeFiles: {
                '/workspace/project/src/index.ts': {
                    filePath: '/workspace/project/src/index.ts',
                    language: 'typescript',
                    linesAdded: 5,
                    linesDeleted: 1,
                    timeSpent: 1500,
                    keystrokes: 12,
                    firstActive: Date.now() - 1000,
                    lastActive: Date.now()
                }
            },
            sessionStart: Date.now() - 1500,
            sessionEnd: Date.now()
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://testingmyproject.space/api/activity');
        expect(options.headers.Authorization).toBe('Bearer token-123');
    });

    it('syncs queued activities via /api/activity/sync', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ saved: 1, grouped: 1 })
        });
        vi.stubGlobal('fetch', fetchMock);

        const client = new ApiClient('https://testingmyproject.space', 'token-123');
        await client.syncActivities([{
            language: 'typescript',
            lines: 1,
            time: 60,
            date: '2026-04-07',
            hour: 12
        }]);

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://testingmyproject.space/api/activity/sync');
        expect(options.headers.Authorization).toBe('Bearer token-123');
    });
});
