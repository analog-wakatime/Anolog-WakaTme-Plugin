"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const authManager_1 = require("../src/authManager");
const { configGetMock } = vitest_1.vi.hoisted(() => ({
    configGetMock: vitest_1.vi.fn()
}));
vitest_1.vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: () => ({
            get: configGetMock
        })
    }
}));
(0, vitest_1.describe)('AuthManager#getToken', () => {
    (0, vitest_1.beforeEach)(() => {
        configGetMock.mockReset();
    });
    (0, vitest_1.it)('prefers token from global state', () => {
        const context = {
            globalState: {
                get: vitest_1.vi.fn().mockReturnValue('state-token'),
                update: vitest_1.vi.fn()
            }
        };
        const manager = new authManager_1.AuthManager(context);
        (0, vitest_1.expect)(manager.getToken()).toBe('state-token');
    });
    (0, vitest_1.it)('returns empty token when no global token is stored', () => {
        configGetMock.mockReturnValue('config-token');
        const context = {
            globalState: {
                get: vitest_1.vi.fn().mockReturnValue(''),
                update: vitest_1.vi.fn()
            }
        };
        const manager = new authManager_1.AuthManager(context);
        (0, vitest_1.expect)(manager.getToken()).toBe('');
    });
});
//# sourceMappingURL=authManager.test.js.map