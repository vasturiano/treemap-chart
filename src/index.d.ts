export interface ConfigOptions {}

type Accessor<In, Out> = Out | string | ((obj: In) => Out);
type NodeAccessor<T> = Accessor<Node, T>;

export interface Node {
  __dataNode?: DataNode;
  name?: string;
  children?: Node[];
}

export interface DataNode {
  data: Node;
  id: number;
  value: number;
  depth: number;
  height: number;
  parent: DataNode | null;
  children?: DataNode[];
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

type CompareFn<ItemType> = (a: ItemType, b: ItemType) => number;

type TooltipFn = (node: Node, dataNode: DataNode) => string;

declare class TreemapChart {
  constructor(element: HTMLElement, configOptions?: ConfigOptions);

  width(): number;
  width(width: number): TreemapChart;
  height(): number;
  height(height: number): TreemapChart;

  data(): Node;
  data(rootNode: Node): TreemapChart;
  children(): NodeAccessor<Node[]>;
  children(childrenAccessor: NodeAccessor<Node[]>): TreemapChart;
  label(): NodeAccessor<string>;
  label(textAccessor: NodeAccessor<string>): TreemapChart;
  size(): NodeAccessor<string>;
  size(sizeAccessor: NodeAccessor<string>): TreemapChart;
  padding(): number;
  padding(padding: number): TreemapChart;
  color(): NodeAccessor<string>;
  color(colorAccessor: NodeAccessor<string>): TreemapChart;
  nodeClassName(): NodeAccessor<string>;
  nodeClassName(nodeClassName: NodeAccessor<string>): TreemapChart;

  minBlockArea(): number;
  minBlockArea(area: number): TreemapChart;
  excludeRoot(): boolean;
  excludeRoot(exclude: boolean): TreemapChart;

  sort(): CompareFn<Node> | null;
  sort(cmpFn: CompareFn<Node> | null): TreemapChart;

  showLabels(): boolean;
  showLabels(show: boolean): TreemapChart;
  showTooltip(): (node: Node) => boolean;
  showTooltip(showTooltipFn: (node: Node) => boolean): TreemapChart;
  tooltipTitle(): TooltipFn;
  tooltipTitle(fn: TooltipFn): TreemapChart;
  tooltipContent(): TooltipFn;
  tooltipContent(fn: TooltipFn): TreemapChart;

  onClick(cb: ((node: Node, event: MouseEvent) => void) | null): TreemapChart;
  onRightClick(cb: ((node: Node, event: MouseEvent) => void) | null): TreemapChart;
  onHover(cb: ((node: Node | null, event: MouseEvent) => void) | null): TreemapChart;

  zoomToNode(node: Node): TreemapChart;
  zoomBy(k: number):TreemapChart;
  zoomReset():TreemapChart;

  transitionDuration(): number;
  transitionDuration(duration: number): TreemapChart;
}

export default TreemapChart;
