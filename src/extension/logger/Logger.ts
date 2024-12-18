import { join } from "path";
import { LogLevel, LogData } from "@shared/types/logging";
import { IWriter, ChannelWriter, FileWriter } from "./Writer";


export class Logger {
    private static _instance: Logger | undefined;
    private readonly _writers: IWriter[] = [];

    private constructor() {
        this._writers.push(new ChannelWriter('Illumina'));

        if (process.env.NODE_ENV === 'development') {
            const logDir = join(process.env.ROOT!, 'logs');
            this._writers.push(new FileWriter(logDir));
        }
    }

    public static get instance(): Logger {
        if (!Logger._instance) {
            Logger._instance = new Logger();
        }
        return Logger._instance;
    }

    public dispose(): void {
        this._writers.forEach(w => w.dispose());
        Logger._instance = undefined;
    }

    public debug(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Debug, message, source, data);
    }

    public info(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Info, message, source, data);
    }

    public warn(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Warn, message, source, data);
    }

    public error(message: string, source?: string, data?: LogData): void {
        this._log(LogLevel.Error, message, source, data);
    }

    private _log(level: LogLevel, message: string, source?: string, data?: LogData): void {
        const src = source ? `[${source}] ` : '';
        const metadata = data ? `\n${JSON.stringify(data, null, 2)}` : '';
        const payload = `${src}${message}${metadata}`;

        for (const writer of this._writers) {
            writer.write(level, payload);
        }
    }
}
