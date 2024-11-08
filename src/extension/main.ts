import { ExtensionContext } from 'vscode';
import { activateCommand } from './commands/activateCommand';

export function activate(context: ExtensionContext) {
	// const disposable = vscode.commands.registerCommand('illumina.activate', () => {
	// 	vscode.window.showInformationMessage('Illumina activated!');
	// });

	context.subscriptions.push(activateCommand(context.extensionUri));
}

// export function deactivate() {}
