// Path polyfill for React Native
module.exports = {
  join: (...args) => args.join('/'),
  normalize: (path) => path,
  resolve: (path) => path,
  dirname: (path) => path.split('/').slice(0, -1).join('/')
};
