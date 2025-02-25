# VectorFieldVisualization

## Overview
`VectorFieldVisualization` is a React application that visualizes vector fields using dynamic and interactive particle systems. Users can input custom differential equations, adjust various parameters, and visualize the vector fields in real-time.

## Features
- **Dynamic Visualization**: Displays vector fields based on user-defined differential equations.
- **Responsive Canvas**: Adjusts canvas size according to window dimensions.
- **Customizable Parameters**: Allows users to define equations, ranges, parameters, color schemes, and background colors.
- **Random System Generation**: Provides a button to generate random differential equations for exploration.
- **Error Handling**: Displays error messages for invalid expressions.


## Demo Video
[![VectorFieldVisualization Demo](https://img.youtube.com/vi/Feqr2ahexO4/0.jpg)](https://www.youtube.com/watch?v=Feqr2ahexO4)

## Components
### App.js
- **State Management**: Manages state for differential equations (`dx`, `dy`), range (`xMin`, `xMax`, `yMin`, `yMax`), parameters (`a`, `b`), color scheme, and background color.
- **Controls**: Provides input fields and controls for users to customize the visualization parameters.
- **Color Schemes**: Offers predefined color schemes (`ocean`, `fire`, `rainbow`, `grayscale`).
- **Random Equation Generator**: Function to generate random differential equations.

### VectorFieldVisualization.js
- **Canvas Rendering**: Renders the vector field on a canvas element using particles.
- **Expression Evaluation**: Evaluates user-provided differential equations to compute vector field directions.
- **Particle System**: Manages particles that visualize the vector field, with smooth transitions and fade effects.
- **Responsive Design**: Adjusts the canvas size dynamically based on window dimensions.
- **Error Handling**: Displays error messages for invalid differential equations.

## Getting Started
### Prerequisites
- Node.js
- npm (Node Package Manager)

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```bash
   cd vectorfieldvisualization
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application
1. Start the development server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Usage
1. **Input Differential Equations**: Enter your custom `dx/dt` and `dy/dt` equations in the input fields.
2. **Adjust Parameters**: Set the range for `x` and `y`, and define parameters `a` and `b`.
3. **Choose Color Scheme**: Select a color scheme from the dropdown menu.
4. **Set Background Color**: Choose a background color using the color picker.
5. **Generate Random System**: Click the "Generate Random System" button to create random equations.
6. **View Visualization**: The canvas will update in real-time to display the vector field.

# To Do
1. Fix rendering when resize window
2. Optimize particle flow for more particles
3. Better visual effects - fading particles
4. Add more pre defined equations
5. Add option that users can save and upload equations
6. Incorporating a phase portrait view alongside the vector field visualization
7. When entering equations by hand no need to re-render everything after every key stroke. Improve.

# License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Be nice and give some credits.

Have fun!
