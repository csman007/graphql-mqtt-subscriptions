import { $$asyncIterator } from 'iterall';
import { PubSubEngine } from 'graphql-subscriptions';

/**
 * A class for digesting PubSubEngine events via the new AsyncIterator interface.
 * This implementation is a generic version of the one located at
 * https://github.com/apollographql/graphql-subscriptions/blob/master/src/event-emitter-to-async-iterator.ts
 * @class
 *
 * @constructor
 *
 * @property pullQueue @type {Function[]}
 * A queue of resolve functions waiting for an incoming event which has not yet arrived.
 * This queue expands as next() calls are made without PubSubEngine events occurring in between.
 *
 * @property pushQueue @type {any[]}
 * A queue of PubSubEngine events waiting for next() calls to be made.
 * This queue expands as PubSubEngine events arrice without next() calls occurring in between.
 *
 * @property eventsArray @type {string[]}
 * An array of PubSubEngine event names which this PubSubAsyncIterator should watch.
 *
 * @property allSubscribed @type {Promise<number[]>}
 * A promise of a list of all subscription ids to the passed PubSubEngine.
 *
 * @property listening @type {boolean}
 * Whether or not the PubSubAsynIterator is in listening mode (responding to incoming PubSubEngine events and next() calls).
 * Listening begins as true and turns to false once the return method is called.
 *
 * @property pubsub @type {PubSubEngine}
 * The PubSubEngine whose events will be observed.
 */
export class PubSubAsyncIterator<T> implements AsyncIterator<T> {

  /**
   * pull from queue
   */
  private pullQueue: Function[];

  /**
   * push to queue
   */
  private pushQueue: any[];
  /**
   * Array fo available events
   */
  private eventsArray: string[];

  /**
   * all subscription stored into this
   */
  private readonly allSubscribed: Promise<number[]>;

  /**
   * checking if listening
   */
  private listening: boolean;

  /**
   * graphql pubsub
   */
  private pubsub: PubSubEngine;

  /**
   * options object
   */
  private options: Object;

  constructor(pubsub: PubSubEngine, eventNames: string | string[], options?: Object) {
    this.pubsub = pubsub;
    this.options = options;
    this.pullQueue = [];
    this.pushQueue = [];
    this.listening = true;
    this.eventsArray = typeof eventNames === 'string' ? [eventNames] : eventNames;
    this.allSubscribed = this.subscribeAll();
  }

  /**
   * next method
   */
  public async next(): Promise<IteratorResult<any>> {
    await this.allSubscribed;
    return this.listening ? this.pullValue() : this.return();
  }

  /**
   * return method
   */
  public async return(): Promise<any> {
    this.emptyQueue(await this.allSubscribed);
    return { value: undefined, done: true };
  }

  /**
   * Error thrown
   * @param error
   */
  public async throw(error): Promise<IteratorResult<T>> {
    this.emptyQueue(await this.allSubscribed);
    return Promise.reject(error);
  }

  /**
   * $$asyncIterator named function, generated on the fly
   */
  public [$$asyncIterator](): PubSubAsyncIterator<T> {
    return this;
  }

  /**
   * async push value method
   * @param event
   */
  private async pushValue(event): Promise<void> {
    await this.allSubscribed;
    if (this.pullQueue.length !== 0) {
      this.pullQueue.shift()({ value: event, done: false });
    } else {
      this.pushQueue.push(event);
    }
  }

  /**
   * Pull value method
   */
  private pullValue(): Promise<IteratorResult<any>> {
    return new Promise(resolve => {
      if (this.pushQueue.length !== 0) {
        resolve({ value: this.pushQueue.shift(), done: false });
      } else {
        this.pullQueue.push(resolve);
      }
    });
  }

  /**
   * Emptying queue method
   * @param subscriptionIds
   */
  private emptyQueue(subscriptionIds: number[]): void {
    if (this.listening) {
      this.listening = false;
      this.unsubscribeAll(subscriptionIds);
      this.pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
      this.pullQueue.length = 0;
      this.pushQueue.length = 0;
    }
  }

  /**
   * subscribe method on all channel
   */
  private subscribeAll(): Promise<Array<number>> {
    return Promise.all(this.eventsArray.map(
        eventName => this.pubsub.subscribe(eventName, this.pushValue.bind(this), {})
    ));
  }

  /**
   * unsubscribe method
   * @param subscriptionIds
   */
  private unsubscribeAll(subscriptionIds: number[]): void {
    for (const subscriptionId of subscriptionIds) {
      this.pubsub.unsubscribe(subscriptionId);
    }
  }

}
