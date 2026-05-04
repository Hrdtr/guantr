/**
 * Guantr Playground
 * =================
 *
 * Run with:  pnpm play
 *
 * This playground demonstrates real-world usage patterns of the Guantr
 * library.  It covers both untyped (plain-JS-style) and fully-typed
 * (TypeScript) usage, all condition operators, context-driven rules,
 * custom storage, and complex ABAC/RBAC scenarios.
 *
 * Each demo function is self-contained and logs results to the console.
 * The modular structure helps verify type completions in your editor.
 */

import { demoBasic } from './demos/01-basic';
import { demoTyped } from './demos/02-typed';
import { demoOperators } from './demos/03-operators';
import { demoContext } from './demos/04-context';
import { demoArrayOperators } from './demos/05-array-operators';
import { demoStorage } from './demos/06-storage';
import { demoAdvanced } from './demos/07-advanced';
import { demoComplexContext } from './demos/08-complex-context';
import { demoComplexModel } from './demos/09-complex-model';
import { demoKeyCheck } from './demos/10-key-check';

async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log('           Guantr Playground');
  console.log('══════════════════════════════════════════════════════\n');

  await demoBasic();
  await demoTyped();
  await demoOperators();
  await demoContext();
  await demoArrayOperators();
  await demoStorage();
  await demoAdvanced();
  await demoComplexContext();
  await demoComplexModel();
  await demoKeyCheck();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  All demos completed successfully.');
  console.log('══════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Playground error:', err);
});
