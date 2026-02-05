import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';

const PARTICLE_COUNT = 20000;
const MAX_AGE = 300;
const FADE_IN = 30;
const FADE_OUT = 30;
const STRIDE = 4;

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background-color: ${({ backgroundColor }) => backgroundColor};
  overflow: hidden;
`;

const StyledCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
`;

const ErrorMessage = styled.div`
  color: red;
  margin-top: 10px;
  position: absolute;
  top: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 3px;
`;

const Button = styled.button`
  position: absolute;
  top: 10px;
  right: ${({ right }) => right}px;
  padding: 10px;
  background-color: ${({ bgColor }) => bgColor};
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
`;

const VectorFieldVisualization = ({
  dx,
  dy,
  xMin,
  xMax,
  yMin,
  yMax,
  a,
  b,
  colorScheme,
  backgroundColor = '#000000',
  onGenerateRandomSystem,
  traceMode
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isMounted = useRef(true);
  const particlesRef = useRef(null);
  const tracedParticlesRef = useRef([]);
  const paramsRef = useRef({
    dx,
    dy,
    xMin,
    xMax,
    yMin,
    yMax,
    a,
    b,
    colorScheme,
    backgroundColor
  });
  const resourcesRef = useRef({
    gl: null,
    program: null,
    positionBuffer: null,
    uniforms: null,
    attribs: null
  });
  const animationFrameIdRef = useRef(null);
  const dt = 0.01;

  // --- WebGL Helper Functions ---
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

  // --- Shader Sources ---
  const shaderSources = useMemo(() => ({
    // Vertex shader: transforms mathematical coordinates to clip space.
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
        vec2 clipSpace = normalizedPosition * 2.0 - 1.0;  
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
    // Fragment shader: enhanced color mapping with smoother gradients and brightness adjustments.
    fragment: `
      precision mediump float;
      
      varying vec2 v_velocity;
      varying float v_alpha;
      varying float v_magnitude;
      
      uniform int u_colorScheme;
      uniform vec3 u_customColor;
      
      // Convert HSV to RGB.
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      // Ocean: blue-green gradient.
      vec4 getOceanColor(float angle, float alpha) {
        float hue = mix(0.55, 0.65, angle);
        return vec4(hsv2rgb(vec3(hue, 0.8, 1.0)), alpha);
      }
      
      // Fire: red to orange gradient with smoother transition.
      vec4 getFireColor(float angle, float alpha) {
        float hue = mix(0.0, 0.08, angle);
        return vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), alpha);
      }
      
      // Rainbow: full spectrum.
      vec4 getRainbowColor(float angle, float alpha) {
        float hue = angle;
        return vec4(hsv2rgb(vec3(hue, 1.0, 1.0)), alpha);
      }
      
      // Grayscale: smooth transition from dark to light.
      vec4 getGrayscaleColor(float angle, float alpha) {
        float value = mix(0.2, 1.0, abs(sin(angle * 3.14159265)));
        return vec4(vec3(value), alpha);
      }
      
      // Velocity-based: blue (low speed) to red (high speed) with increased brightness.
      vec4 getVelocityColor(float magnitude, float alpha) {
        float normalized = clamp(magnitude / 10.0, 0.0, 1.0);
        float hue = mix(0.6, 0.0, normalized);
        vec3 baseColor = hsv2rgb(vec3(hue, 1.0, 1.0));
        float brightnessFactor = mix(1.0, 2.9, normalized);
        vec3 brightColor = clamp(baseColor * brightnessFactor, 0.0, 1.0);
        return vec4(brightColor, alpha);
      }
      
      // Custom color: uses the provided uniform.
      vec4 getCustomColor(float alpha) {
        return vec4(u_customColor, alpha);
      }
      
      void main() {
        // Create a circular point.
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) {
          discard;
        }
        
        // Compute the normalized angle from the vector.
        float angle = atan(v_velocity.y, v_velocity.x);
        angle = angle * 0.5 + 0.5;
        
        vec4 color;
        if (u_colorScheme == 0) {
          color = getOceanColor(angle, v_alpha);
        } else if (u_colorScheme == 1) {
          color = getFireColor(angle, v_alpha);
        } else if (u_colorScheme == 2) {
          color = getRainbowColor(angle, v_alpha);
        } else if (u_colorScheme == 3) {
          color = getGrayscaleColor(angle, v_alpha);
        } else if (u_colorScheme == 4) {
          color = getVelocityColor(v_magnitude, v_alpha);
        } else if (u_colorScheme == 5) {
          color = getCustomColor(v_alpha);
        } else {
          color = getRainbowColor(angle, v_alpha);
        }
        
        // Apply a glow effect for smoother edges.
        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(color.rgb, color.a * glow);
      }
    `
  }), []);

  useEffect(() => {
    paramsRef.current = {
      dx,
      dy,
      xMin,
      xMax,
      yMin,
      yMax,
      a,
      b,
      colorScheme,
      backgroundColor,
      traceMode
    };
  }, [dx, dy, xMin, xMax, yMin, yMax, a, b, colorScheme, backgroundColor, traceMode]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const safeSetError = useCallback((message) => {
    if (isMounted.current) {
      setError(message);
    }
  }, []);

  // Returns the corresponding uniform value for a given color scheme.
  const getColorSchemeUniform = useCallback((schemeName) => {
    switch (schemeName) {
      case 'ocean': return 0;
      case 'fire': return 1;
      case 'rainbow': return 2;
      case 'grayscale': return 3;
      case 'velocity': return 4;
      case 'custom': return 5;
      default: return 4; // Default to velocity-based scheme.
    }
  }, []);

  // Expression evaluator using a custom parser with caching.
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

  // Initialize WebGL, compile shaders, create buffers, and initialize particles.
  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (!gl) {
      safeSetError("WebGL not supported");
      return null;
    }
    const program = helpers.createProgram(gl, shaderSources.vertex, shaderSources.fragment);
    if (!program) {
      safeSetError("Failed to create shader program");
      return null;
    }
    gl.useProgram(program);
    const { xMin, xMax, yMin, yMax } = paramsRef.current;
    const particleData = new Float32Array(PARTICLE_COUNT * STRIDE);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const baseIdx = i * STRIDE;
      particleData[baseIdx] = xMin + Math.random() * (xMax - xMin);
      particleData[baseIdx + 1] = yMin + Math.random() * (yMax - yMin);
      particleData[baseIdx + 2] = Math.random() * MAX_AGE;
      particleData[baseIdx + 3] = 0;
    }
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);
    particlesRef.current = particleData;
    return { gl, program, positionBuffer };
  }, [helpers, shaderSources.vertex, shaderSources.fragment, safeSetError]);

  const reseedParticles = useCallback((bounds) => {
    const { xMin, xMax, yMin, yMax } = bounds || paramsRef.current;
    const particleData = new Float32Array(PARTICLE_COUNT * STRIDE);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const baseIdx = i * STRIDE;
      particleData[baseIdx] = xMin + Math.random() * (xMax - xMin);
      particleData[baseIdx + 1] = yMin + Math.random() * (yMax - yMin);
      particleData[baseIdx + 2] = Math.random() * MAX_AGE;
      particleData[baseIdx + 3] = 0;
    }
    particlesRef.current = particleData;
    const { gl, positionBuffer } = resourcesRef.current;
    if (gl && positionBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);
    }
  }, []);

  // Update particle positions using numerical integration.
  const updateParticles = useCallback(() => {
    const particles = particlesRef.current;
    if (!particles) return false;
    const { dx, dy, a, b, xMin, xMax, yMin, yMax } = paramsRef.current;
    const updatedParticles = new Float32Array(particles.length);
    let successfulEvaluation = false;
    for (let i = 0; i < particles.length; i += STRIDE) {
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
        if (age > MAX_AGE || 
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
  }, [evaluateExpression, dt]);

  // Initialize traced particles for the trace mode.
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

  // Keep canvas size in sync with the container.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(1, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(1, Math.floor(entry.contentRect.height));
      setCanvasSize((prev) => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize WebGL once the canvas has a size.
  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;
    if (resourcesRef.current.gl) return;
    const init = initGL();
    if (!init) return;
    const { gl, program, positionBuffer } = init;
    const attribs = {
      position: gl.getAttribLocation(program, 'a_position'),
      age: gl.getAttribLocation(program, 'a_age'),
      velocity: gl.getAttribLocation(program, 'a_velocity')
    };
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      bounds: gl.getUniformLocation(program, 'u_bounds'),
      maxAge: gl.getUniformLocation(program, 'u_maxAge'),
      fadeInDuration: gl.getUniformLocation(program, 'u_fadeInDuration'),
      fadeOutDuration: gl.getUniformLocation(program, 'u_fadeOutDuration'),
      colorScheme: gl.getUniformLocation(program, 'u_colorScheme'),
      customColor: gl.getUniformLocation(program, 'u_customColor')
    };
    resourcesRef.current = { gl, program, positionBuffer, uniforms, attribs };

    gl.enableVertexAttribArray(attribs.position);
    gl.enableVertexAttribArray(attribs.age);
    gl.enableVertexAttribArray(attribs.velocity);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const { xMin, xMax, yMin, yMax } = paramsRef.current;
    gl.uniform4f(uniforms.bounds, xMin, yMin, xMax, yMax);
    gl.uniform1f(uniforms.maxAge, MAX_AGE);
    gl.uniform1f(uniforms.fadeInDuration, FADE_IN);
    gl.uniform1f(uniforms.fadeOutDuration, FADE_OUT);
  }, [canvasSize, initGL]);

  // Keep the WebGL viewport in sync with the canvas size.
  useEffect(() => {
    const { gl, uniforms } = resourcesRef.current;
    const canvas = canvasRef.current;
    if (!gl || !uniforms || !canvas) return;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;
    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.resolution, width, height);
  }, [canvasSize]);

  // Update bounds and reseed particles when the domain changes.
  useEffect(() => {
    const { gl, uniforms } = resourcesRef.current;
    if (!gl || !uniforms) return;
    gl.uniform4f(uniforms.bounds, xMin, yMin, xMax, yMax);
    reseedParticles({ xMin, xMax, yMin, yMax });
  }, [xMin, xMax, yMin, yMax, reseedParticles]);

  // Main render loop.
  useEffect(() => {
    const { gl, program, positionBuffer, uniforms, attribs } = resourcesRef.current;
    if (!gl || !program || !positionBuffer || !uniforms || !attribs) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stride = STRIDE * Float32Array.BYTES_PER_ELEMENT;

    const render = () => {
      if (!isMounted.current) return;
      const {
        backgroundColor,
        colorScheme,
        traceMode,
        xMin,
        xMax,
        yMin,
        yMax,
        dx,
        dy,
        a,
        b
      } = paramsRef.current;

      gl.clearColor(
        parseInt(backgroundColor.slice(1, 3), 16) / 255,
        parseInt(backgroundColor.slice(3, 5), 16) / 255,
        parseInt(backgroundColor.slice(5, 7), 16) / 255,
        0.8
      );
      gl.clear(gl.COLOR_BUFFER_BIT);

      const successfulEvaluation = updateParticles();
      if (!successfulEvaluation) {
        safeSetError("No valid particles. Check your equations.");
      } else {
        safeSetError(null);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particlesRef.current, gl.DYNAMIC_DRAW);

      const schemeName = (colorScheme?.name || 'velocity').toLowerCase();
      gl.uniform1i(uniforms.colorScheme, getColorSchemeUniform(schemeName));
      if (
        schemeName === 'custom' &&
        uniforms.customColor !== null &&
        uniforms.customColor !== -1
      ) {
        gl.uniform3f(
          uniforms.customColor,
          (colorScheme.custom?.r || 255) / 255,
          (colorScheme.custom?.g || 255) / 255,
          (colorScheme.custom?.b || 255) / 255
        );
      }

      gl.vertexAttribPointer(attribs.position, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(
        attribs.age,
        1,
        gl.FLOAT,
        false,
        stride,
        2 * Float32Array.BYTES_PER_ELEMENT
      );
      gl.vertexAttribPointer(
        attribs.velocity,
        1,
        gl.FLOAT,
        false,
        stride,
        3 * Float32Array.BYTES_PER_ELEMENT
      );

      gl.drawArrays(gl.POINTS, 0, particlesRef.current.length / STRIDE);

      if (traceMode) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
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
              const canvasX = ((newX - xMin) / (xMax - xMin)) * canvas.width;
              const canvasY = canvas.height - ((newY - yMin) / (yMax - yMin)) * canvas.height;
              return {
                x: newX,
                y: newY,
                history: [...particle.history, { x: canvasX, y: canvasY }].slice(-100)
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
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [canvasSize, evaluateExpression, getColorSchemeUniform, updateParticles, safeSetError]);

  // Cleanup WebGL resources on unmount.
  useEffect(() => {
    return () => {
      const { gl, program, positionBuffer } = resourcesRef.current;
      if (gl && program) gl.deleteProgram(program);
      if (gl && positionBuffer) gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <Container ref={containerRef} backgroundColor={backgroundColor}>
      <StyledCanvas ref={canvasRef} />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button onClick={onGenerateRandomSystem} right={10} bgColor="#4c5caf" aria-label="Generate Random System">
        Generate Random System
      </Button>
      {traceMode && (
        <Button onClick={() => (tracedParticlesRef.current = [])} right={200} bgColor="#f44336" aria-label="Clear Traces">
          Clear Traces
        </Button>
      )}
    </Container>
  );
};

export default VectorFieldVisualization;
