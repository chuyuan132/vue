/**
 * 存储桶
 * @type {WeakMap<WeakKey, Map<key, Set>>}
 */
const bucket = new WeakMap();
/**
 * 当前激活的副作用函数
 * @type {null}
 */
let activeEffect = null;
/**
 * 副作用函数执行栈
 * @type {*[]}
 */
const effectStack = [];


const defaultOptions = {
  scheduler: null,
  lazy: false,
};

/**
 * 将fn包装成一个副作用函数，在目标函数执行上下文加入自定义的逻辑
 * @param fn
 * @param options
 * @returns {function(): *}
 */
function effect(fn, options = defaultOptions) {
  // 对fn进行一层包装，融入自定义的上下文逻辑
  function effectFn() {
    clean(effectFn); // 将当前副作用函数从所有依赖集合中移除
    activeEffect = effectFn; // 将当前副作用函数赋值给全局变量，用于依赖收集
    effectStack.push(effectFn); // 处理嵌套Effect问题
    const res = fn(); // 处理获取fn函数返回值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  }
  // 开始执行具体逻辑
  effectFn.deps = [];
  effectFn.options = options;
  if (options.lazy) {
    return effectFn;
  }
  effectFn();
}

/**
 * 副作用清理函数
 * @param effectFn
 */
function clean(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  // [].delete不会动态改变数组长度，需要手动处理
  effectFn.deps.length = 0;
}

/**
 * 依赖收集，核心是通过activeEffect全局变量来实现的
 * @param target
 * @param key
 */
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

/**
 * 依赖触发
 * @param target
 * @param key
 */
function trigger(target, key) {
  let depsMap = bucket.get(target);
  if (!depsMap) return;
  let deps = depsMap.get(key);
  // 为什么需要新开一个Set呢，因为在遍历deps的时候，执行effectFn函数时会执行【清除依赖，执行fn依赖收集】，始终对同一个set操作，会死循环
  const newSet = new Set(deps);
  newSet &&
    newSet.forEach((fn) => {
      // 为什么需要加以下判断呢？试想以下执行effectFn时，同时存在属性的读写，会导致死循环
      if (fn !== activeEffect) {
        if (fn.options.scheduler) {
          fn.options.scheduler(fn);
        } else {
          fn();
        }
      }
    });
}

/**
 * 创建proxy对象代理
 * @param obj
 * @returns {*|object|boolean}
 */
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
