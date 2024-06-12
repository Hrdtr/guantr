import unjs from "eslint-config-unjs";

export default unjs({
  ignores: ["docs/.vitepress/dist", "docs/.vitepress/cache"],
  rules: {
    "unicorn/no-null": "off",
    "unicorn/no-typeof-undefined": 'off'
  },
});
