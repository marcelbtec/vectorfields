import React, { useMemo } from 'react';

const GRID_SIZE = 25;
const MAX_SEEDS = 200;
const MAX_REFINEMENT_STEPS = 12;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const createEvaluator = (expr) => {
  const cleanExpr = expr.trim().replace(/;+$/, '');
  if (cleanExpr === '') {
    throw new Error('Empty expression');
  }
  const tokens = cleanExpr.match(/(\d+\.?\d*|\+|-|\*|\/|\(|\)|\^|[a-zA-Z]+)/g) || [];
  return (x, y, a, b) => {
    let pos = 0;

    const parseExpression = () => {
      let left = parseTerm();
      while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
        const op = tokens[pos++];
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseTerm = () => {
      let left = parseFactor();
      while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
        const op = tokens[pos++];
        const right = parseFactor();
        left = op === '*' ? left * right : left / right;
      }
      return left;
    };

    const parseFactor = () => {
      let left = parseBase();
      if (pos < tokens.length && tokens[pos] === '^') {
        pos++;
        const right = parseFactor();
        return Math.pow(left, right);
      }
      return left;
    };

    const parseBase = () => {
      if (tokens[pos] === '(') {
        pos++;
        const result = parseExpression();
        if (tokens[pos] === ')') {
          pos++;
        } else {
          throw new Error('Mismatched parentheses');
        }
        return result;
      }
      if (tokens[pos] === '-') {
        pos++;
        return -parseFactor();
      }
      if (isNaN(tokens[pos])) {
        const token = tokens[pos++];
        if (token === 'x') return x;
        if (token === 'y') return y;
        if (token === 'a') return a;
        if (token === 'b') return b;
        if (token === 'sin') return Math.sin(parseFactor());
        if (token === 'cos') return Math.cos(parseFactor());
        if (token === 'tan') return Math.tan(parseFactor());
        if (token === 'exp') return Math.exp(parseFactor());
        if (token === 'sqrt') return Math.sqrt(parseFactor());
        throw new Error(`Unknown token: ${token}`);
      }
      return parseFloat(tokens[pos++]);
    };

    const result = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[pos]}`);
    }
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Expression did not evaluate to a finite number');
    }
    return result;
  };
};

const computeJacobian = (x, y, fx, fy, a, b, h) => {
  const fxp = fx(x + h, y, a, b);
  const fxm = fx(x - h, y, a, b);
  const fyp = fx(x, y + h, a, b);
  const fym = fx(x, y - h, a, b);
  const gxp = fy(x + h, y, a, b);
  const gxm = fy(x - h, y, a, b);
  const gyp = fy(x, y + h, a, b);
  const gym = fy(x, y - h, a, b);

  const dfdx = (fxp - fxm) / (2 * h);
  const dfdy = (fyp - fym) / (2 * h);
  const dgdx = (gxp - gxm) / (2 * h);
  const dgdy = (gyp - gym) / (2 * h);

  if (![dfdx, dfdy, dgdx, dgdy].every(Number.isFinite)) {
    return null;
  }

  return { a: dfdx, b: dfdy, c: dgdx, d: dgdy };
};

const computeEigenvalues = (jacobian) => {
  if (!jacobian) return null;
  const { a, b, c, d } = jacobian;
  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;

  if (!Number.isFinite(trace) || !Number.isFinite(det) || !Number.isFinite(disc)) {
    return null;
  }

  if (disc >= 0) {
    const sqrtDisc = Math.sqrt(disc);
    return [
      { re: (trace + sqrtDisc) / 2, im: 0 },
      { re: (trace - sqrtDisc) / 2, im: 0 }
    ];
  }

  const real = trace / 2;
  const imag = Math.sqrt(-disc) / 2;
  return [
    { re: real, im: imag },
    { re: real, im: -imag }
  ];
};

const classifyFixedPoint = (jacobian, eigenvalues) => {
  if (!jacobian || !eigenvalues) return 'indeterminate';
  const { a, b, c, d } = jacobian;
  const det = a * d - b * c;
  if (!Number.isFinite(det)) return 'indeterminate';
  const eps = 1e-6;
  if (det < -eps) return 'saddle (unstable)';

  const [lambda1, lambda2] = eigenvalues;
  const re1 = lambda1.re;
  const re2 = lambda2.re;
  const im1 = lambda1.im;

  if (Math.abs(im1) > eps) {
    if (re1 < -eps) return 'stable spiral';
    if (re1 > eps) return 'unstable spiral';
    return 'center';
  }

  if (re1 < -eps && re2 < -eps) return 'stable node';
  if (re1 > eps && re2 > eps) return 'unstable node';
  if (Math.abs(re1) <= eps && Math.abs(re2) <= eps) return 'degenerate';
  return 'indeterminate';
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return 'NaN';
  return value.toFixed(4);
};

const formatEigen = (eig) => {
  if (!eig) return 'NaN';
  if (Math.abs(eig.im) <= 1e-6) {
    return formatNumber(eig.re);
  }
  const sign = eig.im >= 0 ? '+' : '-';
  return `${formatNumber(eig.re)} ${sign} ${formatNumber(Math.abs(eig.im))}i`;
};

const refineSeed = (seed, fx, fy, a, b, bounds, h, tol) => {
  let x = seed.x;
  let y = seed.y;
  const range = Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin);
  const maxStep = range * 0.25;

  for (let step = 0; step < MAX_REFINEMENT_STEPS; step++) {
    const fxv = fx(x, y, a, b);
    const fyv = fy(x, y, a, b);
    if (!Number.isFinite(fxv) || !Number.isFinite(fyv)) return null;
    if (Math.hypot(fxv, fyv) < tol) {
      return { x, y };
    }
    const jacobian = computeJacobian(x, y, fx, fy, a, b, h);
    if (!jacobian) return null;
    const det = jacobian.a * jacobian.d - jacobian.b * jacobian.c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;

    let dxStep = -(jacobian.d * fxv - jacobian.b * fyv) / det;
    let dyStep = -(-jacobian.c * fxv + jacobian.a * fyv) / det;
    if (!Number.isFinite(dxStep) || !Number.isFinite(dyStep)) return null;

    const stepSize = Math.hypot(dxStep, dyStep);
    if (stepSize > maxStep) {
      const scale = maxStep / stepSize;
      dxStep *= scale;
      dyStep *= scale;
    }

    x += dxStep;
    y += dyStep;

    if (x < bounds.xMin - range || x > bounds.xMax + range ||
        y < bounds.yMin - range || y > bounds.yMax + range) {
      return null;
    }
  }

  return null;
};

const computeFixedPoints = ({ dx, dy, xMin, xMax, yMin, yMax, a, b }) => {
  let fx;
  let fy;

  try {
    fx = createEvaluator(dx);
    fy = createEvaluator(dy);
  } catch (error) {
    return { points: [], error: error.message };
  }

  const rangeX = xMax - xMin;
  const rangeY = yMax - yMin;
  if (!(rangeX > 0) || !(rangeY > 0)) {
    return { points: [], error: 'Invalid bounds.' };
  }

  const seeds = [];
  let maxMag = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const x = xMin + (i / (GRID_SIZE - 1)) * rangeX;
      const y = yMin + (j / (GRID_SIZE - 1)) * rangeY;
      const fxv = fx(x, y, a, b);
      const fyv = fy(x, y, a, b);
      if (!Number.isFinite(fxv) || !Number.isFinite(fyv)) continue;
      const mag = Math.hypot(fxv, fyv);
      if (mag > maxMag) maxMag = mag;
      seeds.push({ x, y, mag });
    }
  }

  if (maxMag < 1e-8) {
    return {
      points: [],
      note: 'Vector field is near zero across the bounds; fixed points are not isolated.'
    };
  }

  const threshold = Math.max(1e-3, maxMag * 0.02);
  const candidateSeeds = seeds
    .filter(seed => seed.mag <= threshold)
    .sort((aSeed, bSeed) => aSeed.mag - bSeed.mag)
    .slice(0, MAX_SEEDS);

  if (candidateSeeds.length === 0) {
    return {
      points: [],
      note: 'No candidate fixed points found in the current bounds.'
    };
  }

  const range = Math.max(rangeX, rangeY);
  const mergeTol = Math.max(1e-4, range * 0.01);
  const h = Math.max(1e-4, range * 1e-4);
  const tol = clamp(maxMag * 1e-4, 1e-6, 1e-2);
  const points = [];
  const bounds = { xMin, xMax, yMin, yMax };

  candidateSeeds.forEach(seed => {
    const refined = refineSeed(seed, fx, fy, a, b, bounds, h, tol);
    if (!refined) return;
    if (refined.x < xMin || refined.x > xMax || refined.y < yMin || refined.y > yMax) return;

    const alreadyFound = points.some(point => {
      const dx = point.x - refined.x;
      const dy = point.y - refined.y;
      return Math.hypot(dx, dy) <= mergeTol;
    });
    if (alreadyFound) return;

    const jacobian = computeJacobian(refined.x, refined.y, fx, fy, a, b, h);
    const eigenvalues = computeEigenvalues(jacobian);
    points.push({
      x: refined.x,
      y: refined.y,
      jacobian,
      eigenvalues,
      stability: classifyFixedPoint(jacobian, eigenvalues)
    });
  });

  return {
    points,
    gridSize: GRID_SIZE,
    candidateCount: candidateSeeds.length,
    note: points.length === 0 ? 'No fixed points found in the current bounds.' : null
  };
};

const FixedPointOverlay = ({
  dx,
  dy,
  xMin,
  xMax,
  yMin,
  yMax,
  a,
  b,
  onClose
}) => {
  const analysis = useMemo(
    () => computeFixedPoints({ dx, dy, xMin, xMax, yMin, yMax, a, b }),
    [dx, dy, xMin, xMax, yMin, yMax, a, b]
  );

  return (
    <div className="analysis-overlay" role="dialog" aria-label="Fixed point analysis">
      <div className="analysis-header">
        <span>Fixed Point Analysis</span>
        <button className="analysis-close" onClick={onClose} aria-label="Close analysis">×</button>
      </div>
      <div className="analysis-body">
        {analysis.error && (
          <div className="analysis-error">{analysis.error}</div>
        )}
        {!analysis.error && analysis.note && (
          <div className="analysis-note">{analysis.note}</div>
        )}
        {!analysis.error && analysis.points.length > 0 && (
          <div className="analysis-meta">
            Grid {analysis.gridSize}×{analysis.gridSize} · candidates {analysis.candidateCount}
          </div>
        )}
        {!analysis.error && analysis.points.map((point, index) => {
          const jacobian = point.jacobian;
          const eigenvalues = point.eigenvalues || [];
          return (
            <div className="analysis-card" key={`fixed-point-${index}`}>
              <div className="analysis-title">Fixed point {index + 1}</div>
              <div className="analysis-row">
                <span>(x*, y*)</span>
                <span>({formatNumber(point.x)}, {formatNumber(point.y)})</span>
              </div>
              <div className="analysis-row">
                <span>Stability</span>
                <span>{point.stability}</span>
              </div>
              <div className="analysis-row">
                <span>Eigenvalues</span>
                <span>
                  {eigenvalues.length === 2
                    ? `${formatEigen(eigenvalues[0])}, ${formatEigen(eigenvalues[1])}`
                    : 'N/A'}
                </span>
              </div>
              <div className="analysis-row">
                <span>Jacobian</span>
                <span>
                  {jacobian
                    ? `[[${formatNumber(jacobian.a)}, ${formatNumber(jacobian.b)}], [${formatNumber(jacobian.c)}, ${formatNumber(jacobian.d)}]]`
                    : 'N/A'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FixedPointOverlay;
