/*
 * Vector-Field-Visualizer - A tool for visualizing vector fields
 * Copyright (C) 2024 Marcel Blattner, blattnem@gmail.com
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

const VectorFieldVisualization = ({ dx, dy, xMin, xMax, yMin, yMax, a, b, colorScheme, backgroundColor = '#000000', onGenerateRandomSystem, traceMode }) => {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isMounted = useRef(true);
  const particlesRef = useRef([]);
  const tracedParticlesRef = useRef([]);
  const dt = 0.01; 

  useEffect(() => {
    if (traceMode) {
      tracedParticlesRef.current = Array(50).fill().map(() => ({
        x: xMin + Math.random() * (xMax - xMin),
        y: yMin + Math.random() * (yMax - yMin),
        history: []
      }));
    } else {
      tracedParticlesRef.current = [];
    }
  }, [traceMode, xMin, xMax, yMin, yMax]);

  const safeSetError = useCallback((errorMessage) => {
    if (isMounted.current) {
      setError(errorMessage);
    }
  }, []);

  const updateCanvasSize = useCallback(() => {
    const padding = 15;
    const newWidth = window.innerWidth - padding * 2;
    const newHeight = window.innerHeight - 80;

    setCanvasSize({ width: newWidth, height: newHeight });
  }, []);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [updateCanvasSize]);

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
            if (pos >= tokens.length) {
              throw new Error('Unexpected end of expression');
            }
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
            if (pos >= tokens.length) {
              throw new Error('Unexpected end of expression');
            }
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

  const updateParticles = useCallback(() => {
    const updatedParticles = new Float32Array(particlesRef.current.length);
    
    for (let i = 0; i < particlesRef.current.length; i += 3) {
      const x = particlesRef.current[i];
      const y = particlesRef.current[i + 1];
      const age = particlesRef.current[i + 2];
      let vx, vy;
      try {
        vx = evaluateExpression(dx, x, y, a, b);
        vy = evaluateExpression(dy, x, y, a, b);
        if (isFinite(vx) && isFinite(vy)) {
          const magnitude = Math.sqrt(vx * vx + vy * vy);
          const scaleFactor = 2 / (1 + magnitude);
          
          updatedParticles[i] = x + vx * scaleFactor * dt;
          updatedParticles[i + 1] = y + vy * scaleFactor * dt;
          updatedParticles[i + 2] = age + 1;
        } else {
          updatedParticles[i] = x;
          updatedParticles[i + 1] = y;
          updatedParticles[i + 2] = age;
        }
      } catch (err) {
        updatedParticles[i] = x;
        updatedParticles[i + 1] = y;
        updatedParticles[i + 2] = age;
      }
    }
    
    particlesRef.current = updatedParticles;
  }, [dx, dy, a, b, evaluateExpression, dt]);

  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    safeSetError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;

    canvas.width = width;
    canvas.height = height;

    const particleCount = 12000;
    const maxAge = 300;
    const fadeInDuration = 30;
    const fadeOutDuration = 30;
    const maxVisibleAge = maxAge - fadeOutDuration;
    const dt = 0.01;

    // Initialize particles if they don't exist
    if (particlesRef.current.length === 0) {
      particlesRef.current = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current[i * 3] = xMin + Math.random() * (xMax - xMin);
        particlesRef.current[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
        particlesRef.current[i * 3 + 2] = Math.random() * maxAge;
      }
    }

    let animationFrameId;
    let frame = 0;

    function animate() {
      if (!isMounted.current) return;
    
      ctx.fillStyle = `rgba(${parseInt(backgroundColor.slice(1, 3), 16)}, ${parseInt(backgroundColor.slice(3, 5), 16)}, ${parseInt(backgroundColor.slice(5, 7), 16)}, 0.1)`;
      ctx.fillRect(0, 0, width, height);
    
      let successfulEvaluation = false;
    
      updateParticles();
    
      // Render particles
      for (let i = 0; i < particlesRef.current.length / 3; i++) {
        const x = particlesRef.current[i * 3];
        const y = particlesRef.current[i * 3 + 1];
        const age = particlesRef.current[i * 3 + 2];
    
        let vx, vy;
        try {
          vx = evaluateExpression(dx, x, y, a, b);
          vy = evaluateExpression(dy, x, y, a, b);
          if (isFinite(vx) && isFinite(vy)) {
            successfulEvaluation = true;
          } else {
            continue;
          }
        } catch (err) {
          continue;
        }
    
        const magnitude = Math.sqrt(vx * vx + vy * vy);
    
        // Calculate alpha based on particle age
        let alpha;
        if (age <= fadeInDuration) {
          alpha = age / fadeInDuration;
        } else if (age > maxVisibleAge) {
          alpha = (maxAge - age) / fadeOutDuration;
        } else {
          alpha = 1;
        }
    
        // Smooth transition for particles leaving the system bounds
        if (x < xMin || x > xMax || y < yMin || y > yMax) {
          alpha *= 0.95;
        }
    
        alpha = Math.max(0, Math.min(1, alpha));
    
        const canvasX = ((x - xMin) / (xMax - xMin)) * width;
        const canvasY = height - ((y - yMin) / (yMax - yMin)) * height;
    
        // Check if canvasX and canvasY are finite before drawing
        if (!isFinite(canvasX) || !isFinite(canvasY)) {
          continue;
        }
    
        const color = colorScheme.getColor(Math.atan2(vy, vx), alpha, magnitude);
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 1.5, 0, Math.PI * 1.5);
        ctx.fillStyle = color;
        ctx.fill();
    
        // Only create gradient if all values are finite
        if (isFinite(canvasX) && isFinite(canvasY)) {
          try {
            const gradient = ctx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, 4);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(canvasX - 4, canvasY - 4, 8, 8);
          } catch (err) {
            console.error("Error creating gradient:", err);
            // Fallback to solid color if gradient creation fails
            ctx.fillStyle = color;
            ctx.fillRect(canvasX - 4, canvasY - 4, 8, 8);
          }
        }
    
        // Stagger particle reinitialization
        if (age > maxAge || alpha <= 0.01) {
          if (frame % 10 === i % 10) { // Reinitialize only a subset of particles each frame
            particlesRef.current[i * 3] = xMin + Math.random() * (xMax - xMin);
            particlesRef.current[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
            particlesRef.current[i * 3 + 2] = 0;
          }
        }
      }

      // Handle traced particles
      if (traceMode) {
        tracedParticlesRef.current = tracedParticlesRef.current.map(particle => {
          let vx, vy;
          try {
            vx = evaluateExpression(dx, particle.x, particle.y, a, b);
            vy = evaluateExpression(dy, particle.x, particle.y, a, b);
          } catch (err) {
            return particle;
          }
      
          const magnitude = Math.sqrt(vx * vx + vy * vy);
          const scaleFactor = 2 / (1 + magnitude);
          
          const newX = particle.x + vx * scaleFactor * dt;
          const newY = particle.y + vy * scaleFactor * dt;
      
          const canvasX = ((newX - xMin) / (xMax - xMin)) * width;
          const canvasY = height - ((newY - yMin) / (yMax - yMin)) * height;
      
          return {
            x: newX,
            y: newY,
            history: [...particle.history, {x: canvasX, y: canvasY}].slice(-100)  // Keep last 100 points
          };
        });

        // Render traced particles
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        tracedParticlesRef.current.forEach(particle => {
          if (particle.history.length > 1) {
            ctx.beginPath();
            ctx.moveTo(particle.history[0].x, particle.history[0].y);
            particle.history.forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
        });
      }
    
      if (successfulEvaluation) {
        safeSetError(null);
      } else {
        console.log(`No successful evaluations. dx="${dx}", dy="${dy}", a=${a}, b=${b}`);
        safeSetError("No valid particles. Check your equations.");
      }
    
      frame++;
      animationFrameId = requestAnimationFrame(animate);
    }

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [dx, dy, xMin, xMax, yMin, yMax, a, b, canvasSize, evaluateExpression, colorScheme, backgroundColor, safeSetError, traceMode, updateParticles]);

  const clearTraces = () => {
    tracedParticlesRef.current = [];
  };

  return (
    <div className="canvas-container" style={{ 
      position: 'relative', 
      width: canvasSize.width, 
      height: canvasSize.height, 
      backgroundColor: backgroundColor || '#000000'
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      {error && <div style={{ color: 'red', marginTop: '10px', position: 'absolute', top: '100%' }}>{error}</div>}
      <button 
        onClick={onGenerateRandomSystem}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '10px',
          backgroundColor: '#4c5caf',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Generate Random System
      </button>
      {traceMode && (
        <button 
          onClick={clearTraces}
          style={{
            position: 'absolute',
            top: '10px',
            right: '200px',
            padding: '10px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Clear Traces
        </button>
      )}
    </div>
  );
};

export default VectorFieldVisualization;