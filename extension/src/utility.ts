import * as net from "net";

export class Utility {
    public static async getFreePort(): Promise<number> {
        return await new Promise((resolve: (port: number) => void, reject: (e: Error) => void): void => {
            const server: net.Server = net.createServer();
            let port: number = 0;
            server.on("listening", () => {
                port = server.address().port;
                server.close();
            });
            server.on("close", () => {
                return resolve(port);
            });
            server.on("error", (err) => {
                return reject(new Error(err.toString()));
            });
            server.listen(0, "127.0.0.1");
        });
    }
}