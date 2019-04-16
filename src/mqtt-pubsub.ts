import { PubSubEngine } from 'graphql-subscriptions/dist/pubsub-engine';
import { PubSubAsyncIterator } from './pubsub-async-iterator';
import {
  connect,
  Client,
  ISubscriptionGrant,
  IClientPublishOptions,
  IClientSubscribeOptions
} from 'mqtt';

/**
 * PubSubMQTTOptions interface
 */
export interface PubSubMQTTOptions {
  /**
   * mqtt broker url
   */
  brokerUrl?: string;

  /**
   * Mqtt client
   */
  client?: Client;
  /**
   * connection listener method
   * @param err
   */
  connectionListener?: (err: Error) => void;
  /**
   * publish options
   */
  publishOptions?: PublishOptionsResolver;

  /**
   * subscribe options
   */
  subscribeOptions?: SubscribeOptionsResolver;

  /**
   * Mqtt subscribe method
   * @param id
   * @param granted
   */
  onMQTTSubscribe?: (id: number, granted: ISubscriptionGrant[]) => void;

  /**
   * trigger transform param
   */
  triggerTransform?: TriggerTransform;

  /**
   * type of message encode set
   */
  parseMessageWithEncoding?: BufferEncoding;
}

/**
 * MQTT Pub Sub class based in PubSubEngine
 */
export class MQTTPubSub implements PubSubEngine {

  /**
   * trigger transform param
   */
  private readonly triggerTransform: TriggerTransform;

  /**
   * Mqtt subscribe method
   */
  private onMQTTSubscribe: SubscribeHandler;

  /**
   * subscription option handler
   */
  private subscribeOptionsResolver: SubscribeOptionsResolver;

  /**
   * publish option handler
   */
  private publishOptionsResolver: PublishOptionsResolver;

  /**
   * Mqtt client
   */
  private mqttConnection: Client;

  /**
   * map of subscription
   */
  private readonly subscriptionMap: { [subId: number]: [string, Function] };

  /**
   * Subscription reference map
   */
  private readonly subsRefsMap: { [trigger: string]: Array<number> };

  /**
   * current subscription data
   */
  private currentSubscriptionId: number;

  /**
   * type of message encode set
   */
  private readonly parseMessageWithEncoding: BufferEncoding;

  /**
   * Checking for match for subscription
   *
   * @param pattern
   * @param topic
   */
  private static matches(pattern: string, topic: string): boolean {
    const patternSegments = pattern.split('/');
    const topicSegments = topic.split('/');
    const patternLength = patternSegments.length;

    for (let i = 0; i < patternLength; i++) {
      const currentPattern = patternSegments[i];
      const currentTopic = topicSegments[i];
      if (!currentTopic && !currentPattern) {
        continue;
      }
      if (!currentTopic && currentPattern !== '#') {
        return false;
      }
      if (currentPattern[0] === '#') {
        return i === (patternLength - 1);
      }
      if (currentPattern[0] !== '+' && currentPattern !== currentTopic) {
        return false;
      }
    }
    return patternLength === (topicSegments.length);
  }

  constructor(options: PubSubMQTTOptions = {}) {
    this.triggerTransform = options.triggerTransform || (trigger => trigger as string);

    if (options.client) {
      this.mqttConnection = options.client;
    } else {
      const brokerUrl = options.brokerUrl || 'mqtt://localhost';
      this.mqttConnection = connect(brokerUrl);
    }

    this.mqttConnection.on('message', this.onMessage.bind(this));

    if (options.connectionListener) {
      this.mqttConnection.on('connect', options.connectionListener);
      this.mqttConnection.on('error', options.connectionListener);
    } else {
      this.mqttConnection.on('error', console.error);
    }

    this.subscriptionMap = {};
    this.subsRefsMap = {};
    this.currentSubscriptionId = 0;
    this.onMQTTSubscribe = options.onMQTTSubscribe || (() => null);
    this.publishOptionsResolver = options.publishOptions || (() => Promise.resolve({} as IClientPublishOptions));
    this.subscribeOptionsResolver = options.subscribeOptions || (() => Promise.resolve({} as IClientSubscribeOptions));
    this.parseMessageWithEncoding = options.parseMessageWithEncoding;
  }

