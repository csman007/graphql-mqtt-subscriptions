"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pubsub_async_iterator_1 = require("./pubsub-async-iterator");
var mqtt_1 = require("mqtt");
var MQTTPubSub = (function () {
    function MQTTPubSub(options) {
        if (options === void 0) { options = {}; }
        this.triggerTransform = options.triggerTransform || (function (trigger) { return trigger; });
        if (options.client) {
            this.mqttConnection = options.client;
        }
        else {
            var brokerUrl = options.brokerUrl || 'mqtt://localhost';
            this.mqttConnection = mqtt_1.connect(brokerUrl);
        }
        this.mqttConnection.on('message', this.onMessage.bind(this));
        if (options.connectionListener) {
            this.mqttConnection.on('connect', options.connectionListener);
            this.mqttConnection.on('error', options.connectionListener);
        }
        else {
            this.mqttConnection.on('error', console.error);
        }
        this.subscriptionMap = {};
        this.subsRefsMap = {};
        this.currentSubscriptionId = 0;
        this.onMQTTSubscribe = options.onMQTTSubscribe || (function () { return null; });
        this.publishOptionsResolver = options.publishOptions || (function () { return Promise.resolve({}); });
        this.subscribeOptionsResolver = options.subscribeOptions || (function () { return Promise.resolve({}); });
        this.parseMessageWithEncoding = options.parseMessageWithEncoding;
    }
    MQTTPubSub.matches = function (pattern, topic) {
        var patternSegments = pattern.split('/');
        var topicSegments = topic.split('/');
        var patternLength = patternSegments.length;
        for (var i = 0; i < patternLength; i++) {
            var currentPattern = patternSegments[i];
            var currentTopic = topicSegments[i];
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
    };
    MQTTPubSub.prototype.publish = function (triggerName, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.publishOptionsResolver(triggerName, payload).then(function (publishOptions) {
                            var message = Buffer.from(JSON.stringify(payload), _this.parseMessageWithEncoding);
                            _this.mqttConnection.publish(triggerName, message, publishOptions);
                        })];
                    case 1:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    MQTTPubSub.prototype.subscribe = function (trigger, onMessage, options) {
        var _this = this;
        var triggerName = this.triggerTransform(trigger, options);
        var id = this.currentSubscriptionId++;
        this.subscriptionMap[id] = [triggerName, onMessage];
        var refs = this.subsRefsMap[triggerName];
        if (refs && refs.length > 0) {
            var newRefs = refs.concat([id]);
            this.subsRefsMap[triggerName] = newRefs;
            return Promise.resolve(id);
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.subscribeOptionsResolver(trigger, options).then(function (subscriptionOptions) {
                    _this.mqttConnection.subscribe(triggerName, __assign({ qos: 0 }, subscriptionOptions), function (err, granted) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            var subscriptionIds = _this.subsRefsMap[triggerName] || [];
                            _this.subsRefsMap[triggerName] = subscriptionIds.concat([id]);
                            resolve(id);
                            _this.onMQTTSubscribe(id, granted);
                        }
                    });
                }).catch(function (err) { return reject(err); });
            });
        }
    };
    MQTTPubSub.prototype.unsubscribe = function (subId) {
        var _a = (this.subscriptionMap[subId] || [])[0], triggerName = _a === void 0 ? null : _a;
        var refs = this.subsRefsMap[triggerName];
        if (!refs) {
            throw new Error("There is no subscription of id \"" + subId + "\"");
        }
        var newRefs;
        if (refs.length === 1) {
            this.mqttConnection.unsubscribe(triggerName);
            newRefs = [];
        }
        else {
            var index = refs.indexOf(subId);
            if (index > -1) {
                newRefs = refs.slice(0, index).concat(refs.slice(index + 1));
            }
        }
        this.subsRefsMap[triggerName] = newRefs;
        delete this.subscriptionMap[subId];
    };
    MQTTPubSub.prototype.asyncIterator = function (triggers, options) {
        return new pubsub_async_iterator_1.PubSubAsyncIterator(this, triggers, options);
    };
    MQTTPubSub.prototype.onMessage = function (topic, message) {
        var _this = this;
        var subscribers = [].concat.apply([], Object.keys(this.subsRefsMap)
            .filter(function (key) { return MQTTPubSub.matches(key, topic); })
            .map(function (key) { return _this.subsRefsMap[key]; }));
        if (!subscribers || !subscribers.length) {
            return;
        }
        var messageString = message.toString(this.parseMessageWithEncoding);
        var parsedMessage;
        try {
            parsedMessage = JSON.parse(messageString);
        }
        catch (e) {
            parsedMessage = messageString;
        }
        for (var _i = 0, subscribers_1 = subscribers; _i < subscribers_1.length; _i++) {
            var subId = subscribers_1[_i];
            var listener = this.subscriptionMap[subId][1];
            listener(parsedMessage);
        }
    };
    return MQTTPubSub;
}());
exports.MQTTPubSub = MQTTPubSub;
//# sourceMappingURL=mqtt-pubsub.js.map