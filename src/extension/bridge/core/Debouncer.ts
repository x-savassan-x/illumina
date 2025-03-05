import { workspace, Disposable } from "vscode";
import { ConfigSection, getConfigValue, handleConfigChanges } from "@ext/config";

export class Debouncer {
    private readonly _disposable: Disposable;
    private _timeoutId?: NodeJS.Timeout | undefined;
    private _interval: number;

    public constructor() {
        this._interval = getConfigValue<number>(ConfigSection.DebounceInterval);
        this._disposable = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [[ConfigSection.DebounceInterval], (): void => {
                this._clear();
                this._interval = getConfigValue<number>(ConfigSection.DebounceInterval);
            }]
        ]));
    }

    public schedule(task: () => void): void {
        this._clear();
        this._timeoutId = setTimeout(() => {
            task();
            this._timeoutId = undefined;
        }, this._interval);
    }

    public dispose(): void {
        this._disposable.dispose();
        this._clear();
    }

    private _clear(): void {
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = undefined;
        }
    }
}
