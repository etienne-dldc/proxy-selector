import { Proxyfier } from './Proxyfier';
import { SelectorAny, Selector, SelectorFunction, InputRef, CacheItem, CacheTree, Cache, CacheData } from './types';
import { TrackingLayer } from './TrackingLayer';
import { STATE } from './constant';
import { getOrSet, getIn, hasIn, notNil } from './utils';
import { PathTree } from './PathTree';

export const SelectManager = {
  create: createSelectManager,
};

function createSelectManager<State>() {
  const trackingProxyfier = Proxyfier.create();
  const cache: Cache<CacheItem> = new Map();

  // let proxyState: State = trackingProxyfier.proxify(state, STATE, null);
  let currentStateProxy: State;
  let currentState: State;
  let isExecuting: boolean = false;

  // This is used to keep track of the deppendencies
  let nextCacheTree: CacheTree | null = null;
  let nextCacheTreeCurrentPath: Array<{ selector: SelectorAny; input: any }> = [];

  function setCache(fragment: SelectorAny, input: InputRef, data: CacheData) {
    const fragCache = getOrSet(cache, fragment, new Map());
    if (!fragCache.has(input)) {
      fragCache.set(input, {
        data,
        resolvers: new Set(),
      });
    } else {
      const cacheObj = fragCache.get(input)!;
      fragCache.set(input, {
        data,
        resolvers: cacheObj.resolvers,
      });
    }
  }

  function getCache(fragment: SelectorAny, input: InputRef): CacheData | null {
    const fragCache = getOrSet(cache, fragment, new Map());
    const inputCache = fragCache.get(input);
    return inputCache ? inputCache.data : null;
  }

  function isEqual(tree: PathTree<boolean>, prev: any, next: any): boolean {
    let notEqual = false;
    PathTree.traverse(tree, (node, path) => {
      if (node.data && notEqual === false) {
        if (!hasIn(next, path)) {
          notEqual = true;
          return;
        }
        if (getIn(prev, path) !== getIn(next, path)) {
          notEqual = true;
          return;
        }
      }
    });
    return notEqual === false;
  }

  function updateCache(ref: symbol) {
    const nextCacheTreeDefined = notNil(nextCacheTree);
    // delete previous refs
    cache.forEach(v => {
      v.forEach(d => {
        d.resolvers.delete(ref);
      });
    });
    // update resolvers
    const traverse = (node: CacheTree) => {
      node.children.forEach((inputs, fragment) => {
        const frag = notNil(cache.get(fragment));
        inputs.forEach((d, input) => {
          const data = notNil(frag.get(input));
          data.resolvers.add(ref);
          traverse(d);
        });
      });
    };
    traverse(nextCacheTreeDefined);
    // remove unused cache
    cache.forEach((v, fragment) => {
      v.forEach((d, input) => {
        if (d.resolvers.size === 0) {
          v.delete(input);
        }
      });
      if (v.size === 0) {
        cache.delete(fragment);
      }
    });
  }

  function computeSelector<Input, Output>(
    selector: SelectorAny,
    select: SelectorFunction<State, Input, Output>,
    input: Input,
    parentCacheTree: CacheTree
  ): CacheData {
    console.log('compute');

    trackingProxyfier.pushLayer(name, selector, input);
    const fragmentCacheTree = getOrSet(parentCacheTree.children, selector, new Map());
    const currentCacheTree = {
      children: new Map(),
    };
    fragmentCacheTree.set(input, currentCacheTree);
    const result = select(currentStateProxy, input);
    const usedLayer = trackingProxyfier.popLayer();
    const { value: output, shape, paths } = trackingProxyfier.unwrap(result);
    const returnedLayer = TrackingLayer.create(name, selector, input);
    paths.forEach(path => {
      TrackingLayer.addPath(returnedLayer, path.type, path.input, path.path);
    });

    return {
      state: currentState,
      input,
      result: output,
      returned: returnedLayer.trees,
      used: usedLayer.trees,
      shape: shape,
      cacheTree: currentCacheTree,
    };
  }

  function getSelectorResult<Input, Output>(
    selector: SelectorAny,
    select: SelectorFunction<State, Input, Output>,
    input: Input
  ): Output {
    const parentCacheTree = nextCacheTreeCurrentPath.slice(0, -1).reduce((acc, val) => {
      return notNil(notNil(acc.children.get(val.selector)).get(val.input));
    }, notNil(nextCacheTree));
    let cache = getCache(selector, input);
    if (!cache) {
      // no cache, compute
      cache = computeSelector(selector, select, input, parentCacheTree);
    } else {
      const usedStateEqual = isEqual(cache.used.state, cache.state, currentState);
      const returnedStateEqual = isEqual(cache.returned.state, cache.state, currentState);
      let usedSelectorsChanged = false;
      cache.used.selectors.forEach((selectMap, selector) => {
        selectMap.forEach((selectCache, input) => {
          if (usedSelectorsChanged === false) {
            // const equal = isEqual(selectCache, )
          }
        });
      });
      if (usedStateEqual && returnedStateEqual) {
        console.log('hit cache');
        // TODO: Update state in cache ??
        // Simulate the selector being executed
        const fragmentCacheTree = getOrSet(parentCacheTree.children, selector, new Map());
        fragmentCacheTree.set(input, cache.cacheTree);
      } else {
        // update cache
        cache = computeSelector(selector, select, input, parentCacheTree);
      }
    }
    setCache(selector, input, cache);
    return cache.result;
  }

  function createSelector<Output, Input = void>(
    select: SelectorFunction<State, Input, Output>
  ): Selector<Input, Output> {
    const selector: SelectorAny = ((input: any) => {
      nextCacheTreeCurrentPath.push({ selector, input });
      const output = getSelectorResult(selector, select, input);
      nextCacheTreeCurrentPath.pop();
      return trackingProxyfier.proxify(output, selector, input);
    }) as any;
    selector.displayName = name;
    return selector as any;
  }

  function createContext() {
    const contextRef = Symbol();
    function execute<Output>(selector: () => Output, state: State): Output;
    function execute<Input, Output>(selector: (input: Input) => Output, state: State, input: Input): Output;
    function execute(selector: any, state: State, input?: any) {
      if (isExecuting) {
        throw new Error(`Already runotNilng !!`);
      }
      isExecuting = true;
      // Expose state "globally"
      currentState = state;
      currentStateProxy = trackingProxyfier.proxify(state, STATE, null);
      // reset tracking state
      nextCacheTree = {
        children: new Map(),
      };
      nextCacheTreeCurrentPath = [];
      const result = selector(input);
      updateCache(contextRef);
      isExecuting = false;
      return trackingProxyfier.unwrap(result).value;
    }
    return execute;
  }

  return {
    createSelector,
    createContext,
    getCache: () => cache,
  };
}
