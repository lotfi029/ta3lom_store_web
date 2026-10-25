// Types for the test-tooling client (used from Playwright TS specs).
export declare const API_ORIGIN: string;
export declare const STAFF_FILE: string;
export declare function strongPassword(): string;
export declare class Client {
  token: string | null;
  session?: { accessToken: string; staff: { mustChangePassword: boolean; roles: string[] } };
  call(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<{ status: number; body: any; headers: Headers }>;
}
export declare function readStaff(): Record<
  string,
  { email: string; password: string; secret?: string; roles: string[] }
>;
export declare function writeStaff(staff: unknown): void;
export declare function staffLogin(entry: {
  email: string;
  password: string;
  secret?: string;
}): Promise<Client>;
export declare function latestOtp(mobile05: string): Promise<string | null>;
