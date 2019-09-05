export function notNil<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) {
    throw new Error(`Invariant: value should not be null | undefined`);
  }
  return val;
}

export function getOrSet<M extends Map<any, any>>(
  map: M,
  key: M extends Map<infer K, any> ? K : never,
  val: M extends Map<any, infer V> ? V : never
): M extends Map<any, infer V> ? V : never {
  if (!map.has(key)) {
    map.set(key, val);
  }
  return notNil(map.get(key));
}

export function getIn(obj: any, path: Array<string | number | symbol>): any {
  return path.reduce((acc, v) => {
    return acc[v];
  }, obj);
}

export function hasIn(obj: any, path: Array<string | number | symbol>): boolean {
  let result = true;
  // ignore last
  path.slice(0, -1).reduce((acc, v) => {
    if (!result) {
      return;
    }
    if (!acc[v]) {
      result = false;
    }
  }, obj);
  return result;
}
