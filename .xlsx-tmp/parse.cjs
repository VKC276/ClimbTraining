const fs = require('fs')
const sst = fs.readFileSync(__dirname + '/xl/sharedStrings.xml', 'utf8')
const strings = [...sst.matchAll(/<si><t>([^<]*)<\/t><\/si>/g)].map((m) =>
  m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"'),
)
const sheet = fs.readFileSync(__dirname + '/xl/worksheets/sheet1.xml', 'utf8')
const cells = [...sheet.matchAll(/<c r="([A-D])(\d+)"[^>]*t="s"><v>(\d+)<\/v><\/c>/g)]
const grid = {}
for (const [, col, row, idx] of cells) {
  grid[`${col}${row}`] = strings[Number(idx)]
}
const cat1 = []
const cat2 = []
for (let r = 2; r <= 21; r++) {
  if (grid[`A${r}`]) cat1.push({ title: grid[`A${r}`], text: grid[`B${r}`] || '' })
  if (grid[`C${r}`]) cat2.push({ title: grid[`C${r}`], text: grid[`D${r}`] || '' })
}
console.log(JSON.stringify({ headers: { A1: grid.A1, B1: grid.B1, C1: grid.C1, D1: grid.D1 }, cat1, cat2 }, null, 2))
