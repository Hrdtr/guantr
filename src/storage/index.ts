import { GuantrAnyRule } from "../types";
import { Storage } from "./types";

export type { Storage } from './types'

export class InMemoryStorage implements Storage {
  private storage = {
    // Two-level index: Map<action, Map<resource, GuantrAnyRule[]>>
    rules: new Map<string, Map<string, GuantrAnyRule[]>>(),
    cache: new Map<string, unknown>(),
  }

 /**
   * Bulk sets rules by clearing the current index and adding new rules.
   * @param rules - Array of rules to set.
   */
  async setRules(rules: GuantrAnyRule[]) {
    for (const rule of rules) {
      let resourceMap = this.storage.rules.get(rule.action);
      if (!resourceMap) {
        resourceMap = new Map();
        this.storage.rules.set(rule.action, resourceMap);
      }
      let ruleArray = resourceMap.get(rule.resource);
      if (!ruleArray) {
        ruleArray = [];
        resourceMap.set(rule.resource, ruleArray);
      }

      ruleArray.push(rule);
    }
  }

  /**
   * Retrieves all stored rules.
   * @returns An array of all stored rules.
   */
  async getRules() {
    const allRules: GuantrAnyRule[] = [];
    for (const resourceMap of this.storage.rules.values()) {
      for (const ruleArray of resourceMap.values()) {
        allRules.push(...ruleArray);
      }
    }
    return allRules;
  }

  /**
   * Retrieves rules for a given action and resource.
   * @param action - The action to filter by.
   * @param resource - The resource to filter by.
   * @returns An array of matching rules, or an empty array if none exist.
   */
  async queryRules(action: string, resource: string) {
    const resourceMap = this.storage.rules.get(action);
    if (!resourceMap) return [];
    return resourceMap.get(resource) || [];
  }

  /**
   * Clears all stored rules.
   */
  async clearRules() {
    this.storage.rules.clear();
  }

  cache = {
    set: async <T>(key: string, value: T) => {
      this.storage.cache.set(key, value);
    },

    get: async <T>(key: string): Promise<T> => {
      return this.storage.cache.get(key) as T;
    },

    has: async (key: string) => {
      return this.storage.cache.has(key);
    },

    clear: async () => {
      this.storage.cache.clear();
    }
  }
}
