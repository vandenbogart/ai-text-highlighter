const result = Bun.spawnSync(["git", "ls-files", "-z"]);

if (result.exitCode !== 0) {
  process.stderr.write(result.stderr);
  process.exit(1);
}

const offending = result.stdout
  .toString()
  .split("\0")
  .filter((path) => path.length > 0)
  .filter((path) => {
    const segments = path.split("/");
    const name = segments.at(-1) ?? "";
    return (
      segments.slice(0, -1).includes("__tests__") ||
      name.includes(".test.") ||
      name.includes(".spec.")
    );
  });

if (offending.length > 0) {
  console.error(`Test files are not allowed:\n${offending.join("\n")}`);
  process.exit(1);
}
