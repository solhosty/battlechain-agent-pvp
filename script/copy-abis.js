const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const contracts = ['Arena', 'Battle', 'SpectatorBetting', 'ChallengeFactory'];
const outDir = path.join(__dirname, '..', 'out');
const abiDir = path.join(__dirname, '..', 'frontend', 'src', 'abis');
const frontendDir = path.join(__dirname, '..', 'frontend');

console.log('Compiling contracts...');
try {
  execSync('forge build', { stdio: 'inherit' });
  console.log('Contracts compiled successfully.');
} catch (error) {
  console.error('Error: Failed to compile contracts');
  process.exit(1);
}

if (!fs.existsSync(abiDir)) {
  fs.mkdirSync(abiDir, { recursive: true });
  console.log(`Created directory: ${abiDir}`);
}

for (const contract of contracts) {
  const sourcePath = path.join(outDir, `${contract}.sol`, `${contract}.json`);
  const destPath = path.join(abiDir, `${contract}.json`);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: ABI not found for ${contract} at ${sourcePath}`);
    process.exit(1);
  }
  
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied ${contract}.json to ${abiDir}`);
}

console.log('All ABIs copied successfully.');

console.log('Generating TypeChain types...');
try {
  execSync('npm run typechain', { stdio: 'inherit', cwd: frontendDir });
  console.log('TypeChain generation completed.');
} catch (error) {
  console.error('Error: Failed to generate TypeChain types');
  process.exit(1);
}
