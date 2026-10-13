/**
 * Potrace bitmap-to-curve tracer.
 *
 * TypeScript port of the tracing core of node-potrace (Iwan Gabovitch and
 * contributors, https://github.com/tooolbox/node-potrace), itself a port of
 * Peter Selinger's Potrace (http://potrace.sourceforge.net). Both are
 * licensed under the GNU General Public License v2.0 or later; this file
 * stays under that license. Image decoding, thresholding and SVG assembly
 * live in ./index.ts; this module only turns a binary bitmap into Bézier
 * curves.
 */

export interface Point {
  x: number;
  y: number;
}

/** 1 = ink, 0 = background, row-major. */
export interface BinaryBitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export type TurnPolicy = 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';

export interface PotraceParams {
  /** How ambiguous corners are resolved when decomposing the bitmap into paths. */
  turnPolicy: TurnPolicy;
  /** Paths enclosing at most this many pixels are dropped as speckles. */
  turdSize: number;
  /** Corner threshold: 0 keeps every corner sharp, 4/3 smooths everything. */
  alphaMax: number;
  /** Join adjacent Bézier segments when they fit within optTolerance. */
  optCurve: boolean;
  optTolerance: number;
}

export const DEFAULT_POTRACE_PARAMS: PotraceParams = {
  turnPolicy: 'minority',
  turdSize: 2,
  alphaMax: 1,
  optCurve: true,
  optTolerance: 0.2,
};

type SegmentTag = 'CURVE' | 'CORNER';

export interface Curve {
  n: number;
  tag: SegmentTag[];
  /** Three control points per segment: c[3i], c[3i+1], c[3i+2]. */
  c: Point[];
  vertex: Point[];
  alpha: number[];
  alpha0: number[];
  beta: number[];
}

interface Sum {
  x: number;
  y: number;
  xy: number;
  x2: number;
  y2: number;
}

interface TracePath {
  area: number;
  len: number;
  pt: Point[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sign: '+' | '-';
  x0: number;
  y0: number;
  sums: Sum[];
  lon: number[];
  m: number;
  po: number[];
  curve: Curve;
}

export interface TracedPath {
  /** '+' for an outer (ink) boundary, '-' for a hole. */
  sign: '+' | '-';
  /** Enclosed area in bitmap pixels. */
  area: number;
  curve: Curve;
}

function point(x = 0, y = 0): Point {
  return { x, y };
}

function createCurve(n: number): Curve {
  return {
    n,
    tag: new Array<SegmentTag>(n),
    c: new Array<Point>(n * 3),
    vertex: new Array<Point>(n),
    alpha: new Array<number>(n),
    alpha0: new Array<number>(n),
    beta: new Array<number>(n),
  };
}

function mod(a: number, n: number): number {
  return a >= n ? a % n : a >= 0 ? a : n - 1 - ((-1 - a) % n);
}

function xprod(p1: Point, p2: Point): number {
  return p1.x * p2.y - p1.y * p2.x;
}

function cyclic(a: number, b: number, c: number): boolean {
  return a <= c ? a <= b && b < c : a <= b || b < c;
}

function sign(i: number): number {
  return i > 0 ? 1 : i < 0 ? -1 : 0;
}

/** 3x3 symmetric matrix stored row-major. */
type Quad = number[];

function quadform(Q: Quad, w: Point): number {
  const v = [w.x, w.y, 1];
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      sum += v[i] * Q[i * 3 + j] * v[j];
    }
  }
  return sum;
}

function interval(lambda: number, a: Point, b: Point): Point {
  return point(a.x + lambda * (b.x - a.x), a.y + lambda * (b.y - a.y));
}

function dorthInfty(p0: Point, p2: Point): Point {
  return point(-sign(p2.y - p0.y), sign(p2.x - p0.x));
}

function ddenom(p0: Point, p2: Point): number {
  const r = dorthInfty(p0, p2);
  return r.y * (p2.x - p0.x) - r.x * (p2.y - p0.y);
}

function dpara(p0: Point, p1: Point, p2: Point): number {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
}

function cprod(p0: Point, p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p0.x) * (p3.y - p2.y) - (p3.x - p2.x) * (p1.y - p0.y);
}

function iprod(p0: Point, p1: Point, p2: Point): number {
  return (p1.x - p0.x) * (p2.x - p0.x) + (p1.y - p0.y) * (p2.y - p0.y);
}

