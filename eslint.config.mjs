import unjs from "eslint-config-unjs";

export default unjs({
  ignores: [],
  rules: {
    "unicorn/no-null": "off",
    "unicorn/no-typeof-undefined": 'off'
  },
});
