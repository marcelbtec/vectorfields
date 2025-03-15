/*
 * Vector-Field-Visualizer - A tool for visualizing vector fields
 * PhasePortrait component with unified color logic
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// ---------- Color Logic Matching Fragment Shader ----------

// Converts HSV to RGB (same logic as hsv2rgb in your fragment shader).
function hsv2rgb(h, s, v) {
  const K = [1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0];
  const p = [
    Math.abs(((h + K[1]) * 6.0) % 6.0 - K[3]),
    Math.abs(((h + K[2]) * 6.0) % 6.0 - K[3]),
    Math.abs(((h + 0.0)  * 6.0) % 6.0 - K[3])
  ];
  const rgb = [
    clampMix(K[0], clamp(p[0] - K[0], 0.0, 1.0), s),
    clampMix(K[0], clamp(p[1] - K[0], 0.0, 1.0), s),
    clampMix(K[0], clamp(p[2] - K[0], 0.0, 1.0), s)
  ].map(val => val * v);
  return rgb;
}

function clamp(value, minVal, maxVal) {
  return Math.max(minVal, Math.min(maxVal, value));
}

// A helper to mimic `mix()` from GLSL in JavaScript
function mix(a, b, t) {
  return a + (b - a) * t;
}

// A helper that mimics `c.z * mix(K.xxx, clamp(...), c.y)`
function clampMix(base, comp, s) {
  return base + (comp - base) * s;
}

// Use the same color logic from the fragment shader.
function getOceanColor(angle, alpha) {
  // hue: [0.55, 0.65], saturation ~0.8, value=1.0
  const hue = mix(0.55, 0.65, angle);
  const rgb = hsv2rgb(hue, 0.8, 1.0);
  return toRgba(rgb, alpha);
}

function getFireColor(angle, alpha) {
  // hue: [0.0, 0.08], s=1.0, v=1.0
  const hue = mix(0.0, 0.08, angle);
  const rgb = hsv2rgb(hue, 1.0, 1.0);
  return toRgba(rgb, alpha);
}

function getRainbowColor(angle, alpha) {
  // hue = angle, s=1.0, v=1.0
  const rgb = hsv2rgb(angle, 1.0, 1.0);
  return toRgba(rgb, alpha);
}

function getGrayscaleColor(angle, alpha) {
  // brightness: [0.2..1.0] with a sin-based mapping
  const value = mix(0.2, 1.0, Math.abs(Math.sin(angle * 3.14159265)));
  return toRgba([value, value, value], alpha);
}

function getVelocityColor(magnitude, alpha) {
  // normalized ~ [0..1], hue from 0.6 to 0.0
  const normalized = clamp(magnitude / 10.0, 0.0, 1.0);
  const hue = mix(0.6, 0.0, normalized);
  const baseColor = hsv2rgb(hue, 1.0, 1.0);
  const brightnessFactor = mix(1.0, 1.6, normalized);
  const brightened = baseColor.map(c => clamp(c * brightnessFactor, 0.0, 1.0));
  return toRgba(brightened, alpha);
}

function getCustomColor(customRgb, alpha) {
  return toRgba(customRgb, alpha);
}

// Convert an [r, g, b] array in [0..1] plus alpha to CSS rgba string
function toRgba(rgb, alpha) {
  const r = clamp(rgb[0], 0.0, 1.0) * 255;
  const g = clamp(rgb[1], 0.0, 1.0) * 255;
  const b = clamp(rgb[2], 0.0, 1.0) * 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Main color function for PhasePortrait
function getPhaseColor(colorScheme, vx, vy, alpha, magnitude) {
  // angle ~ [0..1]
  let angle = Math.atan2(vy, vx);
  angle = angle * 0.5 + 0.5;

  // Additional universal brightness factor for PhasePortrait lines
  const lineAlpha = alpha; // could also do alpha * 1.2 if you want them more opaque

  switch (colorScheme.name.toLowerCase()) {
    case 'ocean':
      return getOceanColor(angle, lineAlpha);
    case 'fire':
      return getFireColor(angle, lineAlpha);
    case 'rainbow':
      return getRainbowColor(angle, lineAlpha);
    case 'grayscale':
      return getGrayscaleColor(angle, lineAlpha);
    case 'velocity':
      return getVelocityColor(magnitude, lineAlpha);
    case 'custom':
      // colorScheme.custom is {r, g, b} in [0..255]
      const customRgb = [
        (colorScheme.custom?.r || 255) / 255,
        (colorScheme.custom?.g || 255) / 255,
        (colorScheme.custom?.b || 255) / 255
      ];
      return getCustomColor(customRgb, lineAlpha);
    default:
      // fallback
      return getVelocityColor(magnitude, lineAlpha);
  }
}

//
// ---------- PhasePortrait Component ----------
//
const PhasePortrait = ({
  dx, dy,
  xMin, xMax, yMin, yMax,
  a, b,
  colorScheme,
  backgroundColor = '#000000',
  size = 300
}) => {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: size, height: size });
  const isMounted = useRef(true);

  const safeSetError = useCallback((errorMessage) => {
    if (isMounted.current) {
      setError(errorMessage);
    }
  }, []);

  const updateCanvasSize = useCallback(() => {
    setCanvasSize({ width: size, height: size });
  }, [size]);

  useEffect(() => {
    updateCanvasSize();
    return () => {
      isMounted.current = false;
    };
  }, [updateCanvasSize]);

  // Basic expression evaluator, same as before
  const evaluateExpression = useMemo(() => {
    return (expr, x, y, a, b) => {
      try {
        const cleanExpr = expr.trim().replace(/;+$/, '');
        if (cleanExpr === '') {
          throw new Error('Empty expression');
        }
        const parse = (str) => {
          const tokens = str.match(/(\d+\.?\d*|\+|-|\*|\/|\(|\)|\^|[a-zA-Z]+)/g) || [];
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
              if (pos < tokens.length && tokens[pos] === ')') {
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
          return result;
        };
        
        const result = parse(cleanExpr);
        if (typeof result !== 'number' || !isFinite(result)) {
          throw new Error('Expression did not evaluate to a finite number');
        }
        return result;
      } catch (err) {
        console.error("Error evaluating expression:", err);
        safeSetError(`Invalid expression: ${expr}. Error: ${err.message}`);
        return 0;
      }
    };
  }, [safeSetError]);

  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;
  
    safeSetError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;
  
    canvas.width = width;
    canvas.height = height;
  
    // Fill the background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  
    const numTrajectories = 30;
    const numSteps = 1100;
    const dt = 0.01;
  
    let successfulEvaluation = false;
  
    // Map system coords to canvas coords
    const mapToCanvas = (x, y) => [
      (x - xMin) / (xMax - xMin) * width,
      height - (y - yMin) / (yMax - yMin) * height
    ];
  
    for (let i = 0; i < numTrajectories; i++) {
      for (let j = 0; j < numTrajectories; j++) {
        let x = xMin + (i / (numTrajectories - 1)) * (xMax - xMin);
        let y = yMin + (j / (numTrajectories - 1)) * (yMax - yMin);
  
        ctx.beginPath();
        let [canvasX, canvasY] = mapToCanvas(x, y);
        ctx.moveTo(canvasX, canvasY);
  
        let vx = 0, vy = 0;
        for (let step = 0; step < numSteps; step++) {
          try {
            vx = evaluateExpression(dx, x, y, a, b);
            vy = evaluateExpression(dy, x, y, a, b);
            if (isFinite(vx) && isFinite(vy)) {
              successfulEvaluation = true;
            } else {
              break;
            }
          } catch (err) {
            break;
          }
  
          x += vx * dt;
          y += vy * dt;
  
          [canvasX, canvasY] = mapToCanvas(x, y);
          ctx.lineTo(canvasX, canvasY);
  
          // Stop if trajectory leaves the bounds
          if (x < xMin || x > xMax || y < yMin || y > yMax) break;
        }
  
        // Use the same color logic as the vector field
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        // alpha ~ 0.8 for lines
        const strokeColor = getPhaseColor(colorScheme, vx, vy, 0.8, magnitude);
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
      }
    }
  
    if (successfulEvaluation) {
      safeSetError(null);
    } else {
      console.log(`No successful evaluations. dx="${dx}", dy="${dy}", a=${a}, b=${b}`);
      safeSetError("No valid trajectories. Check your equations.");
    }
  
  }, [
    dx, dy, xMin, xMax, yMin, yMax, a, b,
    canvasSize, evaluateExpression, colorScheme, backgroundColor, safeSetError
  ]);

  return (
    <div
      className="canvas-container"
      style={{ 
        position: 'absolute',
        top: '100px',
        right: '220px',
        width: size,
        height: size,
        backgroundColor: backgroundColor || '#000000',
        border: '1px solid #ffffff',
        borderRadius: '5px',
        overflow: 'hidden'
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      {error && (
        <div
          style={{
            color: 'red',
            fontSize: '10px',
            position: 'absolute',
            bottom: '5px',
            left: '50px'
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default PhasePortrait;