function iprod1(p0: Point, p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p0.x) * (p3.x - p2.x) + (p1.y - p0.y) * (p3.y - p2.y);
}

function ddist(p: Point, q: Point): number {
  return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
}

function bezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const s = 1 - t;
  return point(
    s * s * s * p0.x + 3 * (s * s * t) * p1.x + 3 * (t * t * s) * p2.x + t * t * t * p3.x,
    s * s * s * p0.y + 3 * (s * s * t) * p1.y + 3 * (t * t * s) * p2.y + t * t * t * p3.y,
  );
}

function tangent(p0: Point, p1: Point, p2: Point, p3: Point, q0: Point, q1: Point): number {
  const A = cprod(p0, p1, q0, q1);
  const B = cprod(p1, p2, q0, q1);
  const C = cprod(p2, p3, q0, q1);
  const a = A - 2 * B + C;
  const b = -2 * A + 2 * B;
  const c = A;
  const d = b * b - 4 * a * c;
  if (a === 0 || d < 0) return -1;
  const s = Math.sqrt(d);
  const r1 = (-b + s) / (2 * a);
  const r2 = (-b - s) / (2 * a);
  if (r1 >= 0 && r1 <= 1) return r1;
  if (r2 >= 0 && r2 <= 1) return r2;
  return -1;
}

/**
 * Decomposes the bitmap into closed paths along pixel edges. Each path is
 * XOR-ed out of a working copy as it is found, so holes come out as their
 * own '-' paths and the bitmap is left untouched.
 */
function bitmapToPathList(bitmap: BinaryBitmap, params: PotraceParams): TracePath[] {
  const { width, height } = bitmap;
  const size = width * height;
  const map = new Uint8Array(bitmap.data);

  const get = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : map[width * y + x];

  function findNext(start: number): number {
    let i = start;
    while (i < size && map[i] !== 1) i++;
    return i;
  }

  function majority(x: number, y: number): number {
    for (let i = 2; i < 5; i++) {
      let ct = 0;
      for (let a = -i + 1; a <= i - 1; a++) {
        ct += get(x + a, y + i - 1) ? 1 : -1;
        ct += get(x + i - 1, y + a - 1) ? 1 : -1;
        ct += get(x + a - 1, y - i) ? 1 : -1;
        ct += get(x - i, y + a) ? 1 : -1;
      }
      if (ct > 0) return 1;
      if (ct < 0) return 0;
    }
    return 0;
  }

  function findPath(startX: number, startY: number): TracePath {
    const path: TracePath = {
      area: 0,
      len: 0,
      pt: [],
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: -1,
      maxY: -1,
      // The sign comes from the original bitmap (as in Selinger's potrace):
      // after a region is XOR-ed out of the working copy, its holes show up
      // there as ink, and the original tells them apart from real ink.
      sign: bitmap.data[width * startY + startX] ? '+' : '-',
      x0: 0,
      y0: 0,
      sums: [],
      lon: [],
      m: 0,
      po: [],
      curve: createCurve(0),
    };
    let x = startX;
    let y = startY;
    let dirx = 0;
    let diry = 1;

    for (;;) {
      path.pt.push(point(x, y));
      if (x > path.maxX) path.maxX = x;
      if (x < path.minX) path.minX = x;
      if (y > path.maxY) path.maxY = y;
      if (y < path.minY) path.minY = y;
      path.len++;

      x += dirx;
      y += diry;
      path.area -= x * diry;
      if (x === startX && y === startY) break;

      const l = get(x + (dirx + diry - 1) / 2, y + (diry - dirx - 1) / 2);
      const r = get(x + (dirx - diry - 1) / 2, y + (diry + dirx - 1) / 2);

      if (r && !l) {
        const turnRight =
          params.turnPolicy === 'right' ||
          (params.turnPolicy === 'black' && path.sign === '+') ||
          (params.turnPolicy === 'white' && path.sign === '-') ||
          (params.turnPolicy === 'majority' && majority(x, y) === 1) ||
          (params.turnPolicy === 'minority' && majority(x, y) === 0);
        const tmp = dirx;
        if (turnRight) {
          dirx = -diry;
          diry = tmp;
        } else {
          dirx = diry;
          diry = -tmp;
        }
      } else if (r) {
        const tmp = dirx;
        dirx = -diry;
        diry = tmp;
      } else if (!l) {
        const tmp = dirx;
        dirx = diry;
        diry = -tmp;
      }
    }
    return path;
  }

  function xorPath(path: TracePath): void {
    let y1 = path.pt[0].y;
    for (let i = 1; i < path.len; i++) {
      const x = path.pt[i].x;
      const y = path.pt[i].y;
      if (y !== y1) {
        const minY = y1 < y ? y1 : y;
        for (let j = x; j < path.maxX; j++) {
          const idx = width * minY + j;
          map[idx] = map[idx] ? 0 : 1;
        }
        y1 = y;
      }
    }
  }

  const paths: TracePath[] = [];
  let index = findNext(0);
  while (index < size) {
    const y = Math.floor(index / width);
    const x = index - y * width;
    const path = findPath(x, y);
    xorPath(path);
    if (path.area > params.turdSize) paths.push(path);
    index = findNext(index);
  }
  return paths;
}

