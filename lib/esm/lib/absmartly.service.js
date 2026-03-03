var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Inject, Injectable, Optional, signal } from '@angular/core';
import absmartly from '@absmartly/javascript-sdk';
import { ABSMARTLY_CONFIG, ABSMARTLY_CONTEXT, } from './absmartly.types';
let ABSmartlyService = class ABSmartlyService {
    constructor(config, existingContext) {
        this.config = config;
        this.ready = signal(false);
        this.failed = signal(false);
        this.loading = signal(true);
        this.error = signal(null);
        if (existingContext) {
            this.sdk = existingContext.getSDK();
            this.context = existingContext;
            this.initializeState();
            return;
        }
        this.sdk = new absmartly.SDK({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            environment: config.environment,
            application: config.application,
            retries: config.retries ?? 5,
            timeout: config.timeout ?? 3000,
            eventLogger: config.eventLogger,
        });
        this.context = this.sdk.createContext({
            units: config.units,
            publishDelay: config.publishDelay ?? -1,
            refreshPeriod: config.refreshPeriod ?? 0,
        });
        this.initializeState();
    }
    initializeState() {
        if (this.context.isReady()) {
            this.ready.set(true);
            this.failed.set(this.context.isFailed());
            this.loading.set(false);
            return;
        }
        this.context
            .ready()
            .then(() => {
            this.ready.set(true);
            this.failed.set(this.context.isFailed());
            this.loading.set(false);
            this.error.set(null);
        })
            .catch((e) => {
            const err = e instanceof Error ? e : new Error(String(e));
            this.error.set(err);
            this.failed.set(true);
            this.loading.set(false);
        });
    }
    treatment(experimentName) {
        return this.context.treatment(experimentName) ?? 0;
    }
    peek(experimentName) {
        return this.context.peek(experimentName) ?? 0;
    }
    variableValue(key, defaultValue) {
        return this.context.variableValue(key, defaultValue);
    }
    peekVariableValue(key, defaultValue) {
        return this.context.peekVariableValue(key, defaultValue);
    }
    variableKeys() {
        return this.context.variableKeys();
    }
    track(goalName, properties) {
        this.context.track(goalName, properties);
    }
    attribute(name, value) {
        this.context.attribute(name, value);
    }
    attributes(attrs) {
        this.context.attributes(attrs);
    }
    getAttribute(name) {
        return this.context.getAttribute(name);
    }
    override(experimentName, variant) {
        this.context.override(experimentName, variant);
    }
    customAssignment(experimentName, variant) {
        this.context.customAssignment(experimentName, variant);
    }
    customFieldValue(experimentName, fieldName) {
        return this.context.customFieldValue(experimentName, fieldName);
    }
    customFieldKeys() {
        return this.context.customFieldKeys();
    }
    customFieldValueType(experimentName, fieldName) {
        return this.context.customFieldValueType(experimentName, fieldName);
    }
    setUnit(type, uid) {
        this.context.unit(type, uid);
    }
    getUnit(type) {
        return this.context.getUnit(type);
    }
    async publish() {
        await this.context.publish();
    }
    async finalize() {
        const result = this.context.finalize();
        if (result !== true) {
            await result;
        }
    }
    async refresh() {
        await this.context.refresh();
    }
    async resetContext(units, options) {
        try {
            await this.context.ready();
            const contextData = this.context.data();
            const result = this.context.finalize();
            if (result !== true) {
                await result;
            }
            this.context = this.sdk.createContextWith({ units }, contextData, {
                publishDelay: options?.publishDelay ?? this.config.publishDelay ?? -1,
                refreshPeriod: options?.refreshPeriod ?? this.config.refreshPeriod ?? 0,
            });
            this.ready.set(this.context.isReady());
            this.failed.set(false);
            this.loading.set(!this.context.isReady());
            this.error.set(null);
            this.initializeState();
        }
        catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            this.error.set(err);
            throw err;
        }
    }
    isReady() {
        return this.context.isReady();
    }
    isFailed() {
        return this.context.isFailed();
    }
    isFinalized() {
        return this.context.isFinalized();
    }
    pending() {
        return this.context.pending();
    }
    experiments() {
        return this.context.experiments();
    }
    data() {
        return this.context.data();
    }
    getContext() {
        return this.context;
    }
    getSDK() {
        return this.sdk;
    }
    ngOnDestroy() {
        if (!this.context.isFinalized()) {
            const result = this.context.finalize();
            if (result !== true) {
                result.catch(() => { });
            }
        }
    }
};
ABSmartlyService = __decorate([
    Injectable(),
    __param(0, Inject(ABSMARTLY_CONFIG)),
    __param(1, Optional()),
    __param(1, Inject(ABSMARTLY_CONTEXT))
], ABSmartlyService);
export { ABSmartlyService };
