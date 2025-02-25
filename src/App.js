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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import VectorFieldVisualization from './components/VectorFieldVisualization';
import PhasePortrait from './components/PhasePortrait';
import ReactMarkdown from 'react-markdown';
import './App.css';

const colorSchemes = {
  ocean: {
    name: 'Ocean',
    getColor: (angle, alpha = 1) => `hsla(${180 + angle * 60 / Math.PI}, 100%, 50%, ${alpha})`,
  },
  fire: {
    name: 'Fire',
    getColor: (angle, alpha = 1) => `hsla(${angle * 60 / Math.PI}, 100%, 50%, ${alpha})`,
  },
  rainbow: {
    name: 'Rainbow',
    getColor: (angle, alpha = 1) => `hsla(${angle * 180 / Math.PI}, 100%, 50%, ${alpha})`,
  },
  grayscale: {
    name: 'Grayscale',
    getColor: (angle, alpha = 1) => {
      const value = Math.abs(Math.sin(angle)) * 255;
      return `rgba(${value}, ${value}, ${value}, ${alpha})`;
    },
  },
  velocity: {
    name: 'Velocity',
    getColor: (angle, alpha = 1, magnitude = 0) => {
      const hue = magnitude * 240; // Map magnitude to hue (0 to 240)
      return `hsla(${hue}, 100%, 50%, ${alpha})`;
    },
  },
};

const predefinedSystems = {
  custom: { 
    name: 'Custom', 
    dx:'y',
    dy:'a*(1 - x^2)*y - x',
    a: 1., 
    b: 0.,
    description: 'Describes oscillations with nonlinear damping.'
  },
  lotkaVolterra: { 
    name: 'Lotka-Volterra', 
    dx: 'a*x - b*x*y', 
    dy: '-y + x*y', 
    a: 1, 
    b: 1,
    description: 'Models predator-prey interactions in ecological systems.'
  },
  vanDerPol: { 
    name: 'Van der Pol', 
    dx: 'y', 
    dy: 'a*(1 - x^2)*y - x', 
    a: 1, 
    b: 0,
    description: 'Describes oscillations with nonlinear damping.'
  },
  duffing: { 
    name: 'Duffing', 
    dx: 'y', 
    dy: '-b*y - a*x - x^3', 
    a: 1, 
    b: 0.3,
    description: 'Models a driven oscillator with a nonlinear elasticity.'
  },
  brusselator: { 
    name: 'Brusselator', 
    dx: 'a + x^2*y - (b+1)*x', 
    dy: 'b*x - x^2*y', 
    a: 1, 
    b: 3,
    description: 'Theoretical model for a type of autocatalytic reaction.'
  },
  fitzhughNagumo: { 
    name: 'FitzHugh-Nagumo', 
    dx: 'x - x^3/3 - y + a', 
    dy: 'b*(x + 0.7 - 0.8*y)', 
    a: 0.7, 
    b: 0.8,
    description: 'Simplified model of action potential in neurons.'
  },
  selkov: { 
    name: 'Selkov', 
    dx: '-x + a*y + x^2*y', 
    dy: 'b - a*y - x^2*y', 
    a: 0.08, 
    b: 0.6,
    description: 'Models glycolysis oscillations in cells.'
  },
  bogdanovTakens: { 
    name: 'Bogdanov-Takens', 
    dx: 'y', 
    dy: 'a + b*x + x^2 + x*y', 
    a: 0.5, 
    b: 0.5,
    description: 'Exhibits various types of bifurcations.'
  },
  vanDerPolDuffing: { 
    name: 'Van der Pol-Duffing', 
    dx: 'y', 
    dy: '-x + a*y - y^3 + b*cos(x)', 
    a: 1, 
    b: 0.3,
    description: 'Combines features of Van der Pol and Duffing oscillators.'
  },
  circleLattice: { 
    name: 'Circle Lattice', 
    dx: 'sin(x) + a*sin(y)', 
    dy: 'sin(y) + b*sin(x)', 
    a: 1, 
    b: 1,
    description: 'Produces interesting circular patterns.'
  },
  spiraling: {
    name: 'Spiraling',
    dx: 'x - y + a*x*(x^2 + y^2)',
    dy: 'x + y + b*y*(x^2 + y^2)',
    a: -1,
    b: -1,
    description: 'Produces spiral patterns with controllable direction and tightness.'
  },
  hamiltonian: {
    name: 'Hamiltonian',
    dx: 'y',
    dy: '-sin(x) - a*sin(b*x)',
    a: 0.5,
    b: 2,
    description: 'A simple Hamiltonian system that can exhibit both regular and irregular behavior.'
  },
  hopfBifurcation: {
    name: 'Hopf Bifurcation',
    dx: 'a*x - y - x*(x^2 + y^2)',
    dy: 'x + a*y - y*(x^2 + y^2)',
    a: 0,
    b: 0,
    description: 'Demonstrates the Hopf bifurcation, transitioning between a stable focus and a limit cycle.'
  },
  AlleePredatorPrey: {
    name: 'Allee Predator-Prey',
    dx: 'x*(x - a)*(1 - x) - b*x*y',
    dy: 'y*(-1 + x)',
    a: 0.1,
    b: 1,
    description: 'A predator-prey model incorporating the Allee effect in the prey population.'
  },
  forcedOscillator: {
    name: 'Forced Oscillator',
    dx: 'y',
    dy: '-x - a*y + b*cos(x)',
    a: 0.2,
    b: 1,
    description: 'A damped oscillator with periodic forcing, capable of showing resonance effects.'
  },
  bllev: { 
    name: 'Experimental', 
    dx: 'a*x*(1-x)*(x-1) -y + 2.1', 
    dy: 'b*y*(1-y)*(1-x)', 
    a: 3., 
    b: 1.5,
    description: 'Experimental system - work in progress.'
  },
};