function calcSums(path: TracePath): void {
  path.x0 = path.pt[0].x;
  path.y0 = path.pt[0].y;
  const s: Sum[] = [{ x: 0, y: 0, xy: 0, x2: 0, y2: 0 }];
  for (let i = 0; i < path.len; i++) {
    const x = path.pt[i].x - path.x0;
    const y = path.pt[i].y - path.y0;
    s.push({
      x: s[i].x + x,
      y: s[i].y + y,
      xy: s[i].xy + x * y,
      x2: s[i].x2 + x * x,
      y2: s[i].y2 + y * y,
    });
  }
  path.sums = s;
}

/** For every point, the furthest point reachable by a straight segment (Potrace §3.1). */
function calcLon(path: TracePath): void {
  const n = path.len;
  const pt = path.pt;
  const pivk = new Array<number>(n);
  const nc = new Array<number>(n);
  const ct = [0, 0, 0, 0];
  path.lon = new Array<number>(n);

  const constraint = [point(), point()];
  const cur = point();
  const off = point();
  const dk = point();

  let k = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (pt[i].x !== pt[k].x && pt[i].y !== pt[k].y) k = i + 1;
    nc[i] = k;
  }

  for (let i = n - 1; i >= 0; i--) {
    ct[0] = ct[1] = ct[2] = ct[3] = 0;
    let dir = (3 + 3 * (pt[mod(i + 1, n)].x - pt[i].x) + (pt[mod(i + 1, n)].y - pt[i].y)) / 2;
    ct[dir]++;

    constraint[0].x = 0;
    constraint[0].y = 0;
    constraint[1].x = 0;
    constraint[1].y = 0;

    k = nc[i];
    let k1 = i;
    let foundk = false;
    for (;;) {
      dir = (3 + 3 * sign(pt[k].x - pt[k1].x) + sign(pt[k].y - pt[k1].y)) / 2;
      ct[dir]++;

      if (ct[0] && ct[1] && ct[2] && ct[3]) {
        pivk[i] = k1;
        foundk = true;
        break;
      }

      cur.x = pt[k].x - pt[i].x;
      cur.y = pt[k].y - pt[i].y;
      if (xprod(constraint[0], cur) < 0 || xprod(constraint[1], cur) > 0) break;

      if (!(Math.abs(cur.x) <= 1 && Math.abs(cur.y) <= 1)) {
        off.x = cur.x + (cur.y >= 0 && (cur.y > 0 || cur.x < 0) ? 1 : -1);
        off.y = cur.y + (cur.x <= 0 && (cur.x < 0 || cur.y < 0) ? 1 : -1);
        if (xprod(constraint[0], off) >= 0) {
          constraint[0].x = off.x;
          constraint[0].y = off.y;
        }
        off.x = cur.x + (cur.y <= 0 && (cur.y < 0 || cur.x < 0) ? 1 : -1);
        off.y = cur.y + (cur.x >= 0 && (cur.x > 0 || cur.y < 0) ? 1 : -1);
        if (xprod(constraint[1], off) <= 0) {
          constraint[1].x = off.x;
          constraint[1].y = off.y;
        }
      }
      k1 = k;
      k = nc[k1];
      if (!cyclic(k, i, k1)) break;
    }

    if (!foundk) {
      dk.x = sign(pt[k].x - pt[k1].x);
      dk.y = sign(pt[k].y - pt[k1].y);
      cur.x = pt[k1].x - pt[i].x;
      cur.y = pt[k1].y - pt[i].y;

      const a = xprod(constraint[0], cur);
      const b = xprod(constraint[0], dk);
      const c = xprod(constraint[1], cur);
      const d = xprod(constraint[1], dk);

      let j = 10000000;
      if (b < 0) j = Math.floor(a / -b);
      if (d > 0) j = Math.min(j, Math.floor(-c / d));
      pivk[i] = mod(k1 + j, n);
    }
  }

  let j = pivk[n - 1];
  path.lon[n - 1] = j;
  for (let i = n - 2; i >= 0; i--) {
    if (cyclic(i + 1, pivk[i], j)) j = pivk[i];
    path.lon[i] = j;
  }
  for (let i = n - 1; cyclic(mod(i + 1, n), j, path.lon[i]); i--) {
    path.lon[i] = j;
  }
}

