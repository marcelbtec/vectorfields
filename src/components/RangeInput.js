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

import React from 'react';

const RangeInput = ({ label, min, max, onMinChange, onMaxChange }) => {
  return (
    <div className="range-input">
      <label>{label}</label>
      <div>
        <input
          type="number"
          value={min}
          onChange={(e) => onMinChange(parseFloat(e.target.value))}
          step="any"
        />
        <span> to </span>
        <input
          type="number"
          value={max}
          onChange={(e) => onMaxChange(parseFloat(e.target.value))}
          step="any"
        />
      </div>
    </div>
  );
};

export default RangeInput;