import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

const VectorFieldVisualization = ({ dx, dy, xMin, xMax, yMin, yMax, a, b, colorScheme, backgroundColor = '#000000', onGenerateRandomSystem, traceMode }) => {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const [error, setError] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isMounted = useRef(true);
  const particlesRef = useRef(null);
  const tracedParticlesRef = useRef([]);
  const dt = 0.01;

  // WebGL helper functions
  const helpers = useMemo(() => ({
    createShader: (gl, type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    },

    createProgram: (gl, vertexSource, fragmentSource) => {
      const vertexShader = helpers.createShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = helpers.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      
      if (!vertexShader || !fragmentShader) return null;
      
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      
      return program;
    }
  }), []);

  const shaderSources = useMemo(() => ({
    vertex: `
      attribute vec2 a_position;
      attribute float a_age;
      attribute vec2 a_velocity;
      
      uniform vec2 u_resolution;
      uniform vec4 u_bounds;
      uniform float u_maxAge;
      uniform float u_fadeInDuration;
      uniform float u_fadeOutDuration;
      
      varying vec2 v_velocity;
      varying float v_alpha;
      varying float v_magnitude;
      
      void main() {
        vec2 normalizedPosition = (a_position - u_bounds.xy) / (u_bounds.zw - u_bounds.xy);
        vec2 clipSpace = (normalizedPosition * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
        
        v_magnitude = length(a_velocity);
        gl_PointSize = 3.0;
        
        v_velocity = a_velocity;
        
        float maxVisibleAge = u_maxAge - u_fadeOutDuration;
        if (a_age <= u_fadeInDuration) {
          v_alpha = a_age / u_fadeInDuration;
        } else if (a_age > maxVisibleAge) {
          v_alpha = (u_maxAge - a_age) / u_fadeOutDuration;
        } else {
          v_alpha = 1.0;
        }
        
        vec2 pos = a_position;
        if (pos.x < u_bounds.x || pos.x > u_bounds.z || 
            pos.y < u_bounds.y || pos.y > u_bounds.w) {
          v_alpha *= 0.95;
        }
        
        v_alpha = clamp(v_alpha, 0.0, 1.0);
      }
    `,
    fragment: `
      precision mediump float;
      
      varying vec2 v_velocity;
      varying float v_alpha;
      varying float v_magnitude;
      
      uniform int u_colorScheme;
      uniform vec3 u_customColor;
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      vec4 getOceanColor(float angle, float alpha) {
        float hue = 0.5 + angle * (60.0/180.0);
        return vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), alpha);
      }
      
      vec4 getFireColor(float angle, float alpha) {
        float hue = angle * (60.0/180.0);
        return vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), alpha);
      }
      
      vec4 getRainbowColor(float angle, float alpha) {
        float hue = angle * (180.0/180.0);
        return vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), alpha);
      }
      
      vec4 getGrayscaleColor(float angle, float alpha) {
        float value = abs(sin(angle));
        return vec4(value, value, value, alpha);
      }
      
      vec4 getVelocityColor(float magnitude, float alpha) {
        float hue = magnitude * (240.0/360.0);
        return vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), alpha);
      }
      
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        
        if (dist > 0.5) {
          discard;
        }
        
        float angle = atan(v_velocity.y, v_velocity.x);
        angle = angle * 0.5 + 0.5; // normalize to [0,1]
        
        vec4 color;
        if (u_colorScheme == 0) { // ocean
          color = getOceanColor(angle, v_alpha);
        } else if (u_colorScheme == 1) { // fire
          color = getFireColor(angle, v_alpha);
        } else if (u_colorScheme == 2) { // rainbow
          color = getRainbowColor(angle, v_alpha);
        } else if (u_colorScheme == 3) { // grayscale
          color = getGrayscaleColor(angle, v_alpha);
        } else { // velocity
          color = getVelocityColor(v_magnitude, v_alpha);
        }
        
        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(color.rgb, color.a * glow);
      }
    `
  }), []);

  const getColorSchemeUniform = useCallback((schemeName) => {
    switch(schemeName) {
      case 'ocean': return 0;
      case 'fire': return 1;
      case 'rainbow': return 2;
      case 'grayscale': return 3;
      case 'velocity': return 4;
      default: return 2; // rainbow as default
    }
  }, []);

  const evaluateExpression = useMemo(() => {
    const cache = new Map();
    
    return (expr, x, y, a, b) => {
      try {
        const cacheKey = `${expr}_${x.toFixed(3)}_${y.toFixed(3)}_${a}_${b}`;
        if (cache.has(cacheKey)) return cache.get(cacheKey);

        const cleanExpr = expr.trim().replace(/;+$/, '');
        if (cleanExpr === '') throw new Error('Empty expression');
        
        const tokens = cleanExpr.match(/(\d+\.?\d*|\+|-|\*|\/|\(|\)|\^|[a-zA-Z]+)/g) || [];
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
            if (tokens[pos] === ')') pos++;
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
        if (cache.size > 1000) cache.clear();
        if (isFinite(result)) {
          cache.set(cacheKey, result);
          return result;
        }
        return 0;
      } catch (err) {
        console.error("Error evaluating expression:", err);
        return 0;
      }
    };
  }, []);
  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    
    if (!gl) {
      setError("WebGL not supported");
      return null;
    }

    const program = helpers.createProgram(gl, shaderSources.vertex, shaderSources.fragment);
    if (!program) {
      setError("Failed to create shader program");
      return null;
    }

    gl.useProgram(program);

    // Initialize particles
    const particleCount = 32000;
    const particleData = new Float32Array(particleCount * 4);
    for (let i = 0; i < particleCount; i++) {
      const baseIdx = i * 4;
      particleData[baseIdx] = xMin + Math.random() * (xMax - xMin);
      particleData[baseIdx + 1] = yMin + Math.random() * (yMax - yMin);
      particleData[baseIdx + 2] = Math.random() * 300;
      particleData[baseIdx + 3] = 0;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);

    particlesRef.current = particleData;
    glRef.current = gl;
    programRef.current = program;

    return { gl, program, positionBuffer };
  }, [helpers, shaderSources.vertex, shaderSources.fragment, xMin, xMax, yMin, yMax]);

  const updateParticles = useCallback(() => {
    const particles = particlesRef.current;
    if (!particles) return false;

    const updatedParticles = new Float32Array(particles.length);
    let successfulEvaluation = false;
    
    for (let i = 0; i < particles.length; i += 4) {
      const x = particles[i];
      const y = particles[i + 1];
      const age = particles[i + 2];
      
      const vx = evaluateExpression(dx, x, y, a, b);
      const vy = evaluateExpression(dy, x, y, a, b);
      
      if (isFinite(vx) && isFinite(vy)) {
        successfulEvaluation = true;
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        const scaleFactor = 2 / (1 + magnitude);
        
        updatedParticles[i] = x + vx * scaleFactor * dt;
        updatedParticles[i + 1] = y + vy * scaleFactor * dt;
        updatedParticles[i + 2] = age + 1;
        updatedParticles[i + 3] = magnitude;
        
        if (age > 300 || 
            updatedParticles[i] < xMin || updatedParticles[i] > xMax ||
            updatedParticles[i + 1] < yMin || updatedParticles[i + 1] > yMax) {
          updatedParticles[i] = xMin + Math.random() * (xMax - xMin);
          updatedParticles[i + 1] = yMin + Math.random() * (yMax - yMin);
          updatedParticles[i + 2] = 0;
          updatedParticles[i + 3] = 0;
        }
      } else {
        updatedParticles[i] = x;
        updatedParticles[i + 1] = y;
        updatedParticles[i + 2] = age;
        updatedParticles[i + 3] = particles[i + 3];
      }
    }
    
    particlesRef.current = updatedParticles;
    return successfulEvaluation;
  }, [dx, dy, a, b, evaluateExpression, xMin, xMax, yMin, yMax, dt]);

  const updateCanvasSize = useCallback(() => {
    const padding = 15;
    const newWidth = window.innerWidth - padding * 2;
    const newHeight = window.innerHeight - 80;
    setCanvasSize({ width: newWidth, height: newHeight });
  }, []);

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

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      isMounted.current = false;
    };
  }, [updateCanvasSize]);

  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const { gl, program, positionBuffer } = initGL() || {};
    if (!gl || !program || !positionBuffer) return;

    const canvas = canvasRef.current;
    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);

    // Get attribute locations
    const positionLoc = gl.getAttribLocation(program, 'a_position');
    const ageLoc = gl.getAttribLocation(program, 'a_age');
    const velocityLoc = gl.getAttribLocation(program, 'a_velocity');

    // Get and set uniforms
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      bounds: gl.getUniformLocation(program, 'u_bounds'),
      maxAge: gl.getUniformLocation(program, 'u_maxAge'),
      fadeInDuration: gl.getUniformLocation(program, 'u_fadeInDuration'),
      fadeOutDuration: gl.getUniformLocation(program, 'u_fadeOutDuration'),
      colorScheme: gl.getUniformLocation(program, 'u_colorScheme')
    };

    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform4f(uniforms.bounds, xMin, yMin, xMax, yMax);
    gl.uniform1f(uniforms.maxAge, 300);
    gl.uniform1f(uniforms.fadeInDuration, 30);
    gl.uniform1f(uniforms.fadeOutDuration, 30);
    gl.uniform1i(uniforms.colorScheme, getColorSchemeUniform(colorScheme.name.toLowerCase()));

    // Enable attributes
    gl.enableVertexAttribArray(positionLoc);
    gl.enableVertexAttribArray(ageLoc);
    gl.enableVertexAttribArray(velocityLoc);

    // Set up blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let animationFrameId;

    const render = () => {
      if (!isMounted.current) return;

      // Clear with background color
      gl.clearColor(
        parseInt(backgroundColor.slice(1, 3), 16) / 255,
        parseInt(backgroundColor.slice(3, 5), 16) / 255,
        parseInt(backgroundColor.slice(5, 7), 16) / 255,
        0.1
      );
      gl.clear(gl.COLOR_BUFFER_BIT);
// Update and upload particle data
      const successfulEvaluation = updateParticles();
      if (!successfulEvaluation) {
        setError("No valid particles. Check your equations.");
      } else {
        setError(null);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particlesRef.current, gl.DYNAMIC_DRAW);

      // Update color scheme uniform
      gl.uniform1i(uniforms.colorScheme, getColorSchemeUniform(colorScheme.name.toLowerCase()));

      // Set up vertex attributes
      // In the render function, update the vertex attribute setup
      const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, stride, 0);  // x,y position
      gl.vertexAttribPointer(ageLoc, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);  // age
      gl.vertexAttribPointer(velocityLoc, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);  // velocity magnitude

      // Draw particles
      gl.drawArrays(gl.POINTS, 0, particlesRef.current.length / 4);

      // Handle traced particles
      if (traceMode) {
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        
        tracedParticlesRef.current = tracedParticlesRef.current.map(particle => {
          const vx = evaluateExpression(dx, particle.x, particle.y, a, b);
          const vy = evaluateExpression(dy, particle.x, particle.y, a, b);
          
          if (isFinite(vx) && isFinite(vy)) {
            const magnitude = Math.sqrt(vx * vx + vy * vy);
            const scaleFactor = 2 / (1 + magnitude);
            
            const newX = particle.x + vx * scaleFactor * dt;
            const newY = particle.y + vy * scaleFactor * dt;
            const canvasX = ((newX - xMin) / (xMax - xMin)) * width;
            const canvasY = height - ((newY - yMin) / (yMax - yMin)) * height;
            
            return {
              x: newX,
              y: newY,
              history: [...particle.history, {x: canvasX, y: canvasY}].slice(-100)
            };
          }
          return particle;
        });

        tracedParticlesRef.current.forEach(particle => {
          if (particle.history.length > 1) {
            ctx.beginPath();
            ctx.moveTo(particle.history[0].x, particle.history[0].y);
            particle.history.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.stroke();
          }
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteBuffer(positionBuffer);
      }
    };
  }, [
    canvasSize, backgroundColor, initGL, updateParticles,
    traceMode, dx, dy, a, b, evaluateExpression,
    xMin, xMax, yMin, yMax, dt, colorScheme, getColorSchemeUniform
  ]);

  return (
    <div className="canvas-container" style={{ 
      position: 'relative', 
      width: canvasSize.width, 
      height: canvasSize.height, 
      backgroundColor 
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      {error && (
        <div style={{ 
          color: 'red', 
          marginTop: '10px', 
          position: 'absolute', 
          top: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '5px 10px',
          borderRadius: '3px'
        }}>
          {error}
        </div>
      )}
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
          onClick={() => tracedParticlesRef.current = []}
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