/** Optimal polygon through the path points (Potrace §3.2). */
function bestPolygon(path: TracePath): void {
  const n = path.len;
  const pt = path.pt;
  const sums = path.sums;

  function penalty3(i: number, j: number): number {
    let r = 0;
    if (j >= n) {
      j -= n;
      r = 1;
    }
    let x: number;
    let y: number;
    let x2: number;
    let xy: number;
    let y2: number;
    let k: number;
    if (r === 0) {
      x = sums[j + 1].x - sums[i].x;
      y = sums[j + 1].y - sums[i].y;
      x2 = sums[j + 1].x2 - sums[i].x2;
      xy = sums[j + 1].xy - sums[i].xy;
      y2 = sums[j + 1].y2 - sums[i].y2;
      k = j + 1 - i;
    } else {
      x = sums[j + 1].x - sums[i].x + sums[n].x;
      y = sums[j + 1].y - sums[i].y + sums[n].y;
      x2 = sums[j + 1].x2 - sums[i].x2 + sums[n].x2;
      xy = sums[j + 1].xy - sums[i].xy + sums[n].xy;
      y2 = sums[j + 1].y2 - sums[i].y2 + sums[n].y2;
      k = j + 1 - i + n;
    }
    const px = (pt[i].x + pt[j].x) / 2 - pt[0].x;
    const py = (pt[i].y + pt[j].y) / 2 - pt[0].y;
    const ey = pt[j].x - pt[i].x;
    const ex = -(pt[j].y - pt[i].y);
    const a = (x2 - 2 * x * px) / k + px * px;
    const b = (xy - x * py - y * px) / k + px * py;
    const c = (y2 - 2 * y * py) / k + py * py;
    return Math.sqrt(ex * ex * a + 2 * ex * ey * b + ey * ey * c);
  }

  const pen = new Array<number>(n + 1);
  const prev = new Array<number>(n + 1);
  const clip0 = new Array<number>(n);
  const clip1 = new Array<number>(n + 1);
  const seg0 = new Array<number>(n + 1);
  const seg1 = new Array<number>(n + 1);

  for (let i = 0; i < n; i++) {
    let c = mod(path.lon[mod(i - 1, n)] - 1, n);
    if (c === i) c = mod(i + 1, n);
    clip0[i] = c < i ? n : c;
  }

  let j = 1;
  for (let i = 0; i < n; i++) {
    while (j <= clip0[i]) {
      clip1[j] = i;
      j++;
    }
  }

  let i = 0;
  for (j = 0; i < n; j++) {
    seg0[j] = i;
    i = clip0[i];
  }
  seg0[j] = n;
  const m = j;

  i = n;
  for (j = m; j > 0; j--) {
    seg1[j] = i;
    i = clip1[i];
  }
  seg1[0] = 0;

  pen[0] = 0;
  for (j = 1; j <= m; j++) {
    for (i = seg1[j]; i <= seg0[j]; i++) {
      let best = -1;
      for (let k = seg0[j - 1]; k >= clip1[i]; k--) {
        const thispen = penalty3(k, i) + pen[k];
        if (best < 0 || thispen < best) {
          prev[i] = k;
          best = thispen;
        }
      }
      pen[i] = best;
    }
  }

  path.m = m;
  path.po = new Array<number>(m);
  for (i = n, j = m - 1; i > 0; j--) {
    i = prev[i];
    path.po[j] = i;
  }
}

