module.exports = {
    "extends": [
      "prettier",
    ],
    "plugins": [
      "prettier",
    ],
    "parser": "babel-eslint",
    "parserOptions": {
      "ecmaVersion": 8,
      "sourceType": "module",
      "ecmaFeatures": {
        "jsx": true,
        "experimentalObjectRestSpread": true,
        "modules": true,
      }
    },
    "env": {
      "es6": true,
      "node": true,
    },
    "rules": {
      "prettier/prettier": [
        "error",
        {
          "singleQuote": true,
          "trailingComma": "es5",
          "semi": false,
          "printWidth": 80,
        },
      ],
      "no-unused-vars": ["error", { "args": "after-used" }],
    },
    "overrides": [
      {
        "files": ["*.test.js"],
         "rules": {
            "no-unused-expressions": "off"
        }
      }
  ]
  }