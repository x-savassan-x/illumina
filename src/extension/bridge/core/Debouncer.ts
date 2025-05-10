import { workspace, Disposable } from "vscode";
import { ConfigSection, getConfigValue, handleConfigChanges } from "@ext/config";

export class Debouncer {
    private readonly _disposable: Disposable;
    private _timeoutId: NodeJS.Timeout | undefined;
    private _timeoutTask: (() => void) | undefined;
    private _interval = getConfigValue<number>(ConfigSection.DebounceInterval);

    public constructor() {
        this._disposable = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [[ConfigSection.DebounceInterval], (): void => {
                this._clear();
                this._timeoutTask?.();
                this._interval = getConfigValue<number>(ConfigSection.DebounceInterval);
            }]
        ]));
    }

    public schedule(task: () => void): void {
        this._clear();
        this._timeoutTask = task;
        this._timeoutId = setTimeout(() => {
            this._timeoutId = undefined;
            task();
        }, this._interval);
    }

    public dispose(): void {
        this._disposable.dispose();
        this._clear();
    }

    private _clear(): void {
        clearTimeout(this._timeoutId);
        this._timeoutId = undefined;
    }
}
