import { describe, expect, it } from "vitest";
import { getContextValue, validateValueType } from "../src/utils";

describe('getContextValue', () => {
  it('should return the value at the specified path', () => {
    const context = {
      user: {
        name: 'John Doe',
        address: {
          city: 'Anytown'
        }
      }
    };
    expect(getContextValue(context, 'user.name')).toBe('John Doe');
    expect(getContextValue(context, 'user.address.city')).toBe('Anytown');
  });

  it('should return undefined for non-existent paths', () => {
    const context = {
      user: {
        name: 'John Doe'
      }
    };
    expect(getContextValue(context, 'user.address.city')).toBeUndefined();
    expect(getContextValue(context, 'nonExistent.path')).toBeUndefined();
  });

  it('should handle paths with null or undefined values', () => {
    const context = {
      user: {
        name: 'John Doe',
        address: null
      }
    };
    expect(getContextValue(context, 'user.address.city')).toBeNull();
  });

  it('should handle paths starting with $ctx.', () => {
    const context = {
      user: {
        name: 'John Doe'
      }
    };
    expect(getContextValue(context, '$ctx.user.name')).toBe('John Doe');
  });

  it('should handle paths starting with ctx.', () => {
    const context = {
      user: {
        name: 'John Doe'
      }
    };
    expect(getContextValue(context, 'ctx.user.name')).toBe('John Doe');
  });

  it('should handle optional chaining', () => {
    const context1 = {
      user: {
        address: {
          city: 'Anytown'
        }
      }
    };
    const context2 = {
      user: {}
    };
    expect(getContextValue(context1, 'user?.address?.city')).toBe('Anytown');
    expect(getContextValue(context2, 'user?.address?.city')).toBeUndefined();
  });
});

describe('validateValueType', () => {
  it('should not throw an error if the value is null or undefined', () => {
    expect(() => validateValueType(null, ['string'], 'eq')).not.toThrowError();
    expect(() => validateValueType(undefined, ['string'], 'eq')).not.toThrowError();
  });

  it('should not throw an error if the value matches the allowed types', () => {
    expect(() => validateValueType('string', ['string'], 'eq')).not.toThrowError();
    expect(() => validateValueType(123, ['number'], 'eq')).not.toThrowError();
    expect(() => validateValueType(true, ['boolean'], 'eq')).not.toThrowError();
    expect(() => validateValueType([1, 2, 3], ['array'], 'eq')).not.toThrowError();
    expect(() => validateValueType({ a: 1 }, ['object'], 'eq')).not.toThrowError();
  });

  it('should throw a TypeError if the value does not match the allowed types', () => {
    expect(() => validateValueType(123, ['string'], 'eq')).toThrowError(TypeError);
    expect(() => validateValueType(true, ['number'], 'eq')).toThrowError(TypeError);
    expect(() => validateValueType('string', ['boolean'], 'eq')).toThrowError(TypeError);
    expect(() => validateValueType({ a: 1 }, ['array'], 'eq')).toThrowError(TypeError);
    expect(() => validateValueType([1, 2, 3], ['object'], 'eq')).toThrowError(TypeError);
  });

  it('should not throw an error if the custom validator returns true', () => {
    expect(() => validateValueType('string', ['string'], 'eq', (value) => typeof value === 'string')).not.toThrowError();
  });

  it('should throw a TypeError if the custom validator returns false', () => {
    expect(() => validateValueType('string', ['string'], 'eq', (value) => typeof value === 'number')).toThrowError(TypeError);
  });
});
