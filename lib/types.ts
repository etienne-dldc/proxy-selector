import { STATE } from './constant';
import { TrackingLayerDeps } from './TrackingLayer';

export type SelectorFunction<State, Input, Output> = (state: State, input: Input) => Output;

export type Selector<Input, Output> = ([Input] extends [void]
  ? () => Output
  : (input: Input) => Output) & {
  displayName: string;
};

export type SelectorAny = Selector<any, any>;

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export type MergeInOut<In, Out> = [In, Out] extends [object, object]
  ? Omit<In, keyof Out> & Out
  : Out;

export type InputRef = any;

export type ProxyType = (typeof STATE) | SelectorAny;

export type PathPart = string | number | symbol;

export type Path = Array<PathPart>;

export type Resolver = symbol;

export type CacheData = {
  state: any;
  input: any;
  // the value of the cached value
  result: any;
  // Same as value but with UnwrapedPath instead of raw value
  // If only returned have changed, this is used to build the next result
  shape: any;
  // Deps found in the returned object
  returned: TrackingLayerDeps;
  // Deps used in the selector function
  used: TrackingLayerDeps;
  // Sub dependencies (selector used in the selector function)
  cacheTree: CacheTree;
};

export type CacheItem = {
  data: CacheData;
  // which resolvers are using this cache
  // this is used to detect and cleanup unused cache
  resolvers: Set<Resolver>;
};

// Selector => Input => Data
export type Cache<Data> = Map<SelectorAny, Map<InputRef, Data>>;

export type CacheTree = {
  children: Cache<CacheTree>;
};

export type UnwrapedPath = {
  type: ProxyType;
  path: Path;
  input: InputRef;
};

export type Unwraped = {
  paths: Array<UnwrapedPath>;
  value: any;
  shape: any;
};
