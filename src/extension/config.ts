import { workspace, ConfigurationChangeEvent } from "vscode";


export enum ConfigSection {
    SourceDirectory = 'sourceDirectory',
    SourceLanguage = 'sourceLanguage',
    MaxCacheSize = 'maxCacheSize',
    DebounceInterval = 'debounceInterval',
    IgnoredFiles = 'ignoredFiles'
}


export function getConfigValue<T>(key: string): T {
    return workspace.getConfiguration('illumina').get<T>(key)!;
}


export function handleConfigChanges(
    event: ConfigurationChangeEvent,
    handlerData: [ConfigSection[], () => void][]
): void {
    const scope = workspace.workspaceFolders![0];

    for (const [sections, handler] of handlerData)
        if (sections.some(section => event.affectsConfiguration(`illumina.${section}`, scope)))
            handler();
}
