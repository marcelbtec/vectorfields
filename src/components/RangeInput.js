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
import styled from 'styled-components';

const RangeContainer = styled.div`
  margin: 8px 0;
`;

const NumberInput = styled.input`
  width: 80px;
  padding: 4px;
`;

const RangeInput = ({ label, min, max, onMinChange, onMaxChange }) => {
  return (
    <RangeContainer>
      <label>{label}</label>
      <div>
        <NumberInput
          type="number"
          value={min}
          onChange={(e) => onMinChange(parseFloat(e.target.value))}
          step="any"
          aria-label={`${label} minimum`}
        />
        <span> to </span>
        <NumberInput
          type="number"
          value={max}
          onChange={(e) => onMaxChange(parseFloat(e.target.value))}
          step="any"
          aria-label={`${label} maximum`}
        />
      </div>
    </RangeContainer>
  );
};

export default RangeInput;