/** Moves polygon vertices to the least-squares optimal position (Potrace §3.3). */
function adjustVertices(path: TracePath): void {
  const m = path.m;
  const po = path.po;
  const n = path.len;
  const pt = path.pt;
  const sums = path.sums;
  const x0 = path.x0;
  const y0 = path.y0;

  function pointslope(i: number, j: number, ctr: Point, dir: Point): void {
    let r = 0;
    while (j >= n) {
      j -= n;
      r += 1;
    }
    while (i >= n) {
      i -= n;
      r -= 1;
    }
    while (j < 0) {
      j += n;
      r -= 1;
    }
    while (i < 0) {
      i += n;
      r += 1;
    }

    const x = sums[j + 1].x - sums[i].x + r * sums[n].x;
    const y = sums[j + 1].y - sums[i].y + r * sums[n].y;
    const x2 = sums[j + 1].x2 - sums[i].x2 + r * sums[n].x2;
    const xy = sums[j + 1].xy - sums[i].xy + r * sums[n].xy;
    const y2 = sums[j + 1].y2 - sums[i].y2 + r * sums[n].y2;
    const k = j + 1 - i + r * n;

    ctr.x = x / k;
    ctr.y = y / k;

    let a = (x2 - (x * x) / k) / k;
    const b = (xy - (x * y) / k) / k;
    let c = (y2 - (y * y) / k) / k;
    const lambda2 = (a + c + Math.sqrt((a - c) * (a - c) + 4 * b * b)) / 2;
    a -= lambda2;
    c -= lambda2;

    let l: number;
    if (Math.abs(a) >= Math.abs(c)) {
      l = Math.sqrt(a * a + b * b);
      if (l !== 0) {
        dir.x = -b / l;
        dir.y = a / l;
      }
    } else {
      l = Math.sqrt(c * c + b * b);
      if (l !== 0) {
        dir.x = -c / l;
        dir.y = b / l;
      }
    }
    if (l === 0) {
      dir.x = 0;
      dir.y = 0;
    }
  }

  const ctr = new Array<Point>(m);
  const dir = new Array<Point>(m);
  const q = new Array<Quad>(m);
  const v = [0, 0, 0];
  const s = point();

  path.curve = createCurve(m);

  for (let i = 0; i < m; i++) {
    let j = po[mod(i + 1, m)];
    j = mod(j - po[i], n) + po[i];
    ctr[i] = point();
    dir[i] = point();
    pointslope(po[i], j, ctr[i], dir[i]);
  }

  for (let i = 0; i < m; i++) {
    q[i] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const d = dir[i].x * dir[i].x + dir[i].y * dir[i].y;
    if (d !== 0) {
      v[0] = dir[i].y;
      v[1] = -dir[i].x;
      v[2] = -v[1] * ctr[i].y - v[0] * ctr[i].x;
      for (let l = 0; l < 3; l++) {
        for (let k = 0; k < 3; k++) {
          q[i][l * 3 + k] = (v[l] * v[k]) / d;
        }
      }
    }
  }

  for (let i = 0; i < m; i++) {
    const Q: Quad = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const w = point();

    s.x = pt[po[i]].x - x0;
    s.y = pt[po[i]].y - y0;

    const j = mod(i - 1, m);
    for (let l = 0; l < 3; l++) {
      for (let k = 0; k < 3; k++) {
        Q[l * 3 + k] = q[j][l * 3 + k] + q[i][l * 3 + k];
      }
    }

    for (;;) {
      const det = Q[0] * Q[4] - Q[1] * Q[3];
      if (det !== 0) {
        w.x = (-Q[2] * Q[4] + Q[5] * Q[1]) / det;
        w.y = (Q[2] * Q[3] - Q[5] * Q[0]) / det;
        break;
      }
      if (Q[0] > Q[4]) {
        v[0] = -Q[1];
        v[1] = Q[0];
      } else if (Q[4]) {
        v[0] = -Q[4];
        v[1] = Q[3];
      } else {
        v[0] = 1;
        v[1] = 0;
      }
      const d = v[0] * v[0] + v[1] * v[1];
      v[2] = -v[1] * s.y - v[0] * s.x;
      for (let l = 0; l < 3; l++) {
        for (let k = 0; k < 3; k++) {
          Q[l * 3 + k] += (v[l] * v[k]) / d;
        }
      }
    }

    let dx = Math.abs(w.x - s.x);
    let dy = Math.abs(w.y - s.y);
    if (dx <= 0.5 && dy <= 0.5) {
      path.curve.vertex[i] = point(w.x + x0, w.y + y0);
      continue;
    }

    let min = quadform(Q, s);
    let xmin = s.x;
    let ymin = s.y;

    if (Q[0] !== 0) {
      for (let z = 0; z < 2; z++) {
        w.y = s.y - 0.5 + z;
        w.x = -(Q[1] * w.y + Q[2]) / Q[0];
        dx = Math.abs(w.x - s.x);
        const cand = quadform(Q, w);
        if (dx <= 0.5 && cand < min) {
          min = cand;
          xmin = w.x;
          ymin = w.y;
        }
      }
    }

    if (Q[4] !== 0) {
      for (let z = 0; z < 2; z++) {
        w.x = s.x - 0.5 + z;
        w.y = -(Q[3] * w.x + Q[5]) / Q[4];
        dy = Math.abs(w.y - s.y);
        const cand = quadform(Q, w);
        if (dy <= 0.5 && cand < min) {
          min = cand;
          xmin = w.x;
          ymin = w.y;
        }
      }
    }

    for (let l = 0; l < 2; l++) {
      for (let k = 0; k < 2; k++) {
        w.x = s.x - 0.5 + l;
        w.y = s.y - 0.5 + k;
        const cand = quadform(Q, w);
        if (cand < min) {
          min = cand;
          xmin = w.x;
          ymin = w.y;
        }
      }
    }

    path.curve.vertex[i] = point(xmin + x0, ymin + y0);
  }
}