function App() {
  const [dx, setDx] = useState(predefinedSystems.custom.dx);
  const [dy, setDy] = useState(predefinedSystems.custom.dy);
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);
  const [a, setA] = useState(predefinedSystems.custom.a);
  const [b, setB] = useState(predefinedSystems.custom.b);
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [backgroundColor, setBackgroundColor] = useState('#000014');
  const [traceMode, setTraceMode] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState('custom');
  const [showDocs, setShowDocs] = useState(false);
  const [docContent, setDocContent] = useState('');

  const updateDx = useCallback((value) => {
    setDx(value);
    setSelectedSystem('custom');
  }, []);

  const updateDy = useCallback((value) => {
    setDy(value);
    setSelectedSystem('custom');
  }, []);

  const debouncedSetA = useCallback((value) => {
    setA(Number(value));
    setSelectedSystem('custom');
  }, []);

  const debouncedSetB = useCallback((value) => {
    setB(Number(value));
    setSelectedSystem('custom');
  }, []);

  useEffect(() => {
    fetch('/docs/explanation.md')
      .then(response => response.text())
      .then(text => setDocContent(text));
  }, []);

  
  const generateRandomEquation = useCallback(() => {
    const baseTerms = ['x', 'y', 'x*y'];
    const functions = ['sin', 'cos','tan'];
  
    const generateTerm = () => {
      const baseVariable = baseTerms[Math.floor(Math.random() * baseTerms.length)];
      let variable = baseVariable;
  
      // Add power only to 'x' or 'y', not to 'x*y'
      if (baseVariable !== 'x*y' && Math.random() < 0.3) {
        const power = Math.floor(Math.random() * 2) + 2; // Random integer: 2 or 3
        variable = `${baseVariable}^${power}`;
      }
  
      const useParameter = Math.random() < 0.5;
      const coefficient = useParameter 
        ? (Math.random() < 0.5 ? 'a' : 'b')
        : ((Math.floor(Math.random() * 90) + 1) / 10).toFixed(1); // Random float between 0.1 and 9.0
  
      if (coefficient === '1.0') {
        return variable;
      }
      return `${coefficient}*${variable}`;
    };
  
    const generateExpression = () => {
      let expr = [];
  
      // Generate 3-5 terms
      const termCount = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < termCount; i++) {
        expr.push(generateTerm());
      }
  
      // Randomly apply functions
      expr = expr.map(term => {
        if (Math.random() < 0.3 && !term.includes('x*y') && !term.includes('a') && !term.includes('b')) {
          const func = functions[Math.floor(Math.random() * functions.length)];
          term = `${func}(${term})`;
        }
        return Math.random() < 0.5 ? `-${term}` : term;
      });
  
      return expr.join(' + ').replace(/\+ -/g, '- ');
    };
  
    setDx(generateExpression());
    setDy(generateExpression());
    setSelectedSystem('custom');
  
    // Set initial values for 'a' and 'b'
    setA(-1);
    setB(1);
  }, [setDx, setDy, setSelectedSystem, setA, setB]);

  const handleSystemChange = useCallback((e) => {
    const system = predefinedSystems[e.target.value];
    setSelectedSystem(e.target.value);
    setDx(system.dx);
    setDy(system.dy);
    setA(system.a);
    setB(system.b);
  }, []);

  const currentColorScheme = useMemo(() => colorSchemes[colorScheme] || colorSchemes.rainbow, [colorScheme]);

  return (
    <div className="App">
      <div className="controls">
        <div>
          <label>Predefined Systems: </label>
          <select value={selectedSystem} onChange={handleSystemChange}>
            {Object.entries(predefinedSystems).map(([key, system]) => (
              <option key={key} value={key} title={system.description}>
                {system.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>dx/dt: </label>
          <input value={dx} onChange={(e) => updateDx(e.target.value)} />
        </div>
        <div>
          <label>dy/dt: </label>
          <input value={dy} onChange={(e) => updateDy(e.target.value)} />
        </div>
        <div>
          <label>X Range: </label>
          <input type="number" value={xMin} onChange={(e) => setXMin(Number(e.target.value))} />
          <input type="number" value={xMax} onChange={(e) => setXMax(Number(e.target.value))} />
        </div>
        <div>
          <label>Y Range: </label>
          <input type="number" value={yMin} onChange={(e) => setYMin(Number(e.target.value))} />
          <input type="number" value={yMax} onChange={(e) => setYMax(Number(e.target.value))} />
        </div>
        <div>
          <label>a: {a.toFixed(1)}</label>
          <input 
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={a}
            onChange={(e) => debouncedSetA(e.target.value)}
            style={{width: '200px'}}
          />
        </div>
        <div>
          <label>b: {b.toFixed(1)}</label>
          <input 
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={b}
            onChange={(e) => debouncedSetB(e.target.value)}
            style={{width: '200px'}}
          />
        </div>
        <div>
          <label>Color Scheme: </label>
          <select value={colorScheme} onChange={(e) => setColorScheme(e.target.value)}>
            {Object.keys(colorSchemes).map(scheme => (
              <option key={scheme} value={scheme}>{colorSchemes[scheme].name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Background: </label>
          <input 
            type="color" 
            value={backgroundColor} 
            onChange={(e) => setBackgroundColor(e.target.value)} 
          />
        </div>
        <div className="trace-and-doc">
          <div>
            <label>
              <input
                type="checkbox"
                checked={traceMode}
                onChange={(e) => setTraceMode(e.target.checked)}
              />
              Trace Mode
            </label>
          </div>
          <button className="doc-button small" onClick={() => setShowDocs(!showDocs)}>
            Docs
          </button>
        </div>
      </div>
      {showDocs && (
        <div className="doc-modal">
          <div className="doc-content">
            <button className="close-button" onClick={() => setShowDocs(false)}>×</button>
            <ReactMarkdown>{docContent}</ReactMarkdown>
          </div>
        </div>
      )}
      <div className="visualization-container">
        <div className="vector-field-container">
          <VectorFieldVisualization
            dx={dx}
            dy={dy}
            xMin={xMin}
            xMax={xMax}
            yMin={yMin}
            yMax={yMax}
            a={a}
            b={b}
            colorScheme={currentColorScheme}
            backgroundColor={backgroundColor}
            onGenerateRandomSystem={generateRandomEquation}
            traceMode={traceMode}
          />
        </div>
        <div className="phase-portrait-container">
          <PhasePortrait
            dx={dx}
            dy={dy}
            xMin={xMin}
            xMax={xMax}
            yMin={yMin}
            yMax={yMax}
            a={a}
            b={b}
            colorScheme={currentColorScheme}
            backgroundColor={backgroundColor}
          />
        </div>
      </div>
    </div>
  );
}

export default App;