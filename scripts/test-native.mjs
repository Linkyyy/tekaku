import { execFileSync } from 'node:child_process';
execFileSync(process.env.TEKAKU_GO || 'go', ['test', './...'], { cwd: 'native', stdio: 'inherit' });