function reverse(path: TracePath): void {
  const v = path.curve.vertex;
  for (let i = 0, j = path.curve.n - 1; i < j; i++, j--) {
    const tmp = v[i];
    v[i] = v[j];
    v[j] = tmp;
  }
}

/** Turns polygon corners into Bézier segments or sharp corners (Potrace §3.4). */
function smooth(path: TracePath, alphaMax: number): void {
  const curve = path.curve;
  const m = curve.n;

  for (let i = 0; i < m; i++) {
    const j = mod(i + 1, m);
    const k = mod(i + 2, m);
    const p4 = interval(1 / 2, curve.vertex[k], curve.vertex[j]);

    const denom = ddenom(curve.vertex[i], curve.vertex[k]);
    let alpha: number;
    if (denom !== 0) {
      const dd = Math.abs(dpara(curve.vertex[i], curve.vertex[j], curve.vertex[k]) / denom);
      alpha = (dd > 1 ? 1 - 1 / dd : 0) / 0.75;
    } else {
      alpha = 4 / 3;
    }
    curve.alpha0[j] = alpha;

    if (alpha >= alphaMax) {
      curve.tag[j] = 'CORNER';
      curve.c[3 * j + 1] = curve.vertex[j];
      curve.c[3 * j + 2] = p4;
    } else {
      if (alpha < 0.55) alpha = 0.55;
      else if (alpha > 1) alpha = 1;
      curve.tag[j] = 'CURVE';
      curve.c[3 * j + 0] = interval(0.5 + 0.5 * alpha, curve.vertex[i], curve.vertex[j]);
      curve.c[3 * j + 1] = interval(0.5 + 0.5 * alpha, curve.vertex[k], curve.vertex[j]);
      curve.c[3 * j + 2] = p4;
    }
    curve.alpha[j] = alpha;
    curve.beta[j] = 0.5;
  }
}

interface Opti {
  pen: number;
  c: [Point, Point];
  t: number;
  s: number;
  alpha: number;
}

function createOpti(): Opti {
  return { pen: 0, c: [point(), point()], t: 0, s: 0, alpha: 0 };
}

