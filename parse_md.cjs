const { parser } = require("@lezer/markdown");
const { GFM } = require("@lezer/markdown"); // wait, GFM is exported from @lezer/markdown?
// Actually @codemirror/lang-markdown exports markdownLanguage which has GFM?
console.log("Keys in lezer/markdown", Object.keys(require("@lezer/markdown")));
