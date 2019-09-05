import { PathTree } from './PathTree';
import { ProxyType, SelectorAny, Path, Unwraped, UnwrapedPath } from './types';
import { TrackingLayer } from './TrackingLayer';
import { IS_PROXY, PATH, ROOT, VALUE, INPUT } from './constant';
import isPlainObject from 'is-plain-object';
import { notNil } from './utils';

const ARRAY_MUTATION_METHODS_NAMES = new Set([
  'push',
  'shift',
  'pop',
  'unshift',
  'splice',
  'reverse',
  'sort',
  'copyWithin',
]);

export const Proxyfier = {
  create: createProxyfier,
};

function createProxyfier() {
  const layers: Array<TrackingLayer> = [];

  function getLayer(): TrackingLayer {
    if (layers.length === 0) {
      throw new Error('No layers ?');
    }
    return layers[layers.length - 1];
  }

  function getPathTree(type: ProxyType, input: any): PathTree<boolean> {
    const layer = getLayer();
    return TrackingLayer.getPathTree(layer, type, input);
  }

  function addPath(type: ProxyType, input: any, path: Path) {
    PathTree.addPath(getPathTree(type, input), path, true);
  }

  function createArrayProxy<T extends Array<any>>(value: T, type: ProxyType, input: any, path: Path): T {
    const handlers: ProxyHandler<T> = {
      get: (target, prop) => {
        if (prop === IS_PROXY) return true;
        if (prop === PATH) return path;
        if (prop === ROOT) return type;
        if (prop === VALUE) return value;
        if (prop === INPUT) return input;

        if (prop === 'length') {
          addPath(type, input, path);
          return target.length;
        }

        if (typeof prop === 'symbol') {
          throw new Error(`Not allowed`);
        }

        if (typeof (target as any)[prop] === 'function') {
          if (ARRAY_MUTATION_METHODS_NAMES.has(String(prop))) {
            throw new Error(`Not allowed`);
          }
          if (prop === 'find') {
            return (finder: any) => {
              addPath(type, input, path);
              const mapped = target.map((v, i) => proxify(v, type, input, [...path, i]));
              return mapped.find(finder);
            };
          }
          if (prop === 'map') {
            return (mapper: any) => {
              addPath(type, input, path);
              return target.map((val, i, arr) => {
                return mapper(proxify(val, type, input, [...path, i]), i, proxify(arr, type, input, path));
              });
            };
          }
          throw new Error(`Not supported method ${prop}`);
        }

        const nestedPath = [...path, prop];

        return proxify((target as any)[prop], type, input, nestedPath);
      },
      set: (_target, _prop, _value) => {
        throw new Error(`Not allowed`);
      },
    };

    return new Proxy(value, handlers);
  }

  function createObjectProxy<T extends object>(value: T, type: ProxyType, input: any, path: Path): T {
    const handlers: ProxyHandler<T> = {
      get: (target, prop) => {
        if (prop === IS_PROXY) return true;
        if (prop === PATH) return path;
        if (prop === ROOT) return type;
        if (prop === VALUE) return value;
        if (prop === INPUT) return input;

        if (typeof prop === 'symbol') {
          throw new Error(`Not allowed`);
        }

        if (prop in Object.prototype) {
          throw new Error(`Not allowed`);
        }

        const descriptor = Object.getOwnPropertyDescriptor(target, prop);

        if (descriptor && 'get' in descriptor) {
          throw new Error(`getter are not supportted`);
        }

        const targetValue = (target as any)[prop];
        const nestedPath = [...path, prop];

        if (typeof targetValue === 'function') {
          throw new Error(`function are not supportted`);
        }

        return proxify(targetValue, type, input, nestedPath);
      },
      set: (_target, _prop, _value) => {
        throw new Error(`Not allowed`);
      },
      deleteProperty: (_target, _prop) => {
        throw new Error(`Not allowed`);
      },
      ownKeys: target => {
        addPath(type, input, path);
        return Reflect.ownKeys(target);
      },
    };

    return new Proxy(value, handlers);
  }

  function proxify<T extends any>(value: T, type: ProxyType, input: any, path: Path = []): T {
    if (value) {
      if (value[IS_PROXY]) {
        // re-proxy to set correct type & path
        return proxify(value[VALUE], type, input, path);
      } else if (isPlainObject(value)) {
        return createObjectProxy(value as any, type, input, path);
      } else if (Array.isArray(value)) {
        return createArrayProxy(value, type, input, path);
      }
    }
    if (layers.length > 0) {
      addPath(type, input, path);
    }
    return value;
  }

  function isProxy(value: any): boolean {
    return value && value[IS_PROXY];
  }

  function unproxify<V extends any>(value: V): V {
    if (isProxy(value)) {
      return value[VALUE];
    }
    return value;
  }

  function getLayerPath(): Array<{ selector: SelectorAny; input: any }> {
    return layers.map(layer => ({ selector: layer.selector, input: layer.input }));
  }

  function getLastLayer(): TrackingLayer | null {
    return layers[layers.length - 1] || null;
  }

  function pushLayer(name: string, selector: SelectorAny, input: any) {
    layers.push(TrackingLayer.create(name, selector, input));
  }

  function popLayer(): TrackingLayer {
    return notNil(layers.pop());
  }

  function getLayersCount(): number {
    return layers.length;
  }

  function unwrap(value: any): Unwraped {
    if (isProxy(value)) {
      const shape: UnwrapedPath = {
        path: value[PATH],
        type: value[ROOT],
        input: value[INPUT],
      };

      return {
        paths: [shape],
        value: value[VALUE],
        shape: shape,
      };
    }
    if (isPlainObject(value)) {
      const paths: Array<UnwrapedPath> = [];
      const resValue: { [key: string]: any } = {};
      const resShape: { [key: string]: any } = {};
      Object.keys(value).forEach(key => {
        const res = unwrap(value[key]);
        paths.push(...res.paths);
        resValue[key] = res.value;
        resShape[key] = res.shape;
      });
      return {
        paths,
        value: resValue,
        shape: resShape,
      };
    }
    if (Array.isArray(value)) {
      const paths: Array<UnwrapedPath> = [];
      const resShape: Array<any> = [];
      const resValue = value.map(val => {
        const res = unwrap(val);
        paths.push(...res.paths);
        resShape.push(res.shape);
        return res.value;
      });
      return {
        paths,
        value: resValue,
        shape: resShape,
      };
    }
    // console.info(`Ignore ${typeof value}`);
    return {
      paths: [],
      value,
      shape: value,
    };
  }

  return {
    getLayerPath,
    getLastLayer,
    pushLayer,
    popLayer,
    getLayersCount,
    unwrap,
    unproxify,
    proxify,
  };
}