/** Merges runs of Bézier segments that a single segment fits within tolerance (Potrace §3.5). */
function optiCurve(path: TracePath, optTolerance: number): void {
  const curve = path.curve;
  const m = curve.n;
  const vert = curve.vertex;
  const convc = new Array<number>(m);
  const areac = new Array<number>(m + 1);

  function optiPenalty(i: number, j: number, res: Opti): number {
    if (i === j) return 1;

    const i1 = mod(i + 1, m);
    let k = i;
    let k1 = mod(k + 1, m);
    const conv = convc[k1];
    if (conv === 0) return 1;

    let d = ddist(vert[i], vert[i1]);
    for (k = k1; k !== j; k = k1) {
      k1 = mod(k + 1, m);
      const k2 = mod(k + 2, m);
      if (convc[k1] !== conv) return 1;
      if (sign(cprod(vert[i], vert[i1], vert[k1], vert[k2])) !== conv) return 1;
      if (
        iprod1(vert[i], vert[i1], vert[k1], vert[k2]) <
        d * ddist(vert[k1], vert[k2]) * -0.999847695156
      ) {
        return 1;
      }
    }

    const p0 = { ...curve.c[mod(i, m) * 3 + 2] };
    let p1 = { ...vert[mod(i + 1, m)] };
    let p2 = { ...vert[mod(j, m)] };
    const p3 = { ...curve.c[mod(j, m) * 3 + 2] };

    let area = areac[j] - areac[i];
    area -= dpara(vert[0], curve.c[i * 3 + 2], curve.c[j * 3 + 2]) / 2;
    if (i >= j) area += areac[m];

    const A1 = dpara(p0, p1, p2);
    const A2 = dpara(p0, p1, p3);
    const A3 = dpara(p0, p2, p3);
    const A4 = A1 + A3 - A2;
    if (A2 === A1) return 1;

    const t = A3 / (A3 - A4);
    const s = A2 / (A2 - A1);
    const A = (A2 * t) / 2;
    if (A === 0) return 1;

    const R = area / A;
    const alpha = 2 - Math.sqrt(4 - R / 0.3);

    res.c[0] = interval(t * alpha, p0, p1);
    res.c[1] = interval(s * alpha, p3, p2);
    res.alpha = alpha;
    res.t = t;
    res.s = s;

    p1 = { ...res.c[0] };
    p2 = { ...res.c[1] };
    res.pen = 0;

    for (k = mod(i + 1, m); k !== j; k = k1) {
      k1 = mod(k + 1, m);
      const tt = tangent(p0, p1, p2, p3, vert[k], vert[k1]);
      if (tt < -0.5) return 1;
      const pt = bezier(tt, p0, p1, p2, p3);
      d = ddist(vert[k], vert[k1]);
      if (d === 0) return 1;
      const d1 = dpara(vert[k], vert[k1], pt) / d;
      if (Math.abs(d1) > optTolerance) return 1;
      if (iprod(vert[k], vert[k1], pt) < 0 || iprod(vert[k1], vert[k], pt) < 0) return 1;
      res.pen += d1 * d1;
    }

    for (k = i; k !== j; k = k1) {
      k1 = mod(k + 1, m);
      const tt = tangent(p0, p1, p2, p3, curve.c[k * 3 + 2], curve.c[k1 * 3 + 2]);
      if (tt < -0.5) return 1;
      const pt = bezier(tt, p0, p1, p2, p3);
      d = ddist(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2]);
      if (d === 0) return 1;
      let d1 = dpara(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], pt) / d;
      let d2 = dpara(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], vert[k1]) / d;
      d2 *= 0.75 * curve.alpha[k1];
      if (d2 < 0) {
        d1 = -d1;
        d2 = -d2;
      }
      if (d1 < d2 - optTolerance) return 1;
      if (d1 < d2) res.pen += (d1 - d2) * (d1 - d2);
    }
    return 0;
  }

  for (let i = 0; i < m; i++) {
    convc[i] =
      curve.tag[i] === 'CURVE' ? sign(dpara(vert[mod(i - 1, m)], vert[i], vert[mod(i + 1, m)])) : 0;
  }

  let area = 0;
  areac[0] = 0;
  const p0 = curve.vertex[0];
  for (let i = 0; i < m; i++) {
    const i1 = mod(i + 1, m);
    if (curve.tag[i1] === 'CURVE') {
      const alpha = curve.alpha[i1];
      area +=
        (0.3 * alpha * (4 - alpha) * dpara(curve.c[i * 3 + 2], vert[i1], curve.c[i1 * 3 + 2])) / 2;
      area += dpara(p0, curve.c[i * 3 + 2], curve.c[i1 * 3 + 2]) / 2;
    }
    areac[i + 1] = area;
  }

  const pt = new Array<number>(m + 1);
  const pen = new Array<number>(m + 1);
  const len = new Array<number>(m + 1);
  const opt = new Array<Opti>(m + 1);
  let o = createOpti();

  pt[0] = -1;
  pen[0] = 0;
  len[0] = 0;

  for (let j = 1; j <= m; j++) {
    pt[j] = j - 1;
    pen[j] = pen[j - 1];
    len[j] = len[j - 1] + 1;
    for (let i = j - 2; i >= 0; i--) {
      if (optiPenalty(i, mod(j, m), o)) break;
      if (len[j] > len[i] + 1 || (len[j] === len[i] + 1 && pen[j] > pen[i] + o.pen)) {
        pt[j] = i;
        pen[j] = pen[i] + o.pen;
        len[j] = len[i] + 1;
        opt[j] = o;
        o = createOpti();
      }
    }
  }

  const om = len[m];
  const ocurve = createCurve(om);
  const s = new Array<number>(om);
  const t = new Array<number>(om);

  let j = m;
  for (let i = om - 1; i >= 0; i--) {
    const jm = mod(j, m);
    if (pt[j] === j - 1) {
      ocurve.tag[i] = curve.tag[jm];
      ocurve.c[i * 3 + 0] = curve.c[jm * 3 + 0];
      ocurve.c[i * 3 + 1] = curve.c[jm * 3 + 1];
      ocurve.c[i * 3 + 2] = curve.c[jm * 3 + 2];
      ocurve.vertex[i] = curve.vertex[jm];
      ocurve.alpha[i] = curve.alpha[jm];
      ocurve.alpha0[i] = curve.alpha0[jm];
      ocurve.beta[i] = curve.beta[jm];
      s[i] = t[i] = 1;
    } else {
      ocurve.tag[i] = 'CURVE';
      ocurve.c[i * 3 + 0] = opt[j].c[0];
      ocurve.c[i * 3 + 1] = opt[j].c[1];
      ocurve.c[i * 3 + 2] = curve.c[jm * 3 + 2];
      ocurve.vertex[i] = interval(opt[j].s, curve.c[jm * 3 + 2], vert[jm]);
      ocurve.alpha[i] = opt[j].alpha;
      ocurve.alpha0[i] = opt[j].alpha;
      s[i] = opt[j].s;
      t[i] = opt[j].t;
    }
    j = pt[j];
  }

  for (let i = 0; i < om; i++) {
    ocurve.beta[i] = s[i] / (s[i] + t[mod(i + 1, om)]);
  }
  path.curve = ocurve;
}

