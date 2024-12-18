import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";


export default [{
    files: ["**/*.ts"],
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
        parser: tsParser,
        parserOptions: {
            ecmaVersion: 2022,
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        }
    },
    rules: {
        semi: "error",
        curly: "warn",
        eqeqeq: "error",
        "no-throw-literal": "warn",

        "@typescript-eslint/naming-convention": ["warn",
            {
                "selector": "variableLike",
                "format": ["camelCase"],
                "filter": {
                    "regex": "^_$",
                    "match": false
                }
            },
            {
                "selector": "typeLike",
                "format": ["PascalCase"]
            },
            {
                "selector": "memberLike",
                "format": ["camelCase"]
            },
            {
                "selector": "memberLike",
                "modifiers": ["private"],
                "format": ["camelCase"],
                "leadingUnderscore": "require"
            },
            {
                "selector": "enumMember",
                "format": ["PascalCase"]
            },
            {
                "selector": "objectLiteralProperty",
                "format": ["camelCase", "PascalCase"]
            },
            {
                "selector": "objectLiteralMethod",
                "format": ["camelCase", "PascalCase"]
            }
        ],
        "@typescript-eslint/no-unused-vars": ["warn", {
            vars: "all",
            args: "all",
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_"
        }],
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/explicit-member-accessibility": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/await-thenable": "error"
    },
}];
