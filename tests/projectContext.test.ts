import { describe, expect, it, vi } from 'vitest';

const { getWorkspaceFolderMock } = vi.hoisted(() => ({
    getWorkspaceFolderMock: vi.fn()
}));

vi.mock('vscode', () => ({
    Uri: {
        file: (fsPath: string) => ({ fsPath })
    },
    workspace: {
        getWorkspaceFolder: getWorkspaceFolderMock
    }
}));

import { resolveProjectContext } from '../src/projectContext';

describe('resolveProjectContext', () => {
    it('returns workspace path and name when file is in workspace', () => {
        getWorkspaceFolderMock.mockReturnValueOnce({
            uri: { fsPath: '/home/pabla/Music/analog-wakatime-plugin' },
            name: 'analog-wakatime-plugin'
        });

        const result = resolveProjectContext('/home/pabla/Music/analog-wakatime-plugin/src/apiClient.ts');

        expect(result).toEqual({
            path: '/home/pabla/Music/analog-wakatime-plugin',
            projectName: 'analog-wakatime-plugin'
        });
    });

    it('falls back to file directory when workspace folder is unavailable', () => {
        getWorkspaceFolderMock.mockReturnValueOnce(undefined);

        const result = resolveProjectContext('/tmp/scratch/index.ts');

        expect(result).toEqual({
            path: '/tmp/scratch',
            projectName: 'scratch'
        });
    });
});