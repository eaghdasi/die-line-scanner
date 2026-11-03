// Directional streak filter for die lines.
// Lines run along one axis. We smooth along that axis (keeps long, coherent
// streaks, drops noise), then subtract the local average across the lines
// (removes lighting gradients). What is left is the die-line signal.
(function (root) {
  function boxBlurAlong(src, dst, w, h, len, vertical) {
    const n = vertical ? h : w;      // length of one line of pixels
    const m = vertical ? w : h;      // number of lines
    const step = vertical ? w : 1;   // stride along the line
    const half = len >> 1;
    for (let j = 0; j < m; j++) {
      const base = vertical ? j : j * w;
      let sum = 0, cnt = 0;
      for (let i = 0; i < Math.min(half, n); i++) { sum += src[base + i * step]; cnt++; }
      for (let i = 0; i < n; i++) {
        const add = i + half, rem = i - half - 1;
        if (add < n) { sum += src[base + add * step]; cnt++; }
        if (rem >= 0) { sum -= src[base + rem * step]; cnt--; }
        dst[base + i * step] = sum / cnt;
      }
    }
  }

  // gray: Uint8ClampedArray of luma, w*h. Returns { score, signal }.
  // signal: Float32Array, positive/negative deviation per pixel, in luma units.
  // lines "vertical" means the die lines run top to bottom in the image.
  function analyse(gray, w, h, opts) {
    const o = Object.assign({ vertical: false, along: 25, across: 6 }, opts);
    const smooth = new Float32Array(w * h);
    boxBlurAlong(gray, smooth, w, h, o.along, o.vertical);

    // High-pass across the lines: pixel minus the mean of its neighbours across.
    const signal = new Float32Array(w * h);
    const n = o.vertical ? w : h;     // extent across the lines
    const m = o.vertical ? h : w;     // positions along the lines
    const step = o.vertical ? 1 : w;  // stride across the lines
    for (let j = 0; j < m; j++) {
      const base = o.vertical ? j * w : j;
      let sum = 0, cnt = 0;
      for (let i = 0; i < Math.min(o.across, n); i++) { sum += smooth[base + i * step]; cnt++; }
      for (let i = 0; i < n; i++) {
        const add = i + o.across, rem = i - o.across - 1;
        if (add < n) { sum += smooth[base + add * step]; cnt++; }
        if (rem >= 0) { sum -= smooth[base + rem * step]; cnt--; }
        signal[base + i * step] = smooth[base + i * step] - sum / cnt;
      }
    }

    // Score: mean absolute signal, ignoring a border where the blur windows are truncated.
    const mx = Math.min(o.along >> 1, w >> 2), my = Math.min(o.across, h >> 2);
    let total = 0, count = 0;
    for (let y = my; y < h - my; y++) {
      for (let x = mx; x < w - mx; x++) { total += Math.abs(signal[y * w + x]); count++; }
    }
    return { score: count ? total / count : 0, signal };
  }

  const api = { analyse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DieLine = api;
})(typeof self !== 'undefined' ? self : this);
