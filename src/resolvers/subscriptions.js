const { pubsub } = require('./mutations');
const { requireAuth } = require('../auth');

function createAsyncIterator(engine, triggerName) {
  const pullQueue = [];
  const pushQueue = [];
  let listening = true;
  let subscriptionId;

  const pushValue = (event) => {
    if (pullQueue.length !== 0) {
      const resolver = pullQueue.shift();
      resolver({ value: event, done: false });
      return;
    }

    pushQueue.push(event);
  };

  const pullValue = () =>
    new Promise((resolve) => {
      if (pushQueue.length !== 0) {
        const value = pushQueue.shift();
        resolve({ value, done: false });
        return;
      }

      pullQueue.push(resolve);
    });

  const emptyQueue = async () => {
    if (!listening) {
      return { value: undefined, done: true };
    }

    listening = false;
    if (subscriptionId !== undefined) {
      await engine.unsubscribe(subscriptionId);
    }

    while (pullQueue.length !== 0) {
      const resolver = pullQueue.shift();
      resolver({ value: undefined, done: true });
    }

    pushQueue.length = 0;
    return { value: undefined, done: true };
  };

  const init = Promise.resolve(engine.subscribe(triggerName, pushValue)).then((id) => {
    subscriptionId = id;
  });

  return {
    next() {
      return init.then(() => (listening ? pullValue() : { value: undefined, done: true }));
    },
    return() {
      return emptyQueue();
    },
    throw(error) {
      return emptyQueue().then(() => Promise.reject(error));
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

module.exports = {
  tripCreated: {
    subscribe: (_parent, _args, context) => {
      requireAuth(context);
      return createAsyncIterator(pubsub, 'TRIP_CREATED');
    }
  },
  bookingCreated: {
    subscribe: (_parent, _args, context) => {
      requireAuth(context);
      return createAsyncIterator(pubsub, 'BOOKING_CREATED');
    }
  },
  reviewAdded: {
    subscribe: (_parent, _args, context) => {
      requireAuth(context);
      return createAsyncIterator(pubsub, 'REVIEW_ADDED');
    }
  }
};