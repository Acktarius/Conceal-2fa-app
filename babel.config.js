module.exports = (api) => {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      ['react-native-worklets/plugin'],
      [
        'module-resolver',
        {
          alias: {
            // Stub for react-native-multithreading - module not working yet, use fallback
            // When it works in the future: remove this alias and add module to package.json
            'react-native-multithreading': './lib/react-native-multithreading-stub.ts',
          },
        },
      ],
    ],
  };
};
