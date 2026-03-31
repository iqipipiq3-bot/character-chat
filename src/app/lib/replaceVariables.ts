export function replaceVariables(text: string, userName: string): string {
  return text.replace(/\{\{user\}\}|\{user\}/gi, userName);
}
