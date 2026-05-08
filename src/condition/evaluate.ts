import type { Condition, AstNode, OperatorNode, LogicalNode, ValueRef } from './types';
import { GuantrInvalidConditionKeyError } from '../errors';

function hasNullishOptOut(operands: readonly ValueRef[]): boolean {
  return operands.some(
    (op) => op.type === 'literal' && (op.value === null || op.value === undefined),
  );
}

function getByPath(obj: Record<string, unknown>, path: string, skipKeyCheck: boolean): unknown {
  const segments = path.split('.');
  let current: unknown = obj;

  for (const segment of segments) {
    const isOptional = segment.endsWith('?');
    const key = isOptional ? segment.slice(0, -1) : segment;

    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      throw new GuantrInvalidConditionKeyError(path);
    }

    const record = current as Record<string, unknown>;

    if (!(key in record)) {
      if (isOptional || skipKeyCheck) return undefined;
      throw new GuantrInvalidConditionKeyError(path);
    }

    current = record[key];
  }

  return current;
}

function resolveValue(
  ref: ValueRef,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
  skipKeyCheck: boolean,
): unknown {
  switch (ref.type) {
    case 'resource':
      return getByPath(resource, ref.path, skipKeyCheck);
    case 'context':
      return getByPath(context, ref.path, skipKeyCheck);
    case 'literal':
      return ref.value;
  }
}

function matchCaseInsensitive(value: unknown, target: unknown): boolean {
  if (typeof value !== 'string' || typeof target !== 'string') return value === target;
  return value.toLowerCase() === target.toLowerCase();
}

function evaluateOperatorNode(
  node: OperatorNode,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  const skipKeyCheck = hasNullishOptOut(node.operands);
  const ci = node.options?.caseInsensitive ?? false;

  switch (node.operator) {
    case 'eq': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      if (ci) return matchCaseInsensitive(left, right);
      return left === right;
    }

    case 'ne': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      if (ci) return !matchCaseInsensitive(left, right);
      return left !== right;
    }

    case 'gt': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      return Number(left) > Number(right);
    }

    case 'gte': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      return Number(left) >= Number(right);
    }

    case 'lt': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      return Number(left) < Number(right);
    }

    case 'lte': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      return Number(left) <= Number(right);
    }

    case 'contains': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      const s = String(left ?? '');
      const t = String(right ?? '');
      if (ci) return s.toLowerCase().includes(t.toLowerCase());
      return s.includes(t);
    }

    case 'startsWith': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      const s = String(left ?? '');
      const t = String(right ?? '');
      if (ci) return s.toLowerCase().startsWith(t.toLowerCase());
      return s.startsWith(t);
    }

    case 'endsWith': {
      const left = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const right = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      const s = String(left ?? '');
      const t = String(right ?? '');
      if (ci) return s.toLowerCase().endsWith(t.toLowerCase());
      return s.endsWith(t);
    }

    case 'in':
    case 'has': {
      const first = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const second = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      const [value, arr] = node.operator === 'in' ? [first, second] : [second, first];
      if (!Array.isArray(arr)) return false;
      if (ci) return arr.some((item) => matchCaseInsensitive(item, value));
      return arr.includes(value);
    }

    case 'hasSome': {
      const arr = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const values = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      if (!Array.isArray(arr) || !Array.isArray(values)) return false;
      return values.some((v) => {
        if (ci) return arr.some((item) => matchCaseInsensitive(item, v));
        return arr.includes(v);
      });
    }

    case 'hasEvery': {
      const arr = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      const values = resolveValue(node.operands[1], resource, context, skipKeyCheck);
      if (!Array.isArray(arr) || !Array.isArray(values)) return false;
      return values.every((v) => {
        if (ci) return arr.some((item) => matchCaseInsensitive(item, v));
        return arr.includes(v);
      });
    }

    case 'some':
    case 'every':
    case 'none': {
      const arr = resolveValue(node.operands[0], resource, context, skipKeyCheck);
      if (!Array.isArray(arr)) return false;

      if (!node.condition) {
        if (node.operator === 'some') return false;
        if (node.operator === 'every') return false;
        return true;
      }

      const nestedCondition = node.condition;
      const results = arr.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return evaluateAstNode(nestedCondition.node, item as Record<string, unknown>, context);
        }
        return false;
      });

      if (node.operator === 'some') return results.some(Boolean);
      if (node.operator === 'every') return arr.length > 0 && results.every(Boolean);
      return !results.some(Boolean);
    }
  }
}

function evaluateLogicalNode(
  node: LogicalNode,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  switch (node.operator) {
    case 'and':
      return node.operands.every((op) => evaluateAstNode(op.node, resource, context));
    case 'or':
      return node.operands.some((op) => evaluateAstNode(op.node, resource, context));
    case 'not':
      return !evaluateAstNode(node.operands[0].node, resource, context);
  }
}

function evaluateAstNode(
  node: AstNode,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  switch (node.type) {
    case 'operator':
      return evaluateOperatorNode(node, resource, context);
    case 'logical':
      return evaluateLogicalNode(node, resource, context);
  }
}

/**
 * Evaluates a serialized {@link Condition} AST against a resource instance and
 * evaluation context.
 *
 * This is the runtime evaluation engine used by `can` / `cannot`. The condition
 * tree is walked recursively:
 * - `operator` nodes resolve left/right values (from the resource, context, or
 *   literals) and apply the operator logic.
 * - `logical` nodes combine child conditions with `and` / `or` / `not`.
 *
 * Key-existence checks are performed for `resource` and `context` references,
 * throwing {@link GuantrInvalidConditionKeyError} if a field is missing, unless
 * one operand is an explicit `null` / `undefined` literal (opt-out for sparse
 * objects).
 *
 * @param condition - The serialized condition AST to evaluate.
 * @param resource - The resource instance to evaluate against.
 * @param context - The evaluation context (resolved from the `context` option).
 * @returns `true` if the condition is satisfied, `false` otherwise.
 * @throws {GuantrInvalidConditionKeyError} When a referenced field does not exist
 *   on the resource or context and no nullish opt-out is present.
 */
export function evaluateCondition(
  condition: Condition,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  return evaluateAstNode(condition.node, resource, context);
}
