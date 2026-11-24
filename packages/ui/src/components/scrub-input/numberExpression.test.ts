import { describe, expect, it } from "vitest";
import { evaluateNumberExpression } from "./numberExpression";

describe("evaluateNumberExpression", () => {
  it("reads plain numbers, negatives and decimals", () => {
    expect(evaluateNumberExpression("600", 0)).toBe(600);
    expect(evaluateNumberExpression("-20", 50)).toBe(-20);
    expect(evaluateNumberExpression("−20", 50)).toBe(-20);
    expect(evaluateNumberExpression(" 12.5 ", null)).toBe(12.5);
    expect(evaluateNumberExpression(".5", null)).toBe(0.5);
  });

  it("works out sums with precedence and parentheses", () => {
    expect(evaluateNumberExpression("600+20", 0)).toBe(620);
    expect(evaluateNumberExpression("10 + 5 * 2", 0)).toBe(20);
    expect(evaluateNumberExpression("(10+5)*2", 0)).toBe(30);
    expect(evaluateNumberExpression("100/4-5", 0)).toBe(20);
    expect(evaluateNumberExpression("3×4", 0)).toBe(12);
    expect(evaluateNumberExpression("9÷3", 0)).toBe(3);
  });

  it("applies a leading operator to the current value", () => {
    expect(evaluateNumberExpression("*2", 300)).toBe(600);
    expect(evaluateNumberExpression("/2", 300)).toBe(150);
    expect(evaluateNumberExpression("+20", 300)).toBe(320);
    expect(evaluateNumberExpression("*2+1", 300)).toBe(601);
  });

  it("refuses text that is not arithmetic", () => {
    expect(evaluateNumberExpression("", 1)).toBeNull();
    expect(evaluateNumberExpression("=H", 1)).toBeNull();
    expect(evaluateNumberExpression("abc", 1)).toBeNull();
    expect(evaluateNumberExpression("2+", 1)).toBeNull();
    expect(evaluateNumberExpression("(2+3", 1)).toBeNull();
    expect(evaluateNumberExpression("4/0", 1)).toBeNull();
    expect(evaluateNumberExpression("*2", null)).toBeNull();
  });
});
