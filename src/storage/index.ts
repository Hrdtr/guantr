import { GuantrRule } from '../types';
import { Storage } from './types';

export type { Storage } from './types';

export class InMemoryStorage implements Storage {
  private storage = {
    // Two-level index: Map<action, Map<resource, GuantrRule[]>>
    rules: new Map<string, Map<string, GuantrRule[]>>(),
    cache: new Map<string, unknown>(),
  };

  /**
   * Atomically replaces all stored rules with the provided rules.
   * Because JavaScript is single-threaded and {@link Map.clear} followed by
   * {@link Map.set} runs synchronously within the same call, this operation
   * is effectively atomic — no concurrent `queryRules` can observe an
   * intermediate state.
   * @param rules - Array of rules to set.
   */
  async setRules(rules: GuantrRule[]) {
    this.storage.rules.clear();

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
    const allRules: GuantrRule[] = [];
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

  cache = {
    set: async <T>(key: string, value: T) => {
      this.storage.cache.set(key, value);
    },

    get: async <T>(key: string): Promise<T | undefined> => {
      return this.storage.cache.get(key) as T | undefined;
    },

    has: async (key: string) => {
      return this.storage.cache.has(key);
    },

    clear: async () => {
      this.storage.cache.clear();
    },
  };
}
