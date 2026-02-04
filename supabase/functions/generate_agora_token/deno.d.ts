// Deno type declarations for Supabase Edge Functions
// These types are provided by the Deno runtime

declare namespace Deno {
    export function serve(handler: (req: Request) => Promise<Response> | Response): void;

    export namespace env {
        export function get(key: string): string | undefined;
    }
}
