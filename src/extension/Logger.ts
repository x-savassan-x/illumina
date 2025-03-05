import { LogOutputChannel, window } from "vscode";
import { existsSync, mkdirSync, WriteStream, createWriteStream } from "fs";
import { join } from "path";
import { LogLevel, LogData } from "@shared/index";


interface IWriter {
    write(level: LogLevel, message: string): void;
    dispose(): void;
}


class ChannelWriter implements IWriter {
    private readonly _channel: LogOutputChannel;

    public constructor(name: string) {
        this._channel = window.createOutputChannel(name, { log: true });
    }

    public write(level: LogLevel, payload: string): void {
        switch (level) {
            case LogLevel.Debug: this._channel.debug(payload); break;
            case LogLevel.Info: this._channel.info(payload); break;
            case LogLevel.Warn: this._channel.warn(payload); break;
            case LogLevel.Error: this._channel.error(payload); break;
        }
    }

    public dispose(): void {
        this._channel.dispose();
    }
}


class FileWriter implements IWriter {
    private readonly _writer: WriteStream;

    public constructor(logDir: string) {
        const fileName = this._getLogFileName();
        const filePath = join(logDir, fileName);

        if (!existsSync(logDir))
            mkdirSync(logDir, { recursive: true });

        this._writer = createWriteStream(filePath, { flags: 'a' });
    }

    public write(level: LogLevel, payload: string): void {
        const timeStamp = this._getTimeStamp();
        const logMsg = `[${timeStamp}] [${level}] ${payload}\n`;
        this._writer.write(logMsg);
    }

    public dispose(): void {
        this._writer.end('='.repeat(80) + '\n');
    }

    private _getLogFileName(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}.log`;
    }

    private _getTimeStamp(): string {
        const date = new Date();
        const hour = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const sec = String(date.getSeconds()).padStart(2, '0');
        const milSec = String(date.getMilliseconds()).padStart(3, '0');
        return `${hour}:${min}:${sec}.${milSec}`;
    }
}


export class Logger {
    private static readonly _writers: IWriter[] = [];

    private constructor() { }

    public static init(): void {
        this._writers.push(new ChannelWriter('Illumina'));

        if (process.env.NODE_ENV === 'development') {
            const logDir = join(process.env.ROOT!, 'logs');
            this._writers.push(new FileWriter(logDir));
        }
    }

    public static dispose(): void {
        this._writers.forEach(w => w.dispose());
    }

    public static debug(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Debug, message, source, data);
    }

    public static info(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Info, message, source, data);
    }

    public static warn(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Warn, message, source, data);
    }

    public static error(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Error, message, source, data);
    }

    private static _log(level: LogLevel, message: string, source?: string, data?: LogData): void {
        const src = source ? `[${source}] ` : '';
        const metadata = data ? `\n${JSON.stringify(data, null, 2)}` : '';
        const payload = `${src}${message}${metadata}`;

        for (const writer of this._writers)
            writer.write(level, payload);
    }
}
