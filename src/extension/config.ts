import { workspace, ConfigurationChangeEvent } from "vscode";


export enum ConfigSection {
    SourceDirectory = 'sourceDirectory',
    SourceLanguage = 'sourceLanguage',
    MaxCacheSize = 'maxCacheSize',
    DelayMode = 'delayMode',
    DelayTime = 'delayTime'
}


export function handleConfigChanges(
    event: ConfigurationChangeEvent,
    handlerData: [ConfigSection, () => void][]
): void {
    const scope = workspace.workspaceFolders![0];
    for (const [section, handler] of handlerData) {
        if (event.affectsConfiguration(`illumina.${section}`, scope)) {
            handler();
        }
    }
}


export function getConfigValue<T>(key: string): T {
    return workspace.getConfiguration('illumina').get<T>(key)!;
}
