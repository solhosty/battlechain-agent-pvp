import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");
const DEST_DIR = path.join(ROOT, "frontend", "src", "abis");

const CONTRACTS = ["Arena", "Battle", "SpectatorBetting", "ChallengeFactory"];

const readAbi = async (contractName) => {
  const artifactPath = path.join(
    OUT_DIR,
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const raw = await fs.readFile(artifactPath, "utf8");
  const artifact = JSON.parse(raw);

  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Missing abi in ${artifactPath}`);
  }

  return { abi: artifact.abi };
};

const main = async () => {
  await fs.mkdir(DEST_DIR, { recursive: true });

  for (const contractName of CONTRACTS) {
    const abiPayload = await readAbi(contractName);
    const destPath = path.join(DEST_DIR, `${contractName}.json`);
    await fs.writeFile(destPath, `${JSON.stringify(abiPayload, null, 2)}\n`, "utf8");
  }
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
