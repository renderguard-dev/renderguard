class Range {
  constructor(startLine, startChar, endLine, endChar) {
    this.startLine = startLine;
    this.startChar = startChar;
    this.endLine = endLine;
    this.endChar = endChar;
  }
  get start() {
    return { line: this.startLine, character: this.startChar };
  }
  get end() {
    return { line: this.endLine, character: this.endChar };
  }
  intersection(other) {
    if (this.endLine < other.startLine || this.startLine > other.endLine) return null;
    return this;
  }
}

module.exports = {
  Range,
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  Diagnostic: class {
    constructor(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
      this.source = "";
      this.code = "";
    }
  },
};
