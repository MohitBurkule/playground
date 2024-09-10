/* Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {Example2D} from "./dataset";
import * as d3 from 'd3';
import * as d3ScaleChromatic from 'd3-scale-chromatic';

export interface HeatMapSettings {
  [key: string]: any;
  showAxes?: boolean;
  noSvg?: boolean;
}

/** Number of different shades (colors) when drawing a gradient heatmap */
const NUM_SHADES = 30;

/**
 * Draws a heatmap using canvas. Used for showing the learned decision
 * boundary of the classification algorithm. Can also draw data points
 * using an svg overlayed on top of the canvas heatmap.
 */
export class HeatMap {
  private settings: HeatMapSettings = {
    showAxes: false,
    noSvg: false
  };
  private svg;
  private xScale;
  private yScale;
  private colorScale;
  private numSamples: number;
  private color;
  private canvas;
  private svg;

  constructor(
      width: number, numSamples: number, xDomain: [number, number],
      yDomain: [number, number], container,
      userSettings?: HeatMapSettings) {
    this.numSamples = numSamples;
    let height = width;
    let padding = userSettings.showAxes ? 20 : 0;

    if (userSettings != null) {
      // overwrite the defaults with the user-specified settings.
      for (let prop in userSettings) {
        this.settings[prop] = userSettings[prop];
      }
    }

    this.svg = d3.select(container).append("svg")
      .attr("width", width)
      .attr("height", width);

    this.xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
    this.yScale = d3.scaleLinear().domain(yDomain).range([width, 0]);

    this.colorScale = d3.scaleSequential(d3ScaleChromatic.interpolateViridis)
      .domain([0, 1]);

    this.svg.selectAll("rect")
      .data(d3.range(numSamples * numSamples))
      .enter().append("rect")
      .attr("x", d => this.xScale(d % numSamples))
      .attr("y", d => this.yScale(Math.floor(d / numSamples)))
      .attr("width", width / numSamples)
      .attr("height", width / numSamples)
      .style("fill", d => this.colorScale(Math.random()));
  }

  updateTestPoints(points: Example2D[]): void {
    if (this.settings.noSvg) {
      throw Error("Can't add points since noSvg=true");
    }
    this.updateCircles(this.svg.select("g.test"), points);
  }

  updatePoints(points: Example2D[]): void {
    if (this.settings.noSvg) {
      throw Error("Can't add points since noSvg=true");
    }
    this.updateCircles(this.svg.select("g.train"), points);
  }

  updateBackground(data: number[][], discretize: boolean): void {
    let dx = data[0].length;
    let dy = data.length;

    if (dx !== this.numSamples || dy !== this.numSamples) {
      throw new Error(
          "The provided data matrix must be of size " +
          "numSamples X numSamples");
    }

    // Compute the pixel colors; scaled by CSS.
    let context = (this.canvas.node() as HTMLCanvasElement).getContext("2d");
    let image = context.createImageData(dx, dy);

    for (let y = 0, p = -1; y < dy; ++y) {
      for (let x = 0; x < dx; ++x) {
        let value = data[x][y];
        if (discretize) {
          value = (value >= 0 ? 1 : -1);
        }
        let c = d3.rgb(this.color(value));
        image.data[++p] = c.r;
        image.data[++p] = c.g;
        image.data[++p] = c.b;
        image.data[++p] = 160;
      }
    }
    context.putImageData(image, 0, 0);
  }

  private updateCircles(container, points: Example2D[]) {
    // Keep only points that are inside the bounds.
    let xDomain = this.xScale.domain();
    let yDomain = this.yScale.domain();
    points = points.filter(p => {
      return p.x >= xDomain[0] && p.x <= xDomain[1]
        && p.y >= yDomain[0] && p.y <= yDomain[1];
    });

    // Attach data to initially empty selection.
    let selection = container.selectAll("circle").data(points);

    // Insert elements to match length of points array.
    selection.enter().append("circle").attr("r", 3);

    // Update points to be in the correct position.
    selection
      .attr({
        cx: (d: Example2D) => this.xScale(d.x),
        cy: (d: Example2D) => this.yScale(d.y),
      })
      .style("fill", d => this.color(d.label));

    // Remove points if the length has gone down.
    selection.exit().remove();
  }
}  // Close class HeatMap.

export function reduceMatrix(matrix: number[][], factor: number): number[][] {
  if (matrix.length !== matrix[0].length) {
    throw new Error("The provided matrix must be a square matrix");
  }
  if (matrix.length % factor !== 0) {
    throw new Error("The width/height of the matrix must be divisible by " +
        "the reduction factor");
  }
  let result: number[][] = new Array(matrix.length / factor);
  for (let i = 0; i < matrix.length; i += factor) {
    result[i / factor] = new Array(matrix.length / factor);
    for (let j = 0; j < matrix.length; j += factor) {
      let avg = 0;
      // Sum all the values in the neighborhood.
      for (let k = 0; k < factor; k++) {
        for (let l = 0; l < factor; l++) {
          avg += matrix[i + k][j + l];
        }
      }
      avg /= (factor * factor);
      result[i / factor][j / factor] = avg;
    }
  }
  return result;
}
