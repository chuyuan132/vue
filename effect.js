const bucket = new WeakMap();
let activeEffect = null;
const effectStack = [];

const defaultOptions = {
  scheduler: null,
  lazy: false,
};

function effect(fn, options = defaultOptions) {
  function effectFn() {
    clean(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    const res = fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  }
  effectFn.deps = [];
  effectFn.options = options;
  if (options.lazy) {
    return effectFn;
  }
  effectFn();
}

// 清理函数
function clean(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

// 依赖收集
function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

// 触发依赖
function trigger(target, key) {
  let depsMap = bucket.get(target);
  if (!depsMap) return;
  let deps = depsMap.get(key);
  const newSet = new Set(deps);
  newSet &&
    newSet.forEach((fn) => {
      if (fn !== activeEffect) {
        if (fn.options.scheduler) {
          fn.options.scheduler(fn);
        } else {
          fn();
        }
      }
    });
}

function createProxy(obj) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key);
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      trigger(target, key);
      return true;
    },
  });
}

export { effect, createProxy, track, trigger };
