// Caps the media a project's panel loads when it is opened: 2.5 MB for a project and 1.8 MB for any
// one file. None of it is in the first visit, so it has a budget of its own. `MEDIA_ROOT` is for
// the script's own check, which points it at a scratch directory.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.MEDIA_ROOT ?? 'public/projects';
const PROJECT_LIMIT = 2.5 * 1048576;
const FILE_LIMIT = 1.8 * 1048576;
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

let fail = false;
if (!existsSync(ROOT)) { console.log(`ok   no project media (${ROOT} is absent)`); process.exit(0); }
for (const id of readdirSync(ROOT).sort()) {
  const dir = join(ROOT, id);
  if (!statSync(dir).isDirectory()) continue;
  let total = 0;
  for (const f of readdirSync(dir)) {
    const size = statSync(join(dir, f)).size;
    total += size;
    if (size > FILE_LIMIT) { fail = true; console.log(`OVER ${id}/${f}: ${mb(size)} of ${mb(FILE_LIMIT)}`); }
  }
  const ok = total <= PROJECT_LIMIT;
  if (!ok) fail = true;
  console.log(`${ok ? 'ok  ' : 'OVER'} project media ${id}: ${mb(total)} of ${mb(PROJECT_LIMIT)}`);
}
if (fail) { console.error('project media budget exceeded'); process.exit(1); }
