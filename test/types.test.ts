import { describe, expectTypeOf, test } from "vitest";
import { createGuantr } from "../src";

describe('Guantr', () => {
  test('withContext method should update instance context types', () => {
    const guantr = createGuantr().withContext({ id: 1 })
    expectTypeOf(guantr.context).toMatchTypeOf<{ id: number }>()
  })
})