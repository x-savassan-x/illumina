/* eslint-disable @typescript-eslint/naming-convention */
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [{
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "warn",

        "@typescript-eslint/naming-convention": ["warn",
            {
                "selector": "default",
                "format": ["camelCase"]
            },
            {
                "selector": "variable",
                "format": ["camelCase", "UPPER_CASE"]
            },
            {
                "selector": "typeLike",
                "format": ["PascalCase"]
            },
            {
                "selector": "interface",
                "format": ["PascalCase"],
                "prefix": ["I"]
            },
            {
                "selector": "enumMember",
                "format": ["PascalCase"]
            },
            {
                "selector": "memberLike",
                "modifiers": ["private"],
                "format": ["camelCase"],
                "leadingUnderscore": "require"
            },
            {
                "selector": "function",
                "format": ["camelCase"]
            }
        ],

        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_"
        }],
    },
}];