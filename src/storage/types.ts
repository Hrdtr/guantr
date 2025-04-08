import { GuantrAnyRule } from "../types"

/**
 * Interface representing a storage mechanism for managing rules and cache.
 */
export interface Storage {
  /**
   * Bulk sets rules by replacing existing ones with the provided array.
   * @param rule - Array of rules to set.
   * @returns A promise that resolves when the rules are set.
   */
  setRules: (rule: GuantrAnyRule[]) => Promise<void>;

  /**
   * Retrieves all stored rules.
   * @returns A promise that resolves to an array of stored rules.
   */
  getRules: () => Promise<GuantrAnyRule[]>;

  /**
   * Queries rules for a given action and resource.
   * @param action - The action to filter by.
   * @param resource - The resource to filter by.
   * @returns A promise that resolves to an array of matching rules, or an empty array if none exist.
   */
  queryRules: (action: string, resource: string) => Promise<GuantrAnyRule[]>;

  /**
   * Clears all stored rules.
   * @returns A promise that resolves when all rules are cleared.
   */
  clearRules: () => Promise<void>;

  /**
   * Optional cache mechanism for storing and retrieving data.
   */
  cache?: {
    /**
     * Sets a value in the cache.
     * @param key - The key to associate with the value.
     * @param value - The value to store in the cache.
     * @returns A promise that resolves when the value is set.
     */
    set: <T>(key: string, value: T) => Promise<void>;

    /**
     * Retrieves a value from the cache.
     * @param key - The key associated with the value.
     * @returns A promise that resolves to the cached value, or null/undefined if not found.
     */
    get: <T>(key: string) => Promise<T> | null | undefined;

    /**
     * Checks if a key exists in the cache.
     * @param key - The key to check for existence in the cache.
     * @returns A promise that resolves to true if the key exists, false otherwise.
     */
    has?: (key: string) => Promise<boolean>;

    /**
     * Clears all entries in the cache.
     * @returns A promise that resolves when the cache is cleared.
     */
    clear: () => Promise<void>;
  };
}
