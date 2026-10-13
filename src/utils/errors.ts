export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function errorStatus(error: unknown, fallback = 500): number {
    if (typeof error === "object" && error !== null && "statusCode" in error &&
        typeof error.statusCode === "number" && Number.isInteger(error.statusCode) &&
        error.statusCode >= 400 && error.statusCode <= 599) {
        return error.statusCode;
    }
    return fallback;
}
