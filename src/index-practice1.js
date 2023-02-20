//

// JSX 语法会自动调用，主要将JSX语法转化为JS对象
function createElement(type, props, ...children) {
  console.log("+++ createElement", type, props);
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

// ----- Concurrent mode ----- //

let nextUnitOfWork = null;

function workLoop(deadline) {
  let shouldYield = false;
  console.log("+++ workLoop", nextUnitOfWork);
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// ----- Concurrent mode END----- //

// 将 Fiber 构建成对应的 dom 节点
function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);
  const isProperty = (key) => key !== "children";
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name];
    });
  return dom;
}

let wipRoot = null;
let currentRoot = null; // 用于保存wipRoot ，wookLoop 会根据时候存在 wipRoot 决定是否执行 commitRoot
// 因为一旦执行一次 commitRoot, 就表示要进行更新，而setState中
let deletions = [];

// render: bound the object transfered from the JSX element with real dom
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

/**
 * @param {*} fiber
 *  1、add the fiber to the DOM
 *  2、create the fibers for the fiber children
 *  3、select the next unit of work
 *  In fact, fiber is both the nextUnitOfWork and the element in react
 */
function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  // 2、create the fibers for the elements children
  // build the relationship between fiber and its children
  const children = fiber.props.children;

  reconcileChildren(fiber, children);

  // 3、select the next unit of work
  if (fiber.child) {
    // them build the same relationship for current fiber's child
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.parent;
  }
  // the rule this func passed is like a triangle
  // from the top to the first child and then move to next sibling
  // Finaly, from the last fiber to the parent
  // now, the relationship of all fibers with its own triangle is builded
}

// assige the effectTag to the fiber
function reconcileChildren(wipFiber, elements) {
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let index = 0;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    let newFiber = null;
    let element = elements[index];

    let sameType = oldFiber && element && oldFiber.type === element.type;

    // update
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom, // reuse the dom
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    // placement
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null, // create the dom when performUnitOfWork
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    // delete
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETE";
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    // transfer oldFiber's relationship to newFiber
    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }

  console.log("+++ wipFiber", wipFiber);
}

// updateDom
const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);
function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = "";
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

// recursively append all the nodes to the dom
function commitRoot() {
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

// triangle again
function commitWork(fiber) {
  if (!fiber) return;

  const fiberParent = fiber.parent;
  // this step is to ensure find the fiber that has a dom
  // because after some deletions the dom of above fiber was removed
  while (!domParent.dom) {
    domParent = fiberParent.parent;
  }

  fiber.parent.dom.appendChild(fiber.dom);
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

const Didact = {
  createElement,
  render,
};

/** @jsx Didact.createElement */
const element = (
  <div>
    <text>here is</text>
  </div>
);

const container = document.getElementById("root");
Didact.render(element, container);
