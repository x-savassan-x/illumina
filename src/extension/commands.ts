import { window, commands, Uri, Disposable } from 'vscode';
import { StaticVizEngine, VizPanel } from './bridge';


export function visualize(uri: Uri): Disposable {
    return commands.registerCommand('illumina.visualize', async () => {
        try {
            const engine = StaticVizEngine.instance;
            await engine.activate();
            if (engine.isActive) VizPanel.show(uri);
        }
        catch (error) {
            window.showErrorMessage(`Failed to initialize visualization: ${error}`);
        }
    });
}
