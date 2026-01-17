import * as vscode from 'vscode';

export interface FileActivity {
    filePath: string;
    language: string;
    keystrokes: number;
    linesAdded: number;
    linesDeleted: number;
    timeSpent: number; 
    firstActive: number; 
    lastActive: number; 
}

export interface ActivityStats {
    sessionStart: number;
    sessionEnd: number;
    activeFiles: { [filePath: string]: FileActivity };
    totalKeystrokes: number;
    totalTimeSpent: number;
}

export class ActivityTracker {
    private activeFiles: Map<string, FileActivity> = new Map();
    private sessionStart: number = Date.now();
    private totalKeystrokes: number = 0;
    private currentActiveFile: string | null = null;
    private timeUpdateInterval: NodeJS.Timeout | null = null;
    private lastTickTime: number = Date.now();
    private isUserActive: boolean = false;
    private lastActivityTime: number = Date.now();
    
    private readonly INACTIVITY_THRESHOLD = 120000;
    private readonly TIME_UPDATE_INTERVAL = 1000;
    private readonly MAX_TIME_PER_TICK = 2000;
    private readonly MAX_TIME_PER_SAVE_INTERVAL = 35000;
    
    private disposables: vscode.Disposable[] = [];
    private intervalTimeAccumulated: number = 0;

    constructor() {
        this.setupEventListeners();
        this.startTimeTracking();
    }

    private startTimeTracking(): void {
        this.lastTickTime = Date.now();
        this.timeUpdateInterval = setInterval(() => {
            this.tickTime();
        }, this.TIME_UPDATE_INTERVAL);
    }
    
    private tickTime(): void {
        const now = Date.now();
        const timeSinceLastTick = now - this.lastTickTime;
        this.lastTickTime = now;
        
        if (!vscode.window.state.focused) {
            this.isUserActive = false;
            return;
        }
        
        if (!this.currentActiveFile) {
            this.isUserActive = false;
            return;
        }
        
        const timeSinceLastActivity = now - this.lastActivityTime;
        if (timeSinceLastActivity > this.INACTIVITY_THRESHOLD) {
            this.isUserActive = false;
            return;
        }
        
        const fileActivity = this.activeFiles.get(this.currentActiveFile);
        if (!fileActivity) {
            return;
        }
        
        const timeToAdd = Math.min(timeSinceLastTick, this.MAX_TIME_PER_TICK);
        
        if (this.intervalTimeAccumulated + timeToAdd > this.MAX_TIME_PER_SAVE_INTERVAL) {
            console.log(`[Analog WakaTime] Time limit reached for interval: ${this.intervalTimeAccumulated}ms`);
            return;
        }
        
        fileActivity.timeSpent += timeToAdd;
        fileActivity.lastActive = now;
        this.intervalTimeAccumulated += timeToAdd;
        this.isUserActive = true;
    }

