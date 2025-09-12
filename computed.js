import { effect, track, trigger } from "./effect.js";

export default function computed(getter) {
  let dirty = true;
  let value = null;

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      trigger(obj, "value");
    },
  });

  return obj;
}
