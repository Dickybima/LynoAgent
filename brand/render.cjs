const { chromium } = require('playwright');
const [,, html, outDir, fps, dur, onlyList] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const times = onlyList ? onlyList.split(',').map(Number) : Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps);
  let i = 0;
  for (const t of times) {
    await p.evaluate((t) => window.render(t), t);
    const name = onlyList ? `t${String(t).replace('.', '_')}` : String(i).padStart(5, '0');
    await p.screenshot({ path: `${outDir}/${name}.jpg`, type: 'jpeg', quality: 93 });
    i++;
  }
  console.log('frames', i, 'errors', errs);
  await b.close();
})();