  /**
   * async PubSubEngine publish override
   * @param triggerName
   * @param payload
   */
  public async publish(triggerName: string, payload: any): Promise<void> {
    await this.publishOptionsResolver(triggerName, payload).then(publishOptions => {
      const message = Buffer.from(JSON.stringify(payload), this.parseMessageWithEncoding);

      this.mqttConnection.publish(triggerName, message, publishOptions);
    });
  }

  /**
   * PubSubEngine subscribe override
   * @param trigger
   * @param onMessage
   * @param options
   */
  public subscribe(trigger: string, onMessage: Function, options?: Object): Promise<number> {
    const triggerName: string = this.triggerTransform(trigger, options);
    const id = this.currentSubscriptionId++;
    this.subscriptionMap[id] = [triggerName, onMessage];

    let refs = this.subsRefsMap[triggerName];
    if (refs && refs.length > 0) {
      const newRefs = [...refs, id];
      this.subsRefsMap[triggerName] = newRefs;
      return Promise.resolve(id);

    } else {
      return new Promise<number>((resolve, reject) => {
        // 1. Resolve options object
        this.subscribeOptionsResolver(trigger, options).then(subscriptionOptions => {

          // 2. Subscribing using MQTT
          this.mqttConnection.subscribe(triggerName, { qos: 0, ...subscriptionOptions }, (err, granted) => {
            if (err) {
              reject(err);
            } else {

              // 3. Saving the new sub id
              const subscriptionIds = this.subsRefsMap[triggerName] || [];
              this.subsRefsMap[triggerName] = [...subscriptionIds, id];

              // 4. Resolving the subscriptions id to the Subscription Manager
              resolve(id);

              // 5. Notify implementor on the subscriptions ack and QoS
              this.onMQTTSubscribe(id, granted);
            }
          });
        }).catch(err => reject(err));
      });
    }
  }

  /**
   * PubSubEngine unsubscribe override
   * @param subId
   */
  public unsubscribe(subId: number): void {
    const [triggerName = null] = this.subscriptionMap[subId] || [];
    const refs = this.subsRefsMap[triggerName];

    if (!refs) {
      throw new Error(`There is no subscription of id "${subId}"`);
    }

    let newRefs;
    if (refs.length === 1) {
      this.mqttConnection.unsubscribe(triggerName);
      newRefs = [];

    } else {
      const index = refs.indexOf(subId);
      if (index > -1) {
        newRefs = [...refs.slice(0, index), ...refs.slice(index + 1)];
      }
    }

    this.subsRefsMap[triggerName] = newRefs;
    delete this.subscriptionMap[subId];
  }

  /**
   * PubSubEngine asyncIterator override
   * @param triggers
   */
  public asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
    return new PubSubAsyncIterator<T>(this, triggers);
  }

  /**
   * on message method
   * @param topic
   * @param message
   */
  private onMessage(topic: string, message: Buffer): void {
    const subscribers = [].concat(
        ...Object.keys(this.subsRefsMap)
        .filter((key) => MQTTPubSub.matches(key, topic))
        .map((key) => this.subsRefsMap[key])
    );

    // Don't work for nothing..
    if (!subscribers || !subscribers.length) {
      return;
    }
    const messageString = message.toString(this.parseMessageWithEncoding);
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(messageString);
    } catch (e) {
      parsedMessage = messageString;
    }

    for (const subId of subscribers) {
      const listener = this.subscriptionMap[subId][1];
      listener(parsedMessage);
    }
  }
}

/**
 * Path type
 */
export type Path = Array<string | number>;
/**
 * Trigger type
 */
export type Trigger = string | Path;
/**
 * TriggerTransform type method
 */
export type TriggerTransform = (trigger: Trigger, channelOptions?: Object) => string;
/**
 * SubscribeOptionsResolver type method
 */
export type SubscribeOptionsResolver = (trigger: Trigger, channelOptions?: Object) => Promise<IClientSubscribeOptions>;
/**
 * PublishOptionsResolver type method
 */
export type PublishOptionsResolver = (trigger: Trigger, payload: any) => Promise<IClientPublishOptions>;
/**
 * SubscribeHandler type method
 */
export type SubscribeHandler = (id: number, granted: ISubscriptionGrant[]) => void;
