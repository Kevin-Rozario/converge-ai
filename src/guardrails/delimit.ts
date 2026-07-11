/**
 * Wraps content in an explicit delimiter tag so a model can structurally
 * distinguish "this is data to evaluate" from "this is an instruction to
 * follow." Used both for the user's question sent to each provider, and
 * for each provider's raw answer when it's handed to the judge.
 */
export function delimit(tag: string, content: string, attrs: Record<string, string> = {}): string {
  const attrString = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join("");

  return `<${tag}${attrString}>\n${escapeClosingTag(content, tag)}\n</${tag}>`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

/** Neutralizes any attempt within `content` to prematurely close its own tag. */
function escapeClosingTag(content: string, tag: string): string {
  const closingTag = `</${tag}>`;
  return content.split(closingTag).join(`&lt;/${tag}&gt;`);
}
