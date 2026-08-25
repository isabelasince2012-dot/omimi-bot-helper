const TOKEN_REGEX = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;

export function validateTokenFormat(token: string): string | null {
  if (!token || !token.trim()) return "Bot token is required";
  if (!TOKEN_REGEX.test(token.trim())) {
    return "Invalid token format. Expected '<bot_id>:<secret>' from @BotFather";
  }
  return null;
}