    private setupEventListeners() {
        const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.uri.scheme === 'file') {
                this.trackFileOpen(document);
            }
        });

        const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.uri.scheme === 'file') {
                this.trackFileChange(event);
            }
        });

        const onDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument((document) => {
            if (document.uri.scheme === 'file') {
                this.trackFileClose(document);
            }
        });

        const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.uri.scheme === 'file') {
                this.setActiveFile(editor.document);
            } else {
                this.currentActiveFile = null;
            }
        });

        const onDidChangeWindowState = vscode.window.onDidChangeWindowState((state) => {
            if (state.focused) {
                this.lastActivityTime = Date.now();
                this.lastTickTime = Date.now();
            }
        });

        const onDidChangeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor.document.uri.scheme === 'file') {
                this.markActivity();
            }
        });

        const onDidChangeVisibleTextEditors = vscode.window.onDidChangeVisibleTextEditors(() => {
            this.markActivity();
        });

        this.disposables.push(
            onDidOpenTextDocument,
            onDidChangeTextDocument,
            onDidCloseTextDocument,
            onDidChangeActiveTextEditor,
            onDidChangeWindowState,
            onDidChangeTextEditorSelection,
            onDidChangeVisibleTextEditors
        );
    }

    private markActivity(): void {
        this.lastActivityTime = Date.now();
    }

    private trackFileOpen(document: vscode.TextDocument) {
        const filePath = document.uri.fsPath;
        const language = document.languageId;
        const now = Date.now();

        if (!this.activeFiles.has(filePath)) {
            this.activeFiles.set(filePath, {
                filePath,
                language,
                keystrokes: 0,
                linesAdded: 0,
                linesDeleted: 0,
                timeSpent: 0,
                firstActive: now,
                lastActive: now
            });
        }

        this.markActivity();
    }

    private trackFileChange(event: vscode.TextDocumentChangeEvent) {
        const document = event.document;
        const filePath = document.uri.fsPath;
        const now = Date.now();

        let fileActivity = this.activeFiles.get(filePath);
        if (!fileActivity) {
            this.trackFileOpen(document);
            fileActivity = this.activeFiles.get(filePath)!;
        }

        fileActivity.lastActive = now;
        this.markActivity();

        let linesAdded = 0;
        let linesDeleted = 0;
        let keystrokes = 0;

        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const newText = change.text;
            
            const deletedFullLines = endLine - startLine;
            if (deletedFullLines > 0) {
                linesDeleted += deletedFullLines;
            }

            const newLineCount = (newText.match(/\n/g) || []).length;
            if (newLineCount > 0) {
                linesAdded += newLineCount;
            }

            if (deletedFullLines > 0 && newLineCount > 0) {
                const replaced = Math.min(deletedFullLines, newLineCount);
                linesDeleted -= replaced;
                linesAdded -= replaced;
            }

            keystrokes += Math.max(newText.length, change.rangeLength);
        }

        fileActivity.keystrokes += keystrokes;
        fileActivity.linesAdded += linesAdded;
        fileActivity.linesDeleted += linesDeleted;
        this.totalKeystrokes += keystrokes;
    }

    private trackFileClose(document: vscode.TextDocument) {
        const filePath = document.uri.fsPath;
        const now = Date.now();

        const fileActivity = this.activeFiles.get(filePath);
        if (fileActivity) {
            fileActivity.lastActive = now;
        }
        
        if (this.currentActiveFile === filePath) {
            this.currentActiveFile = null;
        }
    }

    private setActiveFile(document: vscode.TextDocument) {
        const filePath = document.uri.fsPath;
        const now = Date.now();

        this.currentActiveFile = filePath;

        let fileActivity = this.activeFiles.get(filePath);
        if (!fileActivity) {
            this.trackFileOpen(document);
            fileActivity = this.activeFiles.get(filePath)!;
        }
        
        fileActivity.lastActive = now;
        this.markActivity();
    }

    public getStats(): ActivityStats {
        const now = Date.now();
        
        const activeFilesObj: { [filePath: string]: FileActivity } = {};
        let totalTimeSpent = 0;

        for (const [filePath, activity] of this.activeFiles.entries()) {
            activeFilesObj[filePath] = { ...activity };
            totalTimeSpent += activity.timeSpent;
        }

        return {
            sessionStart: this.sessionStart,
            sessionEnd: now,
            activeFiles: activeFilesObj,
            totalKeystrokes: this.totalKeystrokes,
            totalTimeSpent
        };
    }

    public resetStats() {
        const now = Date.now();
        
        for (const [filePath, activity] of this.activeFiles.entries()) {
            activity.timeSpent = 0;
            activity.keystrokes = 0;
            activity.linesAdded = 0;
            activity.linesDeleted = 0;
            activity.firstActive = now;
            activity.lastActive = now;
        }
        
        this.sessionStart = now;
        this.totalKeystrokes = 0;
        this.intervalTimeAccumulated = 0;
        this.lastTickTime = now;
    }

    public getSessionTime(): number {
        let totalTime = 0;
        for (const activity of this.activeFiles.values()) {
            totalTime += activity.timeSpent;
        }
        return totalTime;
    }

    public dispose() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
