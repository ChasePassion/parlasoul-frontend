export class UnauthorizedError extends Error {
    constructor(message = "authorization failed") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export class ApiError extends Error {
    constructor(
        public status: number,
        public code?: string,
        public detail?: string
    ) {
        super(detail || `API Error: ${status}`);
        this.name = "ApiError";
    }
}
