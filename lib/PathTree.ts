import { Path, PathPart } from './types';
import { notNil } from './utils';

export type PathTreeMap<Data> = Map<PathPart, PathTree<Data>>;

export type PathTree<Data> = {
  data: null | Data;
  paths: PathTreeMap<Data>;
};

export const PathTree = {
  create,
  addPath,
  toObject,
  toPaths,
  getNode,
  getData,
  traverse,
};

// Functions

function create<Data>(rootData: Data): PathTree<Data> {
  return {
    data: rootData,
    paths: new Map(),
  };
}

function addPath<Data>(tree: PathTree<Data>, path: Path, data: Data | null) {
  path.reduce<PathTreeMap<any>>((acc, key) => {
    if (!acc.has(key)) {
      acc.set(key, { paths: new Map(), data: null });
    }
    return notNil(acc.get(key)).paths;
  }, tree.paths);
  if (data !== null) {
    const node = getNode(tree, path);
    node.data = data;
  }
}

function getNode<Data>(tree: PathTree<Data>, path: Path): PathTree<Data> {
  if (path.length === 0) {
    return tree;
  }
  const parentPath = path.slice(0, -1);
  const parent = parentPath.reduce<PathTreeMap<any>>((acc, key) => {
    return notNil(notNil(acc.get(key)).paths);
  }, tree.paths);
  return notNil(parent.get(path[path.length - 1]));
}

function getData<Data>(tree: PathTree<Data>, path: Path): Data | null {
  return getNode(tree, path).data;
}

function toPaths<Data>(tree: PathTree<Data>, filter: (data: Data | null) => boolean): Array<Path> {
  const traverse = (node: PathTree<Data>, key: PathPart): Array<Path> => {
    const self = filter ? (filter(node.data) ? [[key]] : []) : [[key]];
    const sub = Array.from(node.paths.entries())
      .map(([subKey, val]) => {
        return traverse(val, subKey);
      })
      .reduce<Array<Path>>((acc, v) => {
        return acc.concat(v);
      }, []);
    return [...self, ...sub.map(p => [key, ...p])];
  };
  return traverse(tree, 'ROOT');
}

function toObject(tree: PathTree<any>): object {
  const toObj = (map: PathTreeMap<any>): object => {
    return Array.from(map.entries()).reduce<object>((acc, [key, val]) => {
      (acc as any)[String(key)] = toObj(val.paths);
      return acc;
    }, {});
  };
  return toObj(tree.paths);
}

function traverse<Data>(
  tree: PathTree<Data>,
  onNode: (node: PathTree<Data>, path: Array<PathPart>) => void,
  parentPath: Array<PathPart> = []
) {
  onNode(tree, parentPath);
  tree.paths.forEach((node, key) => {
    traverse(node, onNode, [...parentPath, key]);
  });
}
