export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function usernameLookupPattern(username: string) {
  return username.replace(/[\\%_]/g, "\\$&");
}

export function isUsernameUniqueViolation(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase();
  return message.includes("username") &&
    (error.code === "23505" || message.includes("unique") || message.includes("duplicate"));
}
