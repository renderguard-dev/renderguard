const Module = require("module");
const path = require("path");
const shimPath = path.join(__dirname, "vscode-shim.cjs");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "vscode") return shimPath;
  return origResolve.call(this, request, parent, isMain, options);
};
