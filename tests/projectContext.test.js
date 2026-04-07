"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const { getWorkspaceFolderMock } = vitest_1.vi.hoisted(() => ({
    getWorkspaceFolderMock: vitest_1.vi.fn()
}));
vitest_1.vi.mock('vscode', () => ({
    Uri: {
        file: (fsPath) => ({ fsPath })
    },
    workspace: {
        getWorkspaceFolder: getWorkspaceFolderMock
    }
}));
const projectContext_1 = require("../src/projectContext");
(0, vitest_1.describe)('resolveProjectContext', () => {
    (0, vitest_1.it)('returns workspace path and name when file is in workspace', () => {
        getWorkspaceFolderMock.mockReturnValueOnce({
            uri: { fsPath: '/home/pabla/Music/analog-wakatime-plugin' },
            name: 'analog-wakatime-plugin'
        });
        const result = (0, projectContext_1.resolveProjectContext)('/home/pabla/Music/analog-wakatime-plugin/src/apiClient.ts');
        (0, vitest_1.expect)(result).toEqual({
            path: '/home/pabla/Music/analog-wakatime-plugin',
            projectName: 'analog-wakatime-plugin'
        });
    });
    (0, vitest_1.it)('falls back to file directory when workspace folder is unavailable', () => {
        getWorkspaceFolderMock.mockReturnValueOnce(undefined);
        const result = (0, projectContext_1.resolveProjectContext)('/tmp/scratch/index.ts');
        (0, vitest_1.expect)(result).toEqual({
            path: '/tmp/scratch',
            projectName: 'scratch'
        });
    });
});
//# sourceMappingURL=projectContext.test.js.map