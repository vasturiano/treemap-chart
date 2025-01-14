import { select as d3Select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { hierarchy as d3Hierarchy, treemap as d3Treemap } from 'd3-hierarchy';
import { transition as d3Transition } from 'd3-transition';
import { interpolate as d3Interpolate } from 'd3-interpolate';
import zoomable from 'd3-zoomable';
import Kapsule from 'kapsule';
import tinycolor from 'tinycolor2';
import accessorFn from 'accessor-fn';
import Tooltip from 'float-tooltip';

const LABELS_WIDTH_OPACITY_SCALE = scaleLinear().domain([4, 8]).clamp(true); // px per char
const LABELS_HEIGHT_OPACITY_SCALE = scaleLinear().domain([6, 18]).clamp(true); // available height in px

export default Kapsule({

  props: {
    width: { default: window.innerWidth, onChange(_, state) { state.needsReparse = true }},
    height: { default: window.innerHeight, onChange(_, state) { state.needsReparse = true }},
    data: { onChange(_, state) { state.needsReparse = true }},
    children: { default: 'children', onChange(_, state) { state.needsReparse = true }},
    sort: { onChange(_, state) { state.needsReparse = true }},
    label: { default: d => d.name },
    size: {
      default: 'value',
      onChange: function(_, state) { this.zoomReset(); state.needsReparse = true; }
    },
    padding: { default: 2.5, onChange(_, state) { state.needsReparse = true }},
    color: { default: d => 'lightgrey' },
    nodeClassName: {}, // Additional css classes to add on each block node
    minBlockArea: { default: 100 },
    excludeRoot: { default: false, onChange(_, state) { state.needsReparse = true }},
    showLabels: { default: true },
    showTooltip: { default: d => true, triggerUpdate: false},
    tooltipTitle: { default: null, triggerUpdate: false },
    tooltipContent: { default: d => '', triggerUpdate: false },
    onClick: { triggerUpdate: false },
    onRightClick: { triggerUpdate: false },
    onHover: { triggerUpdate: false },
    transitionDuration: { default: 800, triggerUpdate: false }
  },
  methods: {
    zoomBy: function(state, k) {
      state.zoom.zoomBy(k, state.transitionDuration);
      return this;
    },
    zoomReset: function(state) {
      state.zoom.zoomReset(state.transitionDuration);
      return this;
    },
    zoomToNode: function(state, d = {}) {
      const node = d.__dataNode;
      if (node) {
        const k = Math.min(state.width / (node.x1 - node.x0), state.height / (node.y1 - node.y0));

        const tr = {
          k,
          x: -Math.max(0, Math.min(
            state.width * (1 - 1 / k), // Don't pan out of chart boundaries
            node.x0 - (state.width / k - (node.x1 - node.x0)) / 2 // Center block in view
          )),
          y: -Math.max(0, Math.min(
            state.height * (1 - 1 / k),
            node.y0 - (state.height / k - (node.y1 - node.y0)) / 2
          ))
        };

        state.zoom.zoomTo(tr, state.transitionDuration);
      }
      return this;
    },
    _parseData: function(state) {
      if (state.data) {
        const hierData = d3Hierarchy(state.data, accessorFn(state.children))
          .sum(accessorFn(state.size));

        if (state.sort) {
          hierData.sort(state.sort);
        }

        d3Treemap()
          //.padding(1)
          //.round(true)
          .paddingInner(state.padding)
          .size([state.width, state.height])(hierData);

        hierData.descendants().forEach((d, i) => {
          d.id = i; // Mark each node with a unique ID
          d.data.__dataNode = d; // Dual-link data nodes
        });

        state.layoutData = hierData.descendants()
          .filter(state.excludeRoot ? d => d.depth > 0 : () => true);
      }
    }
  },
  stateInit: () => ({
    zoom: zoomable()
  }),
  init: function(domNode, state) {
    const el = d3Select(domNode)
      .append('div').attr('class', 'treemap-viz');

    state.svg = el.append('svg');
    state.canvas = state.svg.append('g');

    state.tooltip = new Tooltip(el);

    // zoom/pan
    state.zoom(state.svg)
      .svgEl(state.canvas)
      .onChange((tr, prevTr, duration) => {
        if (state.showLabels && !duration) {
          // Scale labels immediately if not animating
          state.canvas.selectAll('text')
            .attr('transform', `scale(${1 / tr.k})`);
        }

        // Prevent using transitions when using mouse wheel to zoom
        state.skipTransitionsOnce = !duration;
        state._rerender();
      });

    state.svg
      .on('click', ev => (state.onClick || this.zoomReset)(null, ev)) // By default reset zoom when clicking on canvas
      .on('contextmenu', ev => {
        if (state.onRightClick) { // By default do nothing when right-clicking on canvas
          state.onRightClick(null, ev);
          ev.preventDefault();
        }
      })
      .on('mouseover', ev => state.onHover && state.onHover(null, ev));
  },
  update: function(state) {
    if (state.needsReparse) {
      this._parseData();
      state.needsReparse = false;
    }

    state.svg
      .style('width', state.width + 'px')
      .style('height', state.height + 'px');

    state.zoom.translateExtent([[0, 0], [state.width, state.height]]);

    if (!state.layoutData) return;

    const zoomTr = state.zoom.current();

    const cell = state.canvas.selectAll('.node')
      .data(
        state.layoutData
          .filter(d => // Show only blocks in scene that are larger than the threshold
            d.x1 > -zoomTr.x / zoomTr.k &&
            d.x0 < -zoomTr.x / zoomTr.k + state.width / zoomTr.k &&
            d.y1 > -zoomTr.y / zoomTr.k &&
            d.y0 < -zoomTr.y / zoomTr.k + state.height / zoomTr.k &&
            (d.x1 - d.x0) * (d.y1 - d.y0) >= state.minBlockArea / zoomTr.k
          ),
        d => d.id
    );

    const nameOf = accessorFn(state.label);
    const colorOf = accessorFn(state.color);
    const nodeClassNameOf = accessorFn(state.nodeClassName);

    const animate = !state.skipTransitionsOnce;
    state.skipTransitionsOnce = false;
    const transition = d3Transition().duration(animate ? state.transitionDuration: 0);

    // Exiting
    cell.exit().transition(transition).remove();

    // Entering
    const newCell = cell.enter().append('g')
      .attr('transform', d => `translate(${d.x0 + (d.x1 - d.x0)/2},${d.y0 + (d.y1 - d.y0)/2})`);

    newCell.append('rect')
      .attr('id', d => `rect-${d.id}`)
      .attr('width', 0)
      .attr('height', 0)
      .style('stroke-width', '1px')
      .on('click', (ev, d) => {
        ev.stopPropagation();
        (state.onClick || this.zoomToNode)(d.data, ev);
      })
      .on('contextmenu', (ev, d) => {
        ev.stopPropagation();
        if (state.onRightClick) {
          state.onRightClick(d.data, ev);
          ev.preventDefault();
        }
      })
      .on('mouseover', (ev, d) => {
        ev.stopPropagation();
        state.onHover && state.onHover(d.data, ev);

        state.tooltip.content(!!state.showTooltip(d.data, d) && `
          <div class="tooltip-title">
            ${state.tooltipTitle
              ? state.tooltipTitle(d.data, d)
              : getNodeStack(d)
                .slice(state.excludeRoot ? 1 : 0)
                .map(d => nameOf(d.data))
                .join(' &rarr; ')
            }
          </div>
          ${state.tooltipContent(d.data, d)}
        `);
      })
      .on('mouseout', () => state.tooltip.content(false));

    newCell.append('clipPath')
      .attr('id', d => `clip-${d.id}`)
      .append('use')
      .attr('xlink:href', d => `#rect-${d.id}`);

    const label = newCell.append('g')
      .attr('clip-path', d => `url(#clip-${d.id})`)
      .append('g')
        .attr('class', 'label-container')
        .append('text')
          .attr('class', 'path-label');

    // Entering + Updating
    const allCells = cell.merge(newCell);

    allCells.attr('class', d => [
      'node',
      ...(`${nodeClassNameOf(d.data) || ''}`.split(' ').map(str => str.trim()))
    ].filter(s => s).join(' '));

    allCells.transition(transition)
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    allCells.select('rect').transition(transition)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .style('fill', d => colorOf(d.data, d.parent))
      .style('stroke-width', `${1 / zoomTr.k}px`);

    allCells.select('g.label-container')
      .style('display', state.showLabels ? null : 'none')
      .transition(transition)
        .attr('transform', d => `translate(${(d.x1-d.x0)/2},${(d.y1-d.y0)/2})`);

    if (state.showLabels) {
      // Update previous scale
      const prevK = state.prevK || 1;
      state.prevK = zoomTr.k;

      allCells.select('text.path-label')
        .classed('light', d => !tinycolor(colorOf(d.data, d.parent)).isLight())
        .text(d => nameOf(d.data))
        .transition(transition)
          .style('opacity', d =>
            LABELS_WIDTH_OPACITY_SCALE((d.x1 - d.x0) * zoomTr.k / nameOf(d.data).length)
            * LABELS_HEIGHT_OPACITY_SCALE((d.y1 - d.y0) * zoomTr.k)
          )
          .attrTween('transform', function () {
            const kTr = d3Interpolate(prevK, zoomTr.k);
            return t => `scale(${1 / kTr(t)})`;
          });
    }

    //

    function getNodeStack(d) {
      const stack = [];
      let curNode = d;
      while (curNode) {
        stack.unshift(curNode);
        curNode = curNode.parent;
      }
      return stack;
    }
  }
});
