/**
 * A load and frame report for one visit, shown on the page itself: `?timing` on the address. It is
 * for a machine that is slow where the build machine is not. The report can be read off a
 * screenshot, so whoever saw the stall can send back what their browser was doing during it.
 *
 * Loaded only when asked for, and it watches from outside: the readout the preloader prints, the
 * long tasks the browser reports, and the frames after the walk is up. Nothing in the walk knows
 * it is there.
 */
export function startTiming(root: HTMLElement): void {
  const pre = root.querySelector<HTMLElement>('[data-preloader]');
  const marks: [number, string][] = [];
  const long: [number, number][] = [];
  const seen = new Set<string>();
  const mark = (name: string) => { if (!seen.has(name)) { seen.add(name); marks.push([Math.round(performance.now()), name]); } };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch { /* not every browser reports them */ }

  const box = document.createElement('pre');
  box.setAttribute('data-walk-timing', '');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:10px 12px;max-width:min(46rem,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;background:rgb(4 7 10 / 0.92);color:#d9e8ee;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;user-select:text;-webkit-user-select:text';
  const frames: [number, number][] = [];
  let hiddenAt = 0;

  /** What the network did, read off the browser's own timings: the page, the scripts, the assets. */
  const network = () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const part = (name: string, f: (e: PerformanceResourceTiming) => boolean) => {
      const hit = res.filter(f);
      if (!hit.length) return `${name} none`;
      const kb = Math.round(hit.reduce((a, e) => a + (e.transferSize || e.encodedBodySize || 0), 0) / 1024);
      return `${name} ${hit.length} files ${kb} KB, first asked ${Math.round(Math.min(...hit.map((e) => e.startTime)))}, last landed ${Math.round(Math.max(...hit.map((e) => e.responseEnd)))}`;
    };
    return [
      `page   first byte ${nav ? Math.round(nav.responseStart) : '?'}  landed ${nav ? Math.round(nav.responseEnd) : '?'}  dom ready ${nav ? Math.round(nav.domContentLoadedEventEnd) : '?'}  ${nav?.type ?? ''}`,
      part('script', (e) => e.name.includes('/_astro/') && e.name.endsWith('.js')),
      part('assets', (e) => e.name.includes('/assets/')),
    ];
  };

  const print = (tail: string) => {
    const dpr = window.devicePixelRatio;
    const lines = [
      `jel.dev timing  ${new Date().toISOString()}`,
      `tier ${root.dataset.tier ?? '?'}  mode ${root.dataset.mode ?? '?'}  ${window.innerWidth}x${window.innerHeight} @${dpr}`,
      `gpu ${root.dataset.renderer ?? '?'}`,
      `browser ${navigator.userAgent.replace(/^Mozilla\/5\.0 \([^)]*\) /, '').slice(0, 90)}`,
      ...network(),
      `load   ${marks.map(([t, n]) => `${n} ${t}`).join('  ')}`,
      `long tasks over 100 ms during load: ${long.filter(([s, d]) => d > 100 && (!hiddenAt || s < hiddenAt)).map(([s, d]) => `${d}@${s}`).join(' ') || 'none'}`,
      tail,
    ];
    box.textContent = lines.join('\n');
  };

  const poll = setInterval(() => {
    const state = pre?.dataset.state ?? '';
    const pct = Number(pre?.textContent?.match(/(\d+)\s*%/)?.[1] ?? NaN);
    if (pct >= 0) mark('first-readout');
    for (const at of [10, 25, 50, 85, 90, 95, 99, 100]) if (pct >= at) mark(`${at}%`);
    if (state === 'slow') mark('slow-warning');
    if (state === 'done') mark('done');
    // Shown from the first moment, over the preloader, so a load that stalls can be read while it
    // is stalled.
    if (!box.isConnected && document.body) document.body.appendChild(box);
    if (state !== 'hidden') { print('loading'); return; }
    mark('hidden');
    clearInterval(poll);
    hiddenAt = performance.now();
    print('frames: measuring the next 20 s, scroll as you normally would');
    let last = performance.now();
    const tick = (now: number) => {
      frames.push([Math.round(now - last), Math.round(window.scrollY)]); last = now;
      if (now - hiddenAt < 20_000) { requestAnimationFrame(tick); return; }
      const d = frames.map((f) => f[0]).sort((a, b) => a - b);
      const slow = frames.filter((f) => f[0] > 50).sort((a, b) => b[0] - a[0]).slice(0, 10);
      const late = long.filter(([s, dur]) => s >= hiddenAt && dur > 50).map(([s, dur]) => `${dur}@${Math.round(s - hiddenAt)}`).join(' ') || 'none';
      print([
        `frames in 20 s: ${frames.length}  median ${d[d.length >> 1]} ms  99th ${d[Math.floor(d.length * 0.99)]} ms  worst ${d[d.length - 1]} ms  over 50 ms: ${frames.filter((f) => f[0] > 50).length}`,
        `worst frames (ms at scroll px): ${slow.map((f) => `${f[0]}@${f[1]}`).join(' ') || 'none'}`,
        `long tasks after load (ms at ms since load): ${late}`,
        `degraded ${root.hasAttribute('data-degraded')}  fallback ${root.dataset.fallback ?? 'no'}`,
      ].join('\n'));
    };
    requestAnimationFrame(tick);
  }, 50);
}
