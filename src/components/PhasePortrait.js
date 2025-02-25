/*
 * Vector-Field-Visualizer - A tool for visualizing vector fields
 * Copyright (C) 2024 Marcel Blattner
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

const PhasePortrait = ({ dx, dy, xMin, xMax, yMin, yMax, a, b, colorScheme, backgroundColor = '#000000', size = 300 }) => {
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

  const evaluateExpression = useMemo(() => {
    return (expr, x, y, a, b) => {
      try {
        const cleanExpr = expr.trim().replace(/;+$/, '');
        
        if (cleanExpr === '') {
          throw new Error('Empty expression');
        }
        
        const parse = (str) => {
          const tokens = str.match(/(\d+\.?\d*|\+|\-|\*|\/|\(|\)|\^|[a-zA-Z]+)/g) || [];
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
  
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  
    const numTrajectories = 30;
    const numSteps = 1100;
    const dt = 0.01;
  
    let successfulEvaluation = false;
  
    // Function to map system coordinates to canvas coordinates
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
  
          // If the trajectory goes out of bounds, stop drawing
          if (x < xMin || x > xMax || y < yMin || y > yMax) break;
        }
  
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        const color = colorScheme.getColor(Math.atan2(vy, vx), 0.8, magnitude);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    }
  
    if (successfulEvaluation) {
      safeSetError(null);
    } else {
      console.log(`No successful evaluations. dx="${dx}", dy="${dy}", a=${a}, b=${b}`);
      safeSetError("No valid trajectories. Check your equations.");
    }
  
  }, [dx, dy, xMin, xMax, yMin, yMax, a, b, canvasSize, evaluateExpression, colorScheme, backgroundColor, safeSetError]);

  return (
    <div className="canvas-container" style={{ 
      position: 'absolute',
      top: '100px',
      right: '220px',
      width: size,
      height: size,
      backgroundColor: backgroundColor || '#000000',
      border: '1px solid #ffffff',
      borderRadius: '5px',
      overflow: 'hidden'
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      {error && <div style={{ color: 'red', fontSize: '10px', position: 'absolute', bottom: '5px', left: '50px' }}>{error}</div>}
    </div>
  );
};

export default PhasePortrait;