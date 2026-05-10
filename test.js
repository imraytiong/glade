const regex = /([-*+]\s)\[(x| |X)\]/i;
const line = "- [ ] Task 1";
const match = line.match(regex);
console.log(match.index, match[1].length);
