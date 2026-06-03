import { spawnSync } from 'node:child_process';

const RESTORED_DB_BASELINE_MIGRATION = '20260507_add_grilla_rwy_eventos';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runPrisma(args) {
  const result = spawnSync(npx, ['--no-install', 'prisma', ...args], {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
}

function exitIfFailed(result) {
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const deploy = runPrisma(['migrate', 'deploy']);
const output = `${deploy.stdout ?? ''}\n${deploy.stderr ?? ''}`;

if (deploy.status === 0) {
  process.exit(0);
}

if (!output.includes('P3005')) {
  exitIfFailed(deploy);
}

console.log(
  `Database is not empty. Marking ${RESTORED_DB_BASELINE_MIGRATION} as already applied before retrying deploy.`,
);

const baseline = runPrisma([
  'migrate',
  'resolve',
  '--applied',
  RESTORED_DB_BASELINE_MIGRATION,
]);
exitIfFailed(baseline);

const retryDeploy = runPrisma(['migrate', 'deploy']);
exitIfFailed(retryDeploy);
