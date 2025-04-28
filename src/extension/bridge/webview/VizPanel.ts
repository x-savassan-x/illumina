import { window, WebviewPanel, Disposable, Uri, ViewColumn } from "vscode";
import { readFileSync } from "fs";
import { CacheManager, StaticVizEngine } from "@ext/bridge";
import { LogLevel, LogData, Message } from "@shared/index";
import { Logger } from "@ext/Logger";


export class VizPanel {
    private static _currentPanel: VizPanel | undefined;
    private readonly _panel: WebviewPanel;
    private readonly _vizEngine = StaticVizEngine.instance;
    private readonly _disposable: Disposable;

    private constructor(panel: WebviewPanel, extensionUri: Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent(extensionUri);

        this._disposable = Disposable.from(
            this._panel.onDidDispose(async () => await this._dispose()),
            this._vizEngine.updateEmitter.event(() => this._updateUI()),
            this._panel.webview.onDidReceiveMessage(message => this._handleMessage(message))
        );
    }

    public static show(extensionUri: Uri): void {
        const column = ViewColumn.Beside;

        if (this._currentPanel) {
            this._currentPanel._panel.reveal(column);
            return;
        }

        const panel = window.createWebviewPanel('illumina', 'Illumina', column, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });

        this._currentPanel = new VizPanel(panel, extensionUri);
    }

    public static dispose(): void {
        this._currentPanel?._panel.dispose();
    }

    private _getWebviewContent(extensionUri: Uri): string {
        const distUri = Uri.joinPath(extensionUri, 'dist', 'webview');

        const indexUri = Uri.joinPath(distUri, 'index.html');
        const content = readFileSync(indexUri.fsPath, 'utf-8');

        return content.replace(
            /(src|href)="([^"]*)"/g,
            (_, attr, path) => {
                const uri = Uri.joinPath(distUri, path);
                return `${attr}="${this._panel.webview.asWebviewUri(uri)}"`;
            }
        );
    }

    private async _dispose(): Promise<void> {
        this._disposable.dispose();
        VizPanel._currentPanel = undefined;
        await this._vizEngine.deactivate();
    }

    private _updateUI(): void {
        this._panel.webview.postMessage({
            command: 'update',
            data: CacheManager.instance.cacheRoot.metricNode
        });
    }

    private _handleMessage(message: Message): void {
        switch (message.command) {
            case 'ready': this._updateUI(); break;
            case 'log': {
                const data = message.data as { level: LogLevel, content: string, metadata?: LogData };
                const source = 'Webview';
                switch (data.level) {
                    case LogLevel.Debug: Logger.debug(data.content, source, data.metadata); break;
                    case LogLevel.Info: Logger.info(data.content, source, data.metadata); break;
                    case LogLevel.Warn: Logger.warn(data.content, source, data.metadata); break;
                    case LogLevel.Error: Logger.error(data.content, source, data.metadata); break;
                }
                break;
            }
            default: Logger.error(`Unknown message command: ${message.command}`);
        }
    }
}
