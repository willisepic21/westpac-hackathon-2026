// Metro babel transformer: turns .md files into `module.exports = "<file contents>"`
// and hands everything else to Expo's normal transformer.
const upstream = require(
  require.resolve('@expo/metro-config/babel-transformer', {
    paths: [require.resolve('expo/metro-config')],
  }),
);

module.exports.transform = (params) => {
  if (params.filename.endsWith('.md')) {
    return upstream.transform({ ...params, src: `module.exports = ${JSON.stringify(params.src)};` });
  }
  return upstream.transform(params);
};
