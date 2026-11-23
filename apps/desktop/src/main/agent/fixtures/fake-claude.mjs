// A stand-in for `claude -p --output-format stream-json`: it echoes the
// prompt and the arguments it was given as stream-json events.
let prompt = "";
process.stdin.on("data", (chunk) => (prompt += chunk));
process.stdin.on("end", () => {
  const args = process.argv.slice(2);
  const write = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
  write({ type: "system", subtype: "init", session_id: "session-1" });
  write({
    type: "assistant",
    message: {
      content: [
        { type: "text", text: `heard: ${prompt}` },
        {
          type: "tool_use",
          name: "mcp__shift-dev__shift.execute",
          input: { code: 'async () => shift.edits.apply({ label: "Draw O", intents: [] })' },
        },
        { type: "text", text: `args: ${args.join(" ")}` },
      ],
    },
  });
  write({ type: "result", is_error: false, result: "done", total_cost_usd: 0.01 });
});
