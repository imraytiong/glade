import { flattenNodes } from './src/utils/fs';
const nodes = [{ name: 'folder', path: '/folder', isDirectory: true, children: [{ name: 'file.md', path: '/folder/file.md', isDirectory: false }] }];
console.log(flattenNodes(nodes));
