/**
 * Reads what a numeric field's text asks for: a number, arithmetic over
 * numbers (`600+20`, `(10+5)*2`), or an operation on the current value when
 * the text starts with `+`, `*` or `/` (`*2` doubles it, `+20` adds 20).
 *
 * @remarks
 * A leading `-` reads as a negative number, as in Figma: `-20` sets −20.
 * The typographic minus (−), `×` and `÷` are accepted. Only `+ - * /`,
 * parentheses and decimal numbers are understood; anything else, division
 * by zero, or a non-finite result reads as null.
 *
 * @param text - What was typed.
 * @param current - The value the field held, for a relative operation; null when it holds none.
 * @returns The value asked for, or null when the text is not one.
 */
export function evaluateNumberExpression(text: string, current: number | null): number | null {
  const normalized = text
    .trim()
    .replaceAll("−", "-")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll(",", ".");
  if (normalized === "") return null;

  const relative = /^[+*/]/.test(normalized);
  if (relative && current === null) return null;

  const expression = relative ? `${current}${normalized}` : normalized;
  const tokens = tokenize(expression);
  if (!tokens) return null;

  const parser = new ExpressionParser(tokens);
  const value = parser.parse();
  return value !== null && Number.isFinite(value) ? value : null;
}

type Token = { readonly kind: "number"; readonly value: number } | { readonly kind: string };

const NUMBER = /^(\d+\.?\d*|\.\d+)/;

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let rest = text.replaceAll(/\s+/g, "");

  while (rest.length > 0) {
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      rest = rest.slice(number[0].length);
      continue;
    }

    const symbol = rest[0];
    if (!"+-*/()".includes(symbol)) return null;
    tokens.push({ kind: symbol });
    rest = rest.slice(1);
  }

  return tokens;
}

/** Recursive descent over `expr := term (('+'|'-') term)*`, `term := unary (('*'|'/') unary)*`. */
class ExpressionParser {
  readonly #tokens: readonly Token[];
  #index = 0;

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  parse(): number | null {
    const value = this.#expression();
    if (value === null || this.#index !== this.#tokens.length) return null;
    return value;
  }

  #peek(): string | null {
    return this.#tokens[this.#index]?.kind ?? null;
  }

  #expression(): number | null {
    let value = this.#term();
    while (value !== null) {
      const operator = this.#peek();
      if (operator !== "+" && operator !== "-") break;

      this.#index++;
      const right = this.#term();
      if (right === null) return null;
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  #term(): number | null {
    let value = this.#unary();
    while (value !== null) {
      const operator = this.#peek();
      if (operator !== "*" && operator !== "/") break;

      this.#index++;
      const right = this.#unary();
      if (right === null) return null;
      if (operator === "/" && right === 0) return null;
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  #unary(): number | null {
    const operator = this.#peek();
    if (operator === "-" || operator === "+") {
      this.#index++;
      const value = this.#unary();
      if (value === null) return null;
      return operator === "-" ? -value : value;
    }
    return this.#primary();
  }

  #primary(): number | null {
    const token = this.#tokens[this.#index];
    if (!token) return null;

    if (token.kind === "number" && "value" in token) {
      this.#index++;
      return token.value;
    }
    if (token.kind !== "(") return null;

    this.#index++;
    const value = this.#expression();
    if (value === null || this.#peek() !== ")") return null;
    this.#index++;
    return value;
  }
}
