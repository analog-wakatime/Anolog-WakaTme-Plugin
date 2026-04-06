import * as path from 'path';
import * as vscode from 'vscode';

export interface ProjectContext {
    path?: string;
    projectName?: string;
}

export function resolveProjectContext(filePath: string): ProjectContext {
    const fileUri = vscode.Uri.file(filePath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);

    if (workspaceFolder) {
        const workspacePath = workspaceFolder.uri.fsPath;
        return {
            path: workspacePath,
            projectName: workspaceFolder.name || path.basename(workspacePath)
        };
    }

    const directoryPath = path.dirname(filePath);
    const normalizedPath = directoryPath && directoryPath !== '.' ? directoryPath : filePath;

    return {
        path: normalizedPath,
        projectName: path.basename(normalizedPath)
    };
}