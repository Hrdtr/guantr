import { readdir, readFile, writeFile } from 'node:fs/promises'

const docsFilePath = (await readdir('./docs', { recursive: true })).filter(i => i.endsWith(`.md`))
let contents = ''
for (const filePath of docsFilePath) {
  const fileContents = await readFile(`./docs/${filePath}`, 'utf8')
  contents += `--- start of ${filePath}\n\n${fileContents}\n\n--- end of ${filePath}\n\n`
}

await writeFile('./documentation.md', contents)
