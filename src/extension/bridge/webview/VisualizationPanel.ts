import vscode from "vscode";
import fs from "fs";


export class VisualizationPanel {
    public static currentPanel: VisualizationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
        this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (VisualizationPanel.currentPanel) {
            VisualizationPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'illumina',
            'Illumina',
            column ?? vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        VisualizationPanel.currentPanel = new VisualizationPanel(panel, extensionUri);
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const distUri = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
        const indexUri = vscode.Uri.joinPath(distUri, 'index.html');

        const content = fs.readFileSync(indexUri.fsPath, 'utf-8');

        return content.replace(
            /(src|href)="([^"]*)"/g,
            (_, attr, path) => `${attr}="${webview.asWebviewUri(vscode.Uri.joinPath(distUri, path))}"`
        );
    }

    private _dispose(): void {
        VisualizationPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
}
