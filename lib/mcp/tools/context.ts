export interface McpToolExtra {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
}

/** Reads the admin's user id off the verified token's AuthInfo, threaded in by verifyAccessToken (lib/mcp/verify-token.ts). */
export function requireAuthedUserId(extra: McpToolExtra): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Missing authenticated user context.');
  }
  return userId;
}
