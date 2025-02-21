import { window, commands, Uri, Disposable } from 'vscode';
import { StaticVizEngine, VisualizationPanel } from './bridge';


export function visualize(uri: Uri): Disposable {
    return commands.registerCommand('illumina.visualize', async () => {
        try {
            const engine = StaticVizEngine.getInstance();
            await engine.activate();
            if (engine.isActive) VisualizationPanel.createOrShow(uri);
        }
        catch (error) {
            window.showErrorMessage(`Failed to initialize visualization: ${error}`);
        }
    });
}
