# Dynamic Systems Visualizer

Dynamic Systems Visualizer is an interactive tool designed to help you explore and understand the behavior of various dynamical systems. It provides real-time visualizations of vector fields and phase portraits for both predefined and custom systems. Whether you're a student, researcher, or enthusiast, this application offers an intuitive interface to experiment with mathematical models and observe their dynamics.

---

## Features

- **Predefined Systems:**  
  Choose from a variety of popular dynamical systems such as:
  - **Lotka-Volterra:** Models predator-prey interactions.
  - **Van der Pol Oscillator:** Demonstrates non-conservative oscillations.
  - And many others, each with its own characteristic behavior.

- **Custom Equation Input:**  
  Enter your own differential equations for the vector field. The built-in parser handles mathematical expressions (supporting basic operations, exponentiation, trigonometric functions, and more) so you can visualize any system you define.

- **Parameter Controls:**  
  Easily adjust parameters (such as growth rates, damping coefficients, etc.) using interactive sliders. This allows you to explore how different parameter values affect the system dynamics.

- **Color Scheme Selection:**  
  Select from multiple color schemes (ocean, fire, rainbow, grayscale, velocity-based, custom, etc.) to enhance the visual output and better highlight features of the vector field.

- **Background Color Customization:**  
  Change the background color of the visualization canvas to suit your preferences or to improve contrast with the vector field.

- **Trace Mode:**  
  Toggle trace mode to display the historical trajectory of selected particles. This helps in understanding the long-term behavior of the system and in identifying fixed points or limit cycles.

---

## How to Use

### Getting Started

1. **Select or Define a System:**  
   - Use the dropdown menu to choose from a list of predefined systems.
   - Alternatively, input custom equations for the dynamical system using the equation input field.
   - You can also click the "Generate Random System" button for spontaneous exploration.

2. **Adjust Parameters:**  
   - Utilize the parameter sliders to modify values like coefficients, damping terms, or any system-specific parameters.
   - Real-time adjustments allow you to immediately see how changes affect the vector field and phase portrait.

3. **Customize Visualization Options:**  
   - Change the color scheme by selecting an option from the color scheme selector.
   - Customize the background color for better contrast or personal preference.
   - Enable or disable trace mode to display particle trajectories, giving you insight into the dynamic evolution of the system.

4. **Observe and Analyze:**  
   - The vector field visualization provides an overview of the direction and magnitude of the system’s flow at each point.
   - The phase portrait gives you a more detailed view of the system’s trajectories over time.
   - Experiment with different settings to see how the system evolves and to uncover features like attractors, repellers, limit cycles, or chaotic regions.

---

## Detailed Explanations

### Vector Field Visualization

- **Rendering Process:**  
  The application uses WebGL to efficiently render thousands of particles that represent the vector field. Each particle’s position, velocity, and age are computed in real time, ensuring a smooth and responsive visualization.
  
- **Coordinate Transformation:**  
  The system transforms mathematical coordinates into screen coordinates. This involves scaling, translating, and flipping the y-axis (to account for the typical computer graphics coordinate system) so that the visualization accurately represents the system dynamics.

- **Color Mapping:**  
  Different color schemes are applied based on vector properties such as direction and magnitude. For instance, the "velocity" scheme increases brightness for higher speeds, while the "ocean" scheme uses a blue-green gradient for a calming effect.

### Phase Portrait

- **Trajectory Mapping:**  
  The phase portrait maps trajectories from the dynamical system onto a canvas. It computes the path of particles over time using numerical integration methods, displaying how systems evolve from different starting points.
  
- **Interactive Exploration:**  
  By modifying initial conditions and parameters, you can study how trajectories converge, diverge, or oscillate. This visual feedback is crucial for understanding concepts like stability, bifurcations, and chaos.

### Custom Equation Parsing

- **Built-In Parser:**  
  The application includes a custom expression parser that interprets mathematical expressions for the differential equations. It supports basic arithmetic, exponentiation, and standard functions (e.g., sin, cos, tan, exp, sqrt). While this parser is sufficient for many systems, more complex functions may require additional customization or an external library.

- **Real-Time Evaluation:**  
  As you adjust equations or parameters, the parser re-evaluates the expressions in real time, allowing for immediate visual feedback in both the vector field and the phase portrait.

### Detailed Descriptions of Equations

- **Ordinary Differential Equations (ODEs):**  
  Dynamical systems are generally described by a set of ODEs:
  
  \[
  \frac{dx}{dt} = f(x, y, \dots), \quad \frac{dy}{dt} = g(x, y, \dots)
  \]
  
  Here, \( f(x, y, \dots) \) and \( g(x, y, \dots) \) define the vector field at each point \((x, y)\). The functions can be linear or nonlinear, and their behavior determines the stability and dynamics of the system.

- **Lotka-Volterra Equations:**  
  A classic model for predator-prey interactions:
  
  \[
  \frac{dx}{dt} = \alpha x - \beta xy, \quad \frac{dy}{dt} = \delta xy - \gamma y
  \]
  
  where:
  - \( x \) represents the prey population,
  - \( y \) represents the predator population,
  - \( \alpha, \beta, \delta, \gamma \) are positive constants describing interaction rates and natural growth/death rates.

- **Van der Pol Oscillator:**  
  A model for non-conservative oscillations, originally defined by the second-order ODE:
  
  \[
  \frac{d^2x}{dt^2} - \mu (1 - x^2) \frac{dx}{dt} + x = 0
  \]
  
  This is commonly rewritten as a system of first-order ODEs:
  \[
  \frac{dx}{dt} = y, \quad \frac{dy}{dt} = \mu (1 - x^2)y - x
  \]
  where \( \mu \) is a parameter controlling nonlinearity and damping.

- **General Nonlinear Systems:**  
  Users can define custom systems. For example:
  
  \[
  \frac{dx}{dt} = \sin(x) + \cos(y), \quad \frac{dy}{dt} = e^{-x} - y^2
  \]
  
  Such equations may display a range of behaviors—from stable fixed points to chaotic dynamics—depending on the chosen functions and parameters.

- **Numerical Integration:**  
  Both the vector field and phase portrait visualizations are computed using numerical integration (typically Euler’s method). The time step \( dt \) is critical: smaller values yield more accurate trajectories, though they may require more computation.

---

## Troubleshooting & Tips

- **Coordinate Orientation Issues:**  
  If visualizations appear rotated or inverted, verify that the bounds (`xMin`, `xMax`, `yMin`, `yMax`) are consistent across all components.

- **Performance Concerns:**  
  Rendering thousands of particles in real time is demanding. On slower machines, consider reducing the particle count or simplifying equations.

- **Equation Errors:**  
  Ensure that your custom equations are formatted correctly. If the parser encounters an error (e.g., unknown tokens or mismatched parentheses), an error message will be displayed and additional details can be found in the console logs.

- **Experimentation:**  
  Experiment with various parameter settings and color schemes. Visual differences can reveal subtle dynamics and offer deeper insights into system behavior.

---

## Conclusion

Dynamic Systems Visualizer provides a rich, interactive environment for exploring the behavior of dynamical systems. With real-time visual feedback, customizable equations, and intuitive parameter controls, it is a powerful tool for learning, experimentation, and research in differential equations and nonlinear dynamics.

For further details or assistance, please refer to the project's repository or consult the supplementary documentation.
