import { SelectorAny, InputRef, ProxyType, Path } from './types';
import { PathTree } from './PathTree';
import { STATE } from './constant';
import { notNil } from './utils';

export type TrackingLayerDeps = {
  state: PathTree<boolean>;
  selectors: Map<SelectorAny, Map<InputRef, PathTree<boolean>>>;
};

export type TrackingLayer = {
  name: string;
  selector: SelectorAny;
  input: any;
  trees: TrackingLayerDeps;
};

export const TrackingLayer = {
  create,
  addPath,
  getPathTree,
};

// Functions

function create(name: string, selector: SelectorAny, input: any): TrackingLayer {
  return {
    name,
    selector,
    input,
    trees: {
      selectors: new Map(),
      state: PathTree.create(false),
    },
  };
}

function getPathTree(layer: TrackingLayer, type: ProxyType, input: InputRef): PathTree<boolean> {
  if (type === STATE) {
    return layer.trees.state;
  }
  if (!layer.trees.selectors.has(type)) {
    layer.trees.selectors.set(type, new Map());
  }
  const selector = notNil(layer.trees.selectors.get(type));
  if (!selector.has(input)) {
    selector.set(input, PathTree.create(false));
  }
  return notNil(selector.get(input));
}

function addPath(layer: TrackingLayer, type: ProxyType, input: InputRef, path: Path) {
  PathTree.addPath(getPathTree(layer, type, input), path, true);
}