/** Traces every ink region of the bitmap into a closed Bézier curve. */
export function traceBitmap(
  bitmap: BinaryBitmap,
  options: Partial<PotraceParams> = {},
): TracedPath[] {
  const params = { ...DEFAULT_POTRACE_PARAMS, ...options };
  if (bitmap.data.length !== bitmap.width * bitmap.height) {
    throw new Error('Bitmap data length does not match width × height.');
  }
  return bitmapToPathList(bitmap, params).map((path) => {
    calcSums(path);
    calcLon(path);
    bestPolygon(path);
    adjustVertices(path);
    if (path.sign === '-') reverse(path);
    smooth(path, params.alphaMax);
    if (params.optCurve) optiCurve(path, params.optTolerance);
    return { sign: path.sign, area: path.area, curve: path.curve };
  });
}

function fixed(value: number): string {
  return value.toFixed(3).replace('.000', '');
}

/** Renders one closed curve as SVG path data, scaling coordinates by `scale`. */
export function curveToPathData(curve: Curve, scale = 1): string {
  const start = curve.c[(curve.n - 1) * 3 + 2];
  const parts = [`M ${fixed(start.x * scale)} ${fixed(start.y * scale)}`];
  for (let i = 0; i < curve.n; i++) {
    const p0 = curve.c[i * 3];
    const p1 = curve.c[i * 3 + 1];
    const p2 = curve.c[i * 3 + 2];
    if (curve.tag[i] === 'CURVE') {
      parts.push(
        `C ${fixed(p0.x * scale)} ${fixed(p0.y * scale)}, ${fixed(p1.x * scale)} ${fixed(p1.y * scale)}, ${fixed(p2.x * scale)} ${fixed(p2.y * scale)}`,
      );
    } else {
      parts.push(
        `L ${fixed(p1.x * scale)} ${fixed(p1.y * scale)} ${fixed(p2.x * scale)} ${fixed(p2.y * scale)}`,
      );
    }
  }
  parts.push('Z');
  return parts.join(' ');
}
