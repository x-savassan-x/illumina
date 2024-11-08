import { Uri, commands } from "vscode";
import { VisualizationPanel } from "../VisualizationPanel";

export function activateCommand(uri: Uri) {
    return commands.registerCommand('illumina.activate', () => {
		VisualizationPanel.createOrShow(uri);
	});
}