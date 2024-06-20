const path = require("path");
module.exports = {
  mode: "production",
  entry: {
    jsc: "./src/cli/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist-cli-webpack"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  target: "node",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
          options: { configFile: path.resolve(__dirname, "./tsconfig-cli-webpack.json") },
        },
        exclude: /node_modules/,
      },
    ],
  },
};
