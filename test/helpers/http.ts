import { request } from "node:http";

// Unlike fetch/Undici, this preserves an explicit Host header for tenant tests.
export async function httpRequest(url: string, init: RequestInit = {}): Promise<Response> {
    const encoded = new Request(url, init);
    const body = encoded.body ? Buffer.from(await encoded.arrayBuffer()) : undefined;
    return new Promise((resolve, reject) => {
        const req = request(url, {
            method: encoded.method,
            headers: Object.fromEntries(encoded.headers),
            signal: AbortSignal.timeout(5000),
        }, res => {
            const chunks: Buffer[] = [];
            res.on("data", chunk => chunks.push(Buffer.from(chunk)));
            res.on("error", reject);
            res.on("end", () => {
                const headers = new Headers();
                for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
                resolve(new Response([204, 304].includes(res.statusCode!) ? null : Buffer.concat(chunks), { status: res.statusCode, headers }));
            });
        });
        req.on("error", reject);
        req.end(body);
    });
}
