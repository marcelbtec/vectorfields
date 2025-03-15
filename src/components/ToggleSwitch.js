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

const SwitchContainer = styled.div`
  display: flex;
  align-items: center;
`;

const SwitchLabel = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
`;

const Slider = styled.span`
  width: 40px;
  height: 20px;
  background-color: #ccc;
  border-radius: 34px;
  position: relative;
  margin-left: 8px;
  transition: background-color 0.2s;

  &::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 1px;
    bottom: 1px;
    background-color: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
`;

const ToggleSwitch = ({ label, checked, onChange }) => (
  <SwitchContainer>
    <SwitchLabel>
      {label}
      <HiddenCheckbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <Slider />
    </SwitchLabel>
  </SwitchContainer>
);

export default ToggleSwitch;
