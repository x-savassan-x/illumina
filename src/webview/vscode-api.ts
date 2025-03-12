import { Message } from "@shared/Message";


interface VSCodeAPI {
    postMessage(message: Message): void;
    getState<T>(): T;
    setState<T>(state: T): void;
}


declare global {
    interface Window {
        acquireVsCodeApi(): VSCodeAPI;
    }
}


// Initialize vscode API once and store it
let vscodeApi: VSCodeAPI | undefined;


export function getVSCodeAPI(): VSCodeAPI {
    vscodeApi ??= window.acquireVsCodeApi();
    return vscodeApi;
}
