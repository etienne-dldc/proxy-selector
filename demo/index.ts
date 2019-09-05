import { SelectManager } from '../lib';

type State = {
  demo: boolean;
  data: Array<number>;
};

const state1 = {
  demo: true,
  data: [0, 1, 3],
};

const state2 = {
  demo: false,
  data: [2, 6, 8, 4],
};

const state3 = {
  ...state2,
  demo: true,
};

const manager = SelectManager.create<State>();

const demo = manager.createSelector(s => ({
  test: s.data,
  yolo: s.demo,
}));

const ctx = manager.createContext();

console.log(ctx(demo, state1));
console.log('----');
console.log(ctx(demo, state1));
console.log('----');
console.log(ctx(demo, state2));
console.log('----');
console.log(ctx(demo, state2));
console.log('----');
console.log(ctx(demo, state2));
console.log('----');
console.log(ctx(demo, state2));
console.log('----');
console.log(ctx(demo, state2));
console.log('----');

console.log('=====');

const selectArr = manager.createSelector(s => s.data);

console.log(ctx(selectArr, state1));
console.log(ctx(selectArr, state2));
console.log(ctx(selectArr, state3));
console.log(ctx(selectArr, state3) === ctx(selectArr, state2));
console.log(ctx(selectArr, state3) === ctx(selectArr, state1));

console.log(manager.getCache());
