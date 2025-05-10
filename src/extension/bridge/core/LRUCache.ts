import { workspace, Disposable } from "vscode";
import { LRUCache as Cache } from "lru-cache";
import { ConfigSection, getConfigValue, handleConfigChanges } from "@ext/config";


export class LRUCache<K extends {}, V extends {}> {
    public data = this._getNewCache();
    private readonly _disposable: Disposable;

    public constructor() {
        this._disposable = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [[ConfigSection.MaxCacheSize], (): void => {
                const cache = this._getNewCache();
                this.data.forEach((value, key) => cache.set(key, value));
                this.data = cache;
            }]
        ]));
    }

    public dispose(): void {
        this._disposable.dispose();
    }

    private _getNewCache(): Cache<K, V> {
        return new Cache<K, V>({
            max: getConfigValue<number>(ConfigSection.MaxCacheSize)
        });
    }
}
