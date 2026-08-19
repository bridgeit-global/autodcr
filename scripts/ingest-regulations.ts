import { ingest } from "../app/lib/regulationsRag/ingest";

const force = process.argv.includes("--force");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg
  ? onlyArg
      .slice("--only=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

ingest({ force, only })
  .then(() => console.log("Ingest complete."))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
