import { PubSubEngine } from 'graphql-subscriptions';
export declare class PubSubAsyncIterator<T> implements AsyncIterator<T> {
    private pullQueue;
    private pushQueue;
    private eventsArray;
    private readonly allSubscribed;
    private listening;
    private pubsub;
    private options;
    constructor(pubsub: PubSubEngine, eventNames: string | string[], options?: Object);
    next(): Promise<IteratorResult<any>>;
    return(): Promise<any>;
    throw(error: any): Promise<IteratorResult<T>>;
    private pushValue;
    private pullValue;
    private emptyQueue;
    private subscribeAll;
    private unsubscribeAll;
